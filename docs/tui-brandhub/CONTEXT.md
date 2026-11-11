# TUI Brand Hub migration: reference context

Updated 2026-11-11. Pointers only; no copies of data. Rules are in `AGENTS.md`, procedures in `.claude/skills/frontify-*`.
Revisit when the Frontify source is edited after 2026-11-10 (latest `modified` in `migration-work/frontify/raw/pages.json`), or when any path below moves.

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
| Site map | `docs/tui-brandhub/SITEMAP.md` (regenerate: `tools/frontify-export/write_sitemap.py`) | |
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

## Resume state (2026-11-11)
- **Done:** export (84 pages), reference capture (82 valid views), assets (560 source + 10 derived), blocks/frame, import (84/84 local), content/link/asset verification, visual comparison, 6 oversized images resized.
- **Remote:**
  - Document Authoring has all pages: the user uploaded them; the 6 resized images were uploaded on 2026-11-11.
  - Preview ran on branch `aem-20261111-0835` for 89 paths, all OK after the fix.
  - **Published:** only the 6 resized pages on that branch. Publish state of the other 83 is unknown and wasn't checked.
- **Partial or open:** see memory `tui-frontify-open-issues`. Nothing is half-written in content.
- **Restart point:** the next step depends on the request.
  - For content updates: re-export (skill `frontify-export`), then `build-sources` → import (skill `frontify-block-mapping`) → verify.
  - Existing data is reusable; don't re-scrape unless the source changed.

## TUI MAGIC LIFE portal home (portal 162, added 2026-11-11)
| What | Location |
|---|---|
| Raw export (route, portal, grid, footer, appearance, fonts, stylesheet, navigation, permalinks) | `migration-work/frontify-portal-162/raw/` |
| Reference captures 1440/768/375 (+ html, styles, hover states) | `migration-work/frontify-portal-162/capture/` |
| Assets and manifest (65 files) | `migration-work/frontify-portal-162/assets/` (`manifest.json`, `font-faces.json`) |
| Frontify app CSS (grid/cell rules, reference) | `migration-work/frontify-portal-162/app-css/` (`hub-rules.css`) and `hub-typography.css` |
| Link map (27 outgoing links) | `migration-work/frontify-portal-162/link-map.{json,csv}` |
| Verification | `migration-work/frontify-portal-162/verification.json`, `visual-report.json`, `rects-<w>.txt`, `local/` |
| Import source / importer | `migration-work/frontify-portal-162/source-pages/` (:8098); `tools/importer/import-hub-page.js`, `parsers/hub-*.js`, `utils/hub.js` |
| Site code | `scripts/hub.js`, `styles/hub.css`, `styles/theme-tuimagiclife.css`, `blocks/hub-cell`, `blocks/hub-divider`, fonts `fonts/mlife-*` |
| Content | `content/tuimagiclife.plain.html`, `content/tuimagiclife/{nav,footer}.plain.html`, `content/assets/cell-*`, `content/assets/theme-logoAsset-171919` |

Resume state (2026-11-11): migrated and verified.
- Uploaded to DA: page, nav, footer and 15 images under `/assets/`.
- Previewed and published on branch `aem-20261111-0835`. The code is on that branch only, not on `main`.
- Local page images now reference `content.da.live`.
- Upload helper: `tools/frontify-export/upload-to-da.mjs`.
