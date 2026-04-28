import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Keep this in sync with SITE.url in src/config.ts.
export default defineConfig({
  site: 'https://buildwithamit.in',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      filter: (page) =>
        !page.includes('/404') &&
        !page.includes('/now') &&
        !page.includes('/reading'),
    }),
  ],
});
