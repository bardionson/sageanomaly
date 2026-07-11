import { chapters } from "./story-content";

/**
 * Single source of truth for this site's x402-gated agent endpoints: each
 * endpoint imports its own entry here for price/description instead of
 * hardcoding it inline, and the /.well-known/x402.json manifest endpoint
 * generates its listing from this same array — so the manifest can never
 * drift out of sync with what the real endpoints actually charge.
 */
export interface AgentResourceDef {
  /** Path relative to site root, e.g. "/api/agent/story.json" */
  path: string;
  price: string;
  description: string;
}

export const AGENT_RESOURCES: AgentResourceDef[] = [
  {
    path: "/api/agent/story.json",
    price: "$0.01",
    description: "Structured SAGE Anomaly chapter index (title, order, dates) as JSON",
  },
  ...chapters.map((c) => ({
    path: `/api/agent/story/${c.slug}.json`,
    price: "$1.00",
    description: `Full chapter text: "${c.title}" (Chapter ${c.chapterNum})`,
  })),
];
