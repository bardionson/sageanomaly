import type { APIRoute } from "astro";
import { withPayment } from "../../../lib/x402";
import { chapters } from "../../../lib/story-content";
import { AGENT_RESOURCES } from "../../../lib/agent-resources";

// Opts this single endpoint out of static prerendering — every other page on
// the site stays prerendered/static as before (see astro.config.mjs).
export const prerender = false;

const resource = AGENT_RESOURCES.find((r) => r.path === "/api/agent/story.json")!;

/**
 * Agent-only structured story/chapter index, gated by x402. This is just the
 * table of contents (title, order, subtitle, date) — the actual chapter
 * prose is priced separately per chapter, see story/[chapter].json.ts.
 */
export const GET: APIRoute = async ({ request }) => {
  return withPayment(
    request,
    { price: resource.price, description: resource.description },
    async () => {
      return new Response(JSON.stringify({ chapters }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
};
