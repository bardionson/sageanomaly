// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // Astro 6 folded the old 'hybrid' mode into 'static': pages are
  // prerendered by default (unchanged from before this change) and only
  // routes that explicitly opt out with `export const prerender = false`
  // (the new agent API endpoint) run as Vercel serverless functions.
  output: 'static',
  adapter: vercel(),
});
