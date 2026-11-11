# TUI Brand Hub migration: reference context

Updated 2026-11-11 (after the portal 162 migration). Pointers only; no copies of data. Rules are in `AGENTS.md`; procedures in `.claude/skills/frontify-*`, starting with `frontify-migrate` (detects document vs hub).
Two migrations so far: **document 396** (sections below up to the glossary) and the **portal 162 home** (its own section). Status of every page, document and portal: `SITEMAP.md` (generated from `site-status.json`).
Revisit when the Frontify source is edited after the export (latest `modified` in `migration-work/frontify/raw/pages.json`, `migration-work/frontify-portal-162/raw/custom-route.json`), or when any path below moves.

## Where things are
| What | Location | Notes |
|---|---|---|
| Raw export (document, navigation, pages, stylesheet, portal) | `migration-work/frontify/raw/` (`pages/<id>.json`) | git-ignored; contains signed S3 URLs (expire about 6 days after export) |
| Design tokens (type scale, accents, theme, lists) | `migration-work/frontify/design-tokens.json` | from page 1703 GraphQL capture |
| Reference screenshots and captured DOM/GraphQL | `migration-work/frontify/capture/<pageId>/` | `desktop.png` 1440, `mobile.png` 390, `rendered.html`, `graphql.json`, `styles.json` |
| Assets (originals) and manifest | `migration-work/frontify/assets/<key>/` and `.../manifest.json` | also `failures.json` (empty), `font-faces.json` |
| Resized images (EDS 20 MB limit) | `migration-work/frontify/resized/` (`resize-log.json`, `da-map.json`) | published instead of the originals |
| Published assets | `content/assets/<key>/<url-safe name>` | fonts in `fonts/`, rules in `styles/fonts.css` |
| Offline import sources | `migration-work/frontify/source-pages/` (+ `urls.txt`) | served on :8099 during import |
| Redirect map | `migration-work/frontify/redirect-map.{json,csv}` (538), `redirects-sheet.csv` (269 `/r/`) | |
| Verification | `migration-work/frontify/verification.json`, `visual-report.json`, `visual-diff/`, `REPORT.md`, `mobile-overflow.json` | |
| Preview/publish job log | `migration-work/preview-publish/last-job.json` | |
| Export/verify tools | `tools/frontify-export/` (config: `frontify.config.json`) | |
| Importer | `tools/importer/import-guideline-page.js`, `parsers/`, `utils/frontify.js`, `page-templates.json` | |
| Site code | `styles/styles.css`, `scripts/scripts.js` (CONTENT_BASE, redirect template, scrollbar gutter), `scripts/guideline.js` (sidebar/pagination), `blocks/*` | |
| Site map and status (both migrations) | `docs/tui-brandhub/SITEMAP.md`, generated from `docs/tui-brandhub/site-status.json` + the navigation | edit statuses in the JSON, then `python3 -I tools/frontify-export/write_sitemap.py migration-work/frontify/raw/navigation.json docs/tui-brandhub/site-status.json docs/tui-brandhub/SITEMAP.md` |
| Portal 112 navigation (titles of the out-of-scope documents) | `migration-work/frontify/raw/portal-navigation_112.json` | |
| Original block CSS/JS bundles | `migration-work/frontify/block-bundles/` | for styling questions |

## Glossary (from navigation titles and page content, export of 2026-11-10)
- **TUI Smile / Smile symbol:** the logo symbol. **Smile mechanics:** ways of using the smile: *Hero smile* (at scale, top-of-funnel campaign comms), *Playful smile* (the smile woven into illustration), *Radiant smile*.
- **Core Logo, Live Happy (lock-up), Logo Descriptor, Logo Database Nomenclature:** logo pages (category Logo).
- **Brand purpose:** "TUI creates the moments that make life richer" (image on /our-story/brand). **Brand promise, framework, manifesto:** sections of /our-story/brand.
- **Creative principles:** Happy (Positive Energy), Bold (Confident Leadership), Modern (Stylish Touch).
- **Tone of voice:** pillars *Positive energy*, *Bold expertise*, *Insightful Edge*; *Flexing our tone*; communication goals *inform / inspire / reassure / delight*; *ToV for AI*; *Editorial Guidelines*.
- **Colour names:** TUI Red, TUI Sky Blue (hero), TUI Deep Blue (replaces TUI Dark Blue; black equivalent), TUI Energy Blue Digital; extended palettes (Alert, Sustainability/Green, Neutral, Hair & Skin, with MID/DARK variants).
- **Sales Mechanics:** *BAU Toolkit*, *Module explanation*, *Big Sale Moments*, *Special cases Module Layout*, *Luggage tag*.
- **Radiant Templates:** radiant smile templates, logo placement, template construction.
- **CO-branding:** TUI as host / TUI as guest, partner lock-ups, TUI Logo + TUI BLUE Logo.
- **Fonts:** TUIType (TUITypeLtRg_W = light regular web, body), Ambit (Regular / SemiBold / Bold, headings), TUISymbolOT (declared, unused).
- **Frontify terms:** portal 112 "TUI MASTER BRAND NEW"; document 396 "TUI Master Brand Home"; project 540 = the guideline's asset project; "page heading" = a sidebar sub-entry; "permanent link" = `/r/<token>`.
- **Frontify hub terms (portal 162 run):** *hub* = a portal's home page (`/hub/<portalId>`), laid out as a *grid*; *row* = one grid line with width, gutter (`margin`) and background; *cell* = one tile in a row, 1–12 columns wide; *TEXTIMAGE* = a text/image cell with a *layout* (`textover`, `leftright`, …); *DIVIDER* = a line cell; *NONE* = an empty editor placeholder; *teaser* = the cell id; *custom route* = a vanity path such as `/tuimagiclife` that `/api/custom-route/<route>` maps to a hub or document; *theme asset cover* = the portal logo.
- **TUI MAGIC LIFE:** portal 162 "TUI MAGIC LIFE brand portal" (project 1516; fonts also in project 1650); its own palette (yellow, navy, turquoise, pink) is in `AGENTS.md`.

## Resume state: document 396 (2026-11-11)
- **Done:** export (84 pages), reference capture (82 valid views), assets (560 source + 10 derived), blocks/frame, import (84/84 local), content/link/asset verification, visual comparison, 6 oversized images resized.
- **Remote:**
  - Document Authoring has all pages: the user uploaded them; the 6 resized images were uploaded on 2026-11-11.
  - Preview ran on branch `aem-20261111-0835` for 89 paths, all OK after the fix.
  - **Published:** only the 6 resized pages (content is shared across branches, so they're live everywhere). Publish state of the other 78 pages and the 5 chrome documents is unknown and wasn't checked.
  - **Code:** the branch was merged into `main` by the user on 2026-11-11, so `main` serves the guideline code, including the header fix.
- **Partial or open:** see memory `tui-frontify-open-issues`. Nothing is half-written in content.
- **Restart point:** the next step depends on the request.
  - For content updates: re-export (skill `frontify-export`), then `build-sources` → import (skill `frontify-block-mapping`) → verify.
  - Existing data is reusable; don't re-scrape unless the source changed.

## TUI MAGIC LIFE portal home (portal 162, added 2026-11-11)
| What | Location |
|---|---|
| Raw export (route, portal, grid, footer, appearance, fonts, stylesheet, navigation, permalinks) | `migration-work/frontify-portal-162/raw/` |
| Reference captures 1440/768/375 (+ html, styles, hover states) | `migration-work/frontify-portal-162/capture/` |
| Assets and manifest (40 distinct files, 66 entries: fonts are declared twice) | `migration-work/frontify-portal-162/assets/` (`manifest.json`, `font-faces.json`) |
| Frontify app CSS (grid/cell rules, reference) | `migration-work/frontify-portal-162/app-css/` (`hub-rules.css`) and `hub-typography.css` |
| Link map (27 outgoing links) | `migration-work/frontify-portal-162/link-map.{json,csv}` |
| Verification | `migration-work/frontify-portal-162/verification.json`, `visual-report.json`, `rects-<w>.txt`, `local/` |
| Import source / importer | `migration-work/frontify-portal-162/source-pages/` (:8098); `tools/importer/import-hub-page.js`, `parsers/hub-*.js`, `utils/hub.js` |
| Site code | `scripts/hub.js`, `styles/hub.css`, `styles/theme-tuimagiclife.css`, `blocks/hub-cell`, `blocks/hub-divider`, fonts `fonts/mlife-*` |
| Content | `content/tuimagiclife.plain.html`, `content/tuimagiclife/{nav,footer}.plain.html`, `content/assets/cell-*`, `content/assets/theme-logoAsset-171919` |

| Preview / live render checks | `migration-work/frontify-portal-162/preview/`, `main-preview/`, `main-live/` (each with `visual-report.json`) |
| DA upload plan and helpers | `migration-work/preview-publish/da-upload-tuimagiclife.json`; `tools/frontify-export/da_fill_missing_images.py`, `upload-to-da.mjs` (media only) |

Model detection: `/tuimagiclife` → `/api/custom-route/tuimagiclife` → `destination_view: hub`, portal 162 (`raw/custom-route.json`).

## Resume state: portal 162 home (2026-11-11, 12:30 UTC)
- **Done:** export, captures at 1440/768/375, assets (40 distinct files: 14 cell images, 1 logo, 25 font files), hub template, `hub-cell`/`hub-divider` blocks, themed header, import, verification (local 0px offsets), DA upload, preview and publish.
- **Code:** merged into `main` by the user; `main` and `aem-20261111-0835` serve the hub code.
- **Content:** local page, nav and footer reference `/assets/…` (the `content.da.live` rewrite from earlier that day was reverted). DA holds the platform's per-page image copies plus the 15 images uploaded to the exact referenced paths.
- **Live on `main`:** verified (14/14 images, 22/22 text elements, below-header differences 0.032% / 0.008% / 0.765%).
- **CDN:** a stale `/tuimagiclife/nav` on one node (3 of 10 requests at 12:26 UTC) had cleared by 12:43 UTC (10 of 10 requests got the 12:22 publish). Nothing is open on this page.
- **Restart point:** for content updates, skill `frontify-migrate` (hub path), reusing `raw/` unless the source changed.
- **Update ~16:50 UTC:** re-imported locally with descriptive image names (`/assets/tuimagiclife/…`, overrides in `migration-work/frontify-portal-162/image-names.json`), regression-checked locally (0/35 offsets). Page + nav re-uploaded to DA (`.tuimagiclife/<name>-<hash>`), previewed on main (admin 200); render check of the preview not possible (401). Live still shows the 12:22 publish.

## TUI Brand Hub homepage (portal 161, added 2026-11-11)
| What | Location |
|---|---|
| Raw export (dashboard destination, portal, grid, footer, stylesheet, navigation, titles) | `migration-work/frontify-home/raw/` (`discovery/` = the one API discovery load) |
| References 1440/768/375 (`capture-v1/` = first capture with 40-element lists) | `migration-work/frontify-home/capture/` |
| Assets and manifest (63 images incl. logo; fonts reused) | `migration-work/frontify-home/assets/` |
| Image names (hand-checked) / generated | `migration-work/frontify-home/image-names.json` / `image-names.generated.json` |
| Link map (78 links) | `migration-work/frontify-home/link-map.{json,csv}` |
| Frontify app CSS (85dc…, hub rules identical to 895a…) | `migration-work/frontify-home/app-css/` |
| Local render check | `migration-work/frontify-home/local/` |
| Content | `content/index.plain.html`, `content/brandhub/{nav,footer}.plain.html`, `content/assets/brandhub/` |
| Code | `styles/theme-brandhub.css`; `blocks/hub-cell/*` (none cells, image background/new window, cover/contain, inline buttons, space runs, contentPath); `tools/frontify-export/migrated-targets.mjs`, `discover-api.mjs`, `lookup-titles.mjs`, `upload-pages-to-da.mjs`, `da_list_media.py` |
| DA upload logs, old media list | `migration-work/preview-publish/da-upload-pages-*.json`, `da-old-media.json` |

## Resume state: homepage (2026-11-11, ~17:00 UTC)
- **Done:** detection, export, captures, images (named), import, local verification (see memory `tui-brandhub-homepage` for numbers), DA upload of `/index`, `/brandhub/nav`, `/brandhub/footer` with 63 images.
- **Open, in order:** (1) the code must reach a branch (commit + push; ask the user); (2) preview the homepage there and render-check it and the TUI MAGIC LIFE preview — needs preview access again (401 since ~16:50 UTC); (3) then delete the 45 old DA files listed in `da-old-media.json` (approved by the user once previews show every image); (4) upload `/nav` (guidelines Brand Hub → `/`) when asked; (5) publish only when asked.
- Server ports: 8099 docs, 8098 portal 162, 8097 homepage.

## Next migrations (not started)
Every out-of-scope document, hub and portal is listed with its status in `SITEMAP.md`. To start one: skill `frontify-migrate` with its URL; use a new data dir `migration-work/frontify-<document|portal>-<id>/` so existing data isn't overwritten. Another hub works with the current code. Another document first needs a path prefix and per-document chrome (see `frontify-migrate`, "Known limits"). Document 758 returned 403 to title lookups, so its content may not be readable with this login.
