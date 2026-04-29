# Content placeholders

Every personal detail is wrapped in `[PLACEHOLDER: ...]`. To find them all at once:

```sh
grep -rn "PLACEHOLDER" src public scripts astro.config.mjs README.md CONTENT.md
```

Below is the same set, grouped by page, so you can do a single pass.

## Site-wide — `src/config.ts`

- `domain` and `url` — the real domain (e.g., `yourname.com`).
- `title` / `author` — your full name.
- `description` — short tagline used in default meta + OG.
- `emailUser` and `emailDomain` — split for light obfuscation; assembled at click time.
- `linkedin`, `github` — full URLs.
- `socialLabel` and `socialUrl` — pick one of X, Bluesky, or Mastodon.
- `city` — used in the CV header.

## `astro.config.mjs`

- `site` — set to your real `https://yourname.com` so canonical URLs and the sitemap resolve correctly.

## Home — `src/pages/index.astro`

- Full name (h1).
- Lede line — current title and company.
- Two body paragraphs (bio + operating principles).

## Projects — `src/pages/projects.astro`

For each project entry: `title`, `summary`, `role`, `outcome`, optional `link`.

## Now — `src/pages/now.astro`

- `lastUpdated` date constant at the top of the frontmatter.
- One intro paragraph.
- Three short lists: Work, Learning, Outside work.

## Reading — `src/pages/reading.astro`

- Year keys in the `reading` object.
- Each book entry: `title`, `author`, optional `take`.

## Uses — `src/pages/uses.astro`

- Three lists: Hardware, Software, Dev environment.

## CV — `src/pages/cv.astro`

- Full name (h1).
- Contact line — title, city, email parts (mirror `src/config.ts`), LinkedIn URL, GitHub URL.
- Summary paragraph.
- Each role: `company`, `title`, `dates`, `location`, bullets.
- Skills line.
- Education entry.
- Optional Certifications section is commented out — uncomment if relevant.

## OG image — `scripts/gen-og.mjs`

- `TITLE` and `SUBTITLE` constants near the top. Re-run is automatic on `pnpm build`.

## robots / sitemap

- `public/robots.txt` references `https://yourname.com/sitemap-index.xml` — update the host once the real domain is live (the path stays the same; `@astrojs/sitemap` generates `sitemap-index.xml`).

## Blog posts

- `src/content/blog/welcome.md`
- `src/content/blog/engineering-management-notes.md`

These are placeholders; rewrite or replace once you have real posts.
