# P2S Academy — website

Static Arabic single-page site for **P2S Academy** (معادلة كلية التجارة).
Live site: https://p2s-academy.com/

## AI / agent discovery

The site exposes its public data in formats that ChatGPT, Claude, Perplexity,
Bing, and other agents can read without executing JavaScript:

| File | Purpose |
|---|---|
| `/llms.txt` | Short LLM index (llms.txt convention) |
| `/llms-full.txt` | Full site content in plain Markdown |
| `/site.json` | Structured JSON: organization, course, eligibility, FAQ, offers |
| `/sitemap.xml` | XML sitemap with `lastmod` |
| `/robots.txt` | Crawler policy (AI crawlers explicitly allowed) |
| `/p2s-f6f17c57a31832608040d4cfdf8f98c8.txt` | IndexNow key file |

`index.html` links to these with `<link rel="alternate">`, and the JSON-LD
graph includes `dateModified`, `knowsAbout`, and social `sameAs` links.

## Updating content and asking search engines to re-fetch

When public content changes:

1. Update the visible content in `index.html`.
2. Update `llms.txt`, `llms-full.txt`, and `site.json` to match.
3. Set `<lastmod>` in `sitemap.xml` to the current date (today: `2026-11-24`).
4. Set `dateModified` in the JSON-LD and `og:updated_time` in `index.html`.
5. Deploy, then submit the changed URLs to IndexNow:

   ```sh
   node scripts/indexnow.mjs
   ```

   IndexNow notifies Bing, Yandex, Naver, Seznam, Yep, and other participating
   engines. Google does not participate in IndexNow; it re-fetches based on
   `sitemap.xml` `<lastmod>` and normal crawl signals. For Google, resubmit
   `sitemap.xml` in Search Console or run URL Inspection on the changed URL.

The GitHub Actions workflow `.github/workflows/indexnow.yml` runs the script
automatically after a push to `gh-pages` that changes `index.html`, `llms.txt`,
`llms-full.txt`, `site.json`, `sitemap.xml`, or `robots.txt`. It waits up to
10 minutes for the deployed key file, then submits the sitemap URL plus
`llms.txt`, `llms-full.txt`, and `site.json`.

### Manual / dry-run

```sh
node scripts/indexnow.mjs --dry-run
node scripts/indexnow.mjs --skip-verify
node scripts/indexnow.mjs https://p2s-academy.com/
```

## Notes

- `_headers` is used by Cloudflare Pages / Netlify. GitHub Pages ignores it, but
  the files it points to (`llms.txt`, `site.json`, etc.) are still served.
- Design prototypes under `/p/` and `/assets/old-work/` are excluded from
  crawling and marked `noindex`; they are not current product content.
- `p2s-app.html` is a noindex legacy redirect to `/`.
