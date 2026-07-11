import type { APIRoute } from "astro";
import { getDefaultAsset } from "@x402/evm";
import { NETWORK, PAY_TO } from "../../lib/x402";
import { AGENT_RESOURCES } from "../../lib/agent-resources";

// Opts this endpoint out of static prerendering — every other page stays
// prerendered/static as before (see astro.config.mjs).
export const prerender = false;

/**
 * Generated (not static) — this used to be a hand-written public/ file with
 * a hardcoded payTo placeholder that never got updated when the real
 * X402_PAY_TO_ADDRESS env var was set. Building it from the same
 * NETWORK/PAY_TO/AGENT_RESOURCES the real endpoints use means it can't drift
 * out of sync again. This is the pre-payment discovery manifest — the CDP
 * Bazaar only lists a resource AFTER a payment settles against it, so this
 * is what lets an agent find these endpoints for the very first purchase.
 */
function dollarsToAtomicAmount(price: string, decimals: number): string {
  const dollars = Number(price.replace(/^\$/, ""));
  return Math.round(dollars * 10 ** decimals).toString();
}

export const GET: APIRoute = async () => {
  const asset = getDefaultAsset(NETWORK);
  const origin = "https://www.sageanomaly.com";

  const resources = AGENT_RESOURCES.map((r) => ({
    resource: `${origin}${r.path}`,
    method: "GET",
    description: r.description,
    mimeType: "application/json",
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: PAY_TO ?? "0xNOT_CONFIGURED_SET_X402_PAY_TO_ADDRESS",
        asset: asset.address,
        amount: dollarsToAtomicAmount(r.price, asset.decimals),
        maxTimeoutSeconds: 60,
        extra: { name: asset.name, version: asset.version },
        price: r.price,
      },
    ],
  }));

  return new Response(JSON.stringify({ x402Version: 1, resources }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};
