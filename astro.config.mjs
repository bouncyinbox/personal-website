import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Update SITE in src/config.ts when the real domain is set.
export default defineConfig({
  site: 'https://yourname.com',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  integrations: [sitemap()],
});
