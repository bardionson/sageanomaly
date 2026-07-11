import type { APIRoute } from "astro";
import { withPayment } from "../../../lib/x402";

// Opts this single endpoint out of static prerendering — every other page on
// the site stays prerendered/static as before (see astro.config.mjs).
export const prerender = false;

/**
 * Agent-only structured story/chapter index, gated by x402. The chapter
 * prose itself lives as markup inside each src/pages/story/*.astro file (no
 * content collection or data layer exists for it), so this exposes the
 * clean, already-structured chapter metadata (title, order, subtitle, date,
 * slug sequence) as JSON — a machine-readable chapter index that doesn't
 * exist anywhere today except by rendering and scraping four separate HTML
 * pages.
 */
const chapters = [
  {
    slug: "chapter-one",
    chapterNum: "01",
    title: "SAGE ANOMALY",
    subtitle: "The Beginning — North Bay, Ontario, 1959",
    date: "2022-02-22",
  },
  {
    slug: "the-hypothesis",
    chapterNum: "02",
    title: "THE HYPOTHESIS",
    subtitle: "James Speaks — The Oscilloscope Recordings",
    date: "2022-03-07",
  },
  {
    slug: "the-conspiracy",
    chapterNum: "03",
    title: "THE CONSPIRACY",
    subtitle: "The T-Tape — System Development Corporation",
    date: "2022-04-02",
  },
  {
    slug: "future-past",
    chapterNum: "04",
    title: "FUTURE PAST",
    subtitle: "The Entity Speaks — 2030",
    date: "2023-03-26",
  },
];

export const GET: APIRoute = async ({ request }) => {
  return withPayment(
    request,
    {
      price: "$0.01",
      description: "Structured SAGE Anomaly chapter index (title, order, dates) as JSON",
    },
    async () => {
      return new Response(JSON.stringify({ chapters }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
};
