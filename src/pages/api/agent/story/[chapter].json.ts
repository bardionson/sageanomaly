import type { APIRoute } from "astro";
import { withPayment } from "../../../../lib/x402";
import { chapters, getChapterContent } from "../../../../lib/story-content";
import { AGENT_RESOURCES } from "../../../../lib/agent-resources";

// Opts this single endpoint out of static prerendering — every other page on
// the site stays prerendered/static as before (see astro.config.mjs).
export const prerender = false;

/**
 * Agent-only individual chapter content, gated by x402 at $1 per chapter —
 * distinct from story.json.ts (the free-standing table of contents, priced
 * separately and much cheaper). Content is extracted from the corresponding
 * src/pages/story/<slug>.astro file — see getChapterContent in
 * src/lib/story-content.ts for how.
 */
export const GET: APIRoute = async ({ request, params }) => {
  const slug = params.chapter;
  const meta = chapters.find((c) => c.slug === slug);

  if (!meta) {
    return new Response(JSON.stringify({ error: "Unknown chapter" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resource = AGENT_RESOURCES.find((r) => r.path === `/api/agent/story/${meta.slug}.json`)!;

  return withPayment(
    request,
    { price: resource.price, description: resource.description },
    async () => {
      const content = getChapterContent(meta.slug);
      if (content === null) {
        return new Response(
          JSON.stringify({ error: "Chapter content unavailable" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ...meta, content }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
};
