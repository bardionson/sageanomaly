import fs from "node:fs";
import path from "node:path";

/**
 * Chapter metadata, shared between the index endpoint (story.json.ts) and
 * the per-chapter endpoint (story/[chapter].json.ts). The chapter prose
 * itself lives as markup inside each src/pages/story/*.astro file (no
 * content collection or data layer exists for it) — see getChapterContent
 * below for how that's extracted rather than duplicated here.
 */
export interface ChapterMeta {
  slug: string;
  chapterNum: string;
  title: string;
  subtitle: string;
  date: string;
}

export const chapters: ChapterMeta[] = [
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

const storyDir = path.join(process.cwd(), "src/pages/story");

/**
 * Extracts a chapter's prose from its .astro source file. Each chapter page
 * wraps its content in <ChapterLayout ...>...</ChapterLayout> (see
 * src/layouts/ChapterLayout.astro's <slot />) — the content between those
 * tags is plain HTML (p/figure/blockquote), no Astro expressions, so a
 * straightforward tag-boundary extraction is reliable here without needing
 * a real Astro renderer.
 */
export function getChapterContent(slug: string): string | null {
  const meta = chapters.find((c) => c.slug === slug);
  if (!meta) return null;

  const filePath = path.join(storyDir, `${slug}.astro`);
  if (!fs.existsSync(filePath)) return null;

  const source = fs.readFileSync(filePath, "utf8");
  const openTagEnd = source.indexOf(">", source.indexOf("<ChapterLayout"));
  const closeTagStart = source.lastIndexOf("</ChapterLayout>");
  if (openTagEnd === -1 || closeTagStart === -1 || closeTagStart <= openTagEnd) {
    return null;
  }

  return source.slice(openTagEnd + 1, closeTagStart).trim();
}
