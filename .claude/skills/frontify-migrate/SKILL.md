---
name: frontify-migrate
description: Entry point for migrating any Frontify-hosted page to Edge Delivery. Detects whether a URL is a guideline document (pages, sections, blocks) or a portal hub (grid rows and cells), then runs the frontify-* skills in the right order with the right parameters. Use first for any Frontify URL, custom route, /document/<id> or /hub/<id>, and when resuming or extending the TUI Brand Hub migrations.
---

# Frontify migration: detect the model, then run the steps

**Parameters (generic):** `HOST` (e.g. `https://tui-brandhub.com`), the source URL, a data dir (`migration-work/frontify` for document 396, `migration-work/frontify-<model>-<id>/` for new work), and the language (`en`).
The hard rules in AGENTS.md apply throughout: stop and report on `/auth/`, 401, 403 or 405; one request at a time, 1.5–2 s apart; never two jobs at once.

## 1. Detect the content model (one request at most)
| URL form | Model | Ids |
|---|---|---|
| `{HOST}/document/<id>[#/<cat>/<slug>]` | document | `documentId` = `<id>`; `portalId` = `document.portal_id`; `projectId` = any `page.project_id` |
| `{HOST}/hub/<portalId>` | portal hub | `portalId` |
| `{HOST}/<route>` (one path segment, not `api`, `r`, `auth`, `dashboard`) | resolve it | `GET {HOST}/api/custom-route/<route>` |
| `{HOST}/r/<token>` | resolve it | `GET {HOST}/api/permanent-link/<token>` → `data.url`, then detect again |
| `{HOST}/` (site root, the "dashboard") | portal hub | `GET {HOST}/api/dashboard/portal-destination` → `data.portal_id` (TUI Brand Hub: 161). Export with `HUB_DASHBOARD=1`; page path `/index` (`PAGE_PATH=/index`), chrome/theme name chosen freely (`brandhub`) |

Unknown view? Run `tools/frontify-export/discover-api.mjs <url> <dir>` once: one browser load that lists the JSON APIs the app calls and saves only content APIs (never session, CSRF, user or token responses).

`/api/custom-route/<route>` returns `data.destination_view` and `data.destination_route.route`:
- `destination_view: "hub"`, `route: ["hub", <portalId>]` → portal hub (verified: `tuimagiclife` → portal 162).
- Any other value → read `destination_route.route` and map it to the forms above. A `document` destination has not been seen yet (unverified), so record the raw response in `<dir>/raw/custom-route.json` and confirm before going on.
- `has_missing_destination: true` → stop and report; there's nothing to migrate.

Record the result (model, ids, route) in `docs/tui-brandhub/CONTEXT.md` (resume state) and `docs/tui-brandhub/SITEMAP.md` (status "in progress").

## 2. Run the steps in order

| Step | Document | Portal hub |
|---|---|---|
| Export JSON | `frontify-export` (document) | `frontify-export` (hub) |
| Reference capture | `frontify-export` capture, 1440 + 390 | `frontify-export` capture, 1440 + 768 + 375 |
| Styles and fonts | `frontify-styles-fonts` (document design settings) | `frontify-styles-fonts` (portal stylesheet, appearance, `theme-<route>.css`) |
| Assets | `frontify-assets` (`assets.mjs`) | `frontify-assets` (`assets-hub.mjs`) |
| Links | `frontify-links-redirects` (offline tokens, redirect sheet) | `frontify-links-redirects` (`/api/permanent-link`, link map) |
| Source pages + import | `frontify-block-mapping` (`build-sources.mjs`, :8099, `import-guideline-page.js`) | `frontify-block-mapping` (`build-hub-sources.mjs`, :8098, `import-hub-page.js`) |
| Verify | `frontify-visual-verify` (`verify_migration.py`, `visual_compare.py`) | `frontify-visual-verify` (`verify_hub.py`, `hub-compare-rects.js`, `hub-shot-local.js`) |
| New authored pages | `tui-new-page` | `tui-new-page` (hub section) |

New block types or hub cell layouts: add a parser and a block, then update the tables in `frontify-block-mapping`.

## Single-page documents shown as a cover page (new document theme) — supported since 2026-11-12
A document with one page and no sidebar (e.g. The Mora, document 1896 → `/the-mora`) uses its own pipeline; it doesn't touch document 396's chrome:
1. Agree the path with the user. Add the document to `frontify.config.json` `migrated.documentPages` (every link to it becomes local).
2. Export: `FRONTIFY_DOC_ID=<id> FRONTIFY_PORTAL_ID=<portal> FRONTIFY_PROJECT_ID=<font project> node tools/frontify-export/export.mjs <dir>/raw`; also save `/api/document-page/<pageId>/template-asset` → `raw/template-asset.json`, `/api/portal/<portal>/theme-asset/documentPage` → `raw/theme-asset-documentPage.json`, and the theme GraphQL `GetDocumentPageThemeSettings` (via `discover-api.mjs`) → `raw/graphql-page-theme.json`. Resolve `/r/` links with `resolve-permalinks.mjs` → `raw/permalinks.json`.
3. Capture: `capture-hub.mjs <url> <dir>/capture` and `capture-doc-layout.mjs <url> <dir>/capture` (per-section grid, padding, background; per-block parts). Colour schemes: `extract_section_schemes.py <dir>/capture/1440.html <dir>/raw/section-schemes.json`.
4. Assets: `ASSETS_CONCURRENCY=1 ASSETS_PAUSE_MS=1500 FRONTIFY_PROJECT_ID=<font project> node tools/frontify-export/assets.mjs <dir>/raw <dir>/assets`, then `strip_signed_urls.py`.
5. Build + import: `[PAGE_PATH=/<route>] SOURCE_PORT=8096 node tools/frontify-export/build-doc-cover-sources.mjs <dir> <dir>/source-pages content <route>`, serve on 8096, bundle `tools/importer/import-doc-cover-page.js`, run with `urls-doc-cover-<route>.txt`. Theme: `styles/theme-<route>.css` = hand-written header part + generated `fonts.generated.css` + `schemes.generated.css`; generic rules in `styles/doc-cover.css` (`write_doc_cover_css.py`).
6. Blocks: `text` (cell variant + Styles row), `image`, `divider`, `cards-grid`, `slider`; template `scripts/doc-cover.js`.

Measured Frontify behaviour: sections stack below a 640px content width; Cards Grid columns 1/2/4 at block width 440/740px; Slider 1 slide ≤768px viewport (Splide breakpoints).

## Known limits before a further migration (checked 2026-11-11; cover pages solved 2026-11-12)
- **Another multi-page document (with sidebar):** the document pipeline was built for a single document at the site root. The ids are parameters, but:
  - the chrome documents are site-wide: `/nav`, `/sidebar`, `/index`, `/document/<id>`
  - `scripts/guideline.js` always loads `/sidebar`; the header falls back to `/nav` without `Nav` metadata
  - page paths `/<cat>/<slug>` can clash with document 396's
  - `verify_migration.py` reads only `migration-work/frontify/`
  
  Before importing, agree a path prefix with the user (e.g. `/<document-slug>/<cat>/<slug>`). Then add per-document `Nav`/`Sidebar` metadata, as hubs use `Nav`/`Footer`, and a data-dir argument to the verifier. Never overwrite document 396's chrome.
  - **Solved for the new document theme (2026-11-12, The Mora docs 1887/1888/1889/1893):** `build-doc-theme-sources.mjs <base> <srcDir> content <route> <docId>=<prefix> …` (paths, redirect maps for `migrated-targets.mjs` — register the docs in `frontify.config.json` `migrated.documents` first —, schemes per page from `extract_section_schemes.py` on each capture, images per page, per-page `resolvedSettings`), `import-doc-theme-page.js` (pages + `<prefix>/sidebar` + `<prefix>` redirect), template `guideline` with `Layout: doc-sections`. Capture all pages with `capture-doc-pages.mjs` (one load, hash routing). Verify with `doc-compare-sections.js`, `text_coverage.py`, `check_local_refs.py`. Libraries (`library_document`): `export-library.mjs`, `library-thumbs.mjs`, `library-collages.mjs`, `build-library-sources.mjs`, `import-library-page.js`. Details: `docs/tui-brandhub/CONTEXT.md`, "The Mora documents and libraries".
- **Another hub:** supported as is. It needs a new `styles/theme-<route>.css`, its own `/<route>/nav` and `/<route>/footer`, a `urls-hub-<route>.txt`, and a new data dir. Check that the header variables cover its header; if not, add variables rather than forking the block.

## 3. Scope and exclusions (both models)
- Migrate only the requested page or document. Every other Frontify target (documents, hubs, portals, collections, `/dashboard`) stays an absolute link to its resolved URL (never `/r/`) and is listed as out of scope in the report and in `SITEMAP.md`.
- Ask the user up front about features that can't be reproduced on Edge Delivery (search, the Brand Assistant AI, Intercom, analytics, view tracking). The portal 162 run excluded all five by request.
- If something can't be reproduced exactly, build the closest faithful version and flag it as not matched.

## 4. Remote steps (only when asked in the current message)
1. Check that the branch serves the code the page needs (each block/script/theme file returns 200 on `<branch>--<site>--<org>.aem.page`, and matches local with `curl --compressed`). If not, report it; the code must be pushed.
2. Keep local images as `/assets/…` with descriptive names; the platform's Sync copies them into each page's DA media folder as `<name>-<hash>`. Never write `content.da.live` URLs into local pages. To upload yourself: `node tools/frontify-export/upload-pages-to-da.mjs <org> <repo> <pages…>` (same convention; reads each file back). Before deleting old DA copies, record them with `da_list_media.py` and delete only after the preview render check shows every image.
3. Upload, preview, then run the render check against the preview (published markup has icon spans and `media_*` images). Publish only if it passes.
4. After publishing, re-check live with several requests and look at `last-modified`; a CDN node can serve the old copy for up to 2 h.
5. Log every job in `migration-work/preview-publish/last-job.json`. Tell the user which surfaces changed: local, DA, preview, live.

## 5. Persist what you learned
Update memory (source facts, results, lessons, open issues), `CONTEXT.md` (resume state) and `SITEMAP.md` (status) at the end of each run. Update existing entries instead of adding duplicates.
