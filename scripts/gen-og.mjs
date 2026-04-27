// Generate public/og-default.png from a clean SVG template.
// Runs as part of `pnpm build`. Idempotent.

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public');
const outFile = resolve(outDir, 'og-default.png');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Edit these strings to taste; both are intentionally generic placeholders.
const TITLE = '[PLACEHOLDER: Full Name]';
const SUBTITLE = 'Senior Engineering Manager';

const escape = (s) =>
  s.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#111315"/>
  <g font-family="ui-serif, Georgia, 'Times New Roman', serif" fill="#e8e8e8">
    <text x="80" y="320" font-size="80" font-weight="600" letter-spacing="-1">${escape(TITLE)}</text>
    <text x="80" y="380" font-size="34" fill="#a0a0a0" font-family="ui-sans-serif, system-ui, sans-serif">${escape(SUBTITLE)}</text>
  </g>
  <rect x="80" y="540" width="60" height="3" fill="#7aa7ff"/>
</svg>
`.trim();

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(outFile);

console.log(`Wrote ${outFile}`);
