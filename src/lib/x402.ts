import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { x402HTTPResourceServer } from "@x402/core/http";
import type { HTTPAdapter, HTTPRequestContext, RoutesConfig } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator as coinbaseFacilitator } from "@coinbase/x402";

// @x402/core doesn't re-export its `Network` type from any public subpath;
// it's a CAIP-2 id shaped `${namespace}:${reference}` (e.g. "eip155:84532").
type Network = `${string}:${string}`;

/**
 * Shared x402 "seller" gate for agent-only Astro API endpoints. There's no
 * official @x402/astro package usable here — the community package
 * (@emdash-cms/x402) requires Astro ^7.0.0, while this site is on Astro
 * ^6.4.7, so this is built directly on @x402/core instead. It works with
 * plain Fetch API Request/Response, which is exactly what Astro endpoints
 * use, and is the same module (ported near-verbatim) as the equivalent in
 * bardionson-website's src/lib/x402.ts — same protocol logic, same env vars,
 * portable across both projects.
 *
 * Network/wallet are env-driven so flipping from Base Sepolia testnet to Base
 * mainnet later is a config change, not a code change:
 * - X402_NETWORK (CAIP-2 id, e.g. "eip155:84532" for Base Sepolia, "eip155:8453" for Base mainnet)
 * - X402_PAY_TO_ADDRESS (receiving wallet)
 * - CDP_API_KEY_ID / CDP_API_KEY_SECRET — read directly by @coinbase/x402's
 *   default `facilitator` export (imported below), which already points at
 *   the CDP-hosted facilitator (https://api.cdp.coinbase.com) for both
 *   networks under one account. No separate facilitator-URL env var needed;
 *   unauthenticated calls only work for the facilitator's /list endpoint —
 *   /verify and /settle require the CDP key pair. In local testing against
 *   the real CDP facilitator (no keys configured), even the discovery call
 *   used by initialize() returned 401 — so initialize() itself requires
 *   valid CDP credentials, not just verify/settle as CDP's docs suggest.
 */

// process.env, not import.meta.env: this only runs in the server-rendered
// endpoint (prerender = false), and process.env avoids any ambiguity around
// Vite's PUBLIC_-prefix client-exposure rules for non-public secrets.
const NETWORK = (process.env.X402_NETWORK ?? "eip155:84532") as Network;
const PAY_TO = process.env.X402_PAY_TO_ADDRESS;

let cachedServer: x402ResourceServer | null = null;
let initPromise: Promise<void> | null = null;

/**
 * The underlying x402ResourceServer (and its one-time facilitator discovery
 * call via .initialize()) is process-lifetime state, not per-request state.
 * x402ResourceServer.initialize() unconditionally clears and re-fetches
 * supported kinds from the facilitator every time it's called (verified by
 * reading the installed package source — it is not internally idempotent),
 * so this caches the initialized instance rather than re-initializing (and
 * re-hitting the facilitator) on every request.
 */
async function getInitializedResourceServer(): Promise<x402ResourceServer> {
  if (!cachedServer) {
    const facilitatorClient = new HTTPFacilitatorClient(coinbaseFacilitator);
    cachedServer = new x402ResourceServer(facilitatorClient).register(
      NETWORK,
      new ExactEvmScheme(),
    );
  }
  if (!initPromise) {
    initPromise = cachedServer.initialize().catch((err) => {
      // Let the next call retry rather than caching a permanent failure —
      // useful if CDP keys get set after the process is already running.
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
  return cachedServer;
}

function adaptRequest(req: Request, path: string): HTTPAdapter {
  return {
    getHeader: (name: string) => req.headers.get(name) ?? undefined,
    getMethod: () => req.method,
    getPath: () => path,
    getUrl: () => req.url,
    getAcceptHeader: () => req.headers.get("accept") ?? "*/*",
    getUserAgent: () => req.headers.get("user-agent") ?? "",
  };
}

export interface AgentRouteConfig {
  /** Dollar-denominated price string, e.g. "$0.01" */
  price: string;
  description: string;
}

/**
 * Wraps an Astro endpoint handler with x402 payment gating. Settlement is
 * only attempted AFTER the handler runs and only if it returned a non-error
 * status — never charge for a failed response.
 */
export async function withPayment(
  req: Request,
  routeConfig: AgentRouteConfig,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (!PAY_TO) {
    return new Response(
      JSON.stringify({ error: "X402_PAY_TO_ADDRESS is not configured on this server" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(req.url);
  // A bare RouteConfig (not path-keyed) is valid RoutesConfig — this server
  // instance is scoped to exactly one route handler already, so there's no
  // path pattern to match against.
  const routes: RoutesConfig = {
    accepts: {
      scheme: "exact",
      price: routeConfig.price,
      network: NETWORK,
      payTo: PAY_TO,
    },
    description: routeConfig.description,
  };

  let resourceServer: x402ResourceServer;
  try {
    resourceServer = await getInitializedResourceServer();
  } catch (err) {
    console.error("x402 facilitator initialize() failed:", err);
    return new Response(
      JSON.stringify({
        error: "Payment facilitator unavailable — check CDP_API_KEY_ID/CDP_API_KEY_SECRET.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const httpServer = new x402HTTPResourceServer(resourceServer, routes);

  const context: HTTPRequestContext = {
    adapter: adaptRequest(req, url.pathname),
    path: url.pathname,
    method: req.method,
    paymentHeader: req.headers.get("PAYMENT-SIGNATURE") ?? undefined,
  };

  const result = await httpServer.processHTTPRequest(context);

  if (result.type === "payment-error") {
    return new Response(JSON.stringify(result.response.body ?? {}), {
      status: result.response.status,
      headers: { "Content-Type": "application/json", ...result.response.headers },
    });
  }

  if (result.type === "no-payment-required") {
    // Every route configured here always requires payment; this branch is
    // unreachable in practice but kept for type-safety / defensive coding.
    return handler();
  }

  const response = await handler();
  if (response.status >= 400) {
    // Don't settle for a failed response — let the client retry with payment.
    return response;
  }

  const settlement = await httpServer.processSettlement(
    result.paymentPayload,
    result.paymentRequirements,
    result.declaredExtensions,
  );

  if (!settlement.success) {
    return new Response(
      JSON.stringify({ error: "payment settlement failed" }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(settlement.headers)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}
