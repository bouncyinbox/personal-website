import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';

const lightningTargets = browserslistToTargets(browserslist('>= 0.5%, last 2 versions, Firefox ESR, not dead'));

// Keep this in sync with SITE.url in src/config.ts.
export default defineConfig({
  site: 'https://buildwithamit.in',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  vite: {
    css: {
      transformer: 'lightningcss',
      lightningcss: { targets: lightningTargets, minify: true },
    },
    build: { cssMinify: 'lightningcss' },
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
