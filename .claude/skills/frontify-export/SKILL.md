---
name: frontify-export
description: Authenticated, rate-safe export of a Frontify guideline document (navigation, pages, sections, blocks, styles, colour data) or a portal hub (grid rows and cells, portal settings, navigation, footer), plus reference screenshots. Use when (re-)exporting TUI Brand Hub document 396, the TUI MAGIC LIFE hub (portal 162) or another Frontify document or portal, refreshing source data after edits, or re-capturing references.
---

# Frontify export (documents and portal hubs)

**Parameters (generic):** `tools/frontify-export/frontify.config.json` (`host`, `documentId`, `portalId`, `projectId`, `language`, `dataDir`; currently document 396). Override one run with `FRONTIFY_HOST`, `FRONTIFY_DOC_ID`, `FRONTIFY_PORTAL_ID`, `FRONTIFY_PROJECT_ID`, `FRONTIFY_LANGUAGE`; hubs also take `HUB_ROUTE`.
- Detect the model first (skill `frontify-migrate`).
- Document: `projectId` is any `page.project_id`; `portalId` is `document.portal_id`.
- Hub: `portalId` comes from `/api/custom-route/<route>` (`destination_route.route[1]`) or the `/hub/<id>` URL. Data dir `migration-work/frontify-portal-<id>/`.

## Before you start (both)
1. **Auth:** the workspace proxy injects the session header for the host. Never handle cookies.
   - Probe once: `curl -s -o /dev/null -w '%{http_code}' $HOST/api/document/$DOC` (hub: `$HOST/api/portal/$PORTAL`).
   - 200: go ahead.
   - Redirect to `/auth/`, or 401/403: STOP, report the URL, and tell the user to check the protected-site header in tool settings.
   - 405 or `<title>Human Verification`: STOP. The bot check is active; report it and wait for the user. Never try to solve it.
2. **Pacing:** one job at a time; API calls 1.5–2 s apart (`EXPORT_PAUSE_MS`), page loads 20 s apart (`PAGE_DELAY_MS=20000`).
3. **Browsers need the proxy explicitly:** pass `PROXY_SPKI` and `HTTPS_PROXY`; the capture scripts use both.
   - Node `fetch` and curl already trust the proxy.
   - Compute the key: `openssl x509 -in "$NODE_EXTRA_CA_CERTS" -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`.
   - `PW_PATH=/home/node/.excat-marketplaces/excat-marketplace/excat/skills/excat-scrape-webpage/scripts/node_modules/playwright`.

## Document export
1. `node tools/frontify-export/export.mjs migration-work/frontify/raw` calls, in order:
   - `/api/document/{doc}` and `/api/document-navigation/{doc}`
   - `/api/document-page?document_id={doc}&language={lang}` (all pages in one response, no pagination)
   - `/api/guideline-stylesheets/document/{doc}`
   - `/api/portal/{portal}/appearance`, `/font-families`, `/font-styles`
   - `/api/portal-navigation/{portal}`, `/api/portal/{portal}`, `/api/portal/{portal}/footer`
   - one `/api/document/page/-/{pageId}` per page

   It exits with code 3 on an auth or bot-check failure.
2. Capture: `PAGE_DELAY_MS=20000 node tools/frontify-export/capture.mjs migration-work/frontify/raw migration-work/frontify/capture [pageIds]`.
   - Desktop (1440) and mobile (390) full-length screenshots, the rendered `<main>` HTML, `styles.json` (tab title) and `graphql.json`.
   - Colour swatches exist only in the GraphQL capture (`getColorBlockColors`); design tokens are `getGuidelineDesignSettings`, `GetDocumentPageThemeSettings`, `getListStyles` (see `frontify-styles-fonts`).
   - SPA routes: `/document/{doc}#/{categorySlug}/{pageSlug}`; uncategorised pages use `#/-/{slug}`. Skips pages already captured correctly.

## Hub export
1. `FRONTIFY_PORTAL_ID=<id> HUB_ROUTE=<route> node tools/frontify-export/export-hub.mjs <dir>/raw` calls, in order:
   - `/api/custom-route/{route}` (skipped without a route)
   - `/api/portal/{portal}?language={lang}`, `/api/hub/grid/{portal}`, `/api/portal/{portal}/footer`
   - `/api/portal/{portal}/appearance`, `/font-families`, `/font-styles`, `/theme-asset/cover`
   - `/api/guideline-stylesheets/portal/{portal}?language={lang}`
   - `/api/document/navigation/{portal}?language={lang}` (the portal's documents, for the header) and `/api/portal-navigation/{portal}`
2. **Grid model** (`grid.json`): `rows{rowId: {settings, data{cellKey: cell}}}`.
   - Row settings: `width`, `content_width`, `margin` (the gutter), `margin_top`, `margin_bottom` (percent of width), `background`. Order rows by their cells' `sort`.
   - Cell: `block_type` `TEXTIMAGE|DIVIDER|NONE`, `width` 1–12, `teaser` (cell id), `settings`. Mapping: skill `frontify-block-mapping`.
   - `preview_content` is the editor's placeholder; never render it.
3. Capture: `PW_PATH=… PROXY_SPKI=… HTTPS_PROXY=… PAGE_DELAY_MS=20000 node tools/frontify-export/capture-hub.mjs <host>/<route> <dir>/capture [1440,768,375]`.
   - Per width: screenshot, rendered HTML, `styles.json` (element rects and computed styles); plus `hover-states.json` and `hover-<n>.png` for buttons.
   - The rendered HTML names the Frontify app CSS (`frontify-bootstrap.*.css`) used by `frontify-styles-fonts`.

## Both
- Frontify scrolls an inner element, so the capture scripts grow the window to the content height before each screenshot. `vh` units are therefore huge in references; local shots must do the same.

## Checks
- Document: `raw/page-failures.json` is empty, and page count = navigation page count. Every `capture/<id>/styles.json` title starts with that page's own title; a generic "<document> - <portal>" title means the capture failed, so re-capture that id alone.
- Hub: every row and cell in `grid.json` has a sort and a known `block_type`; the capture exists at all three widths.
- Look at one screenshot per batch: "Human Verification" or "Something went wrong" means the source failed. Stop and don't trust that capture.
- Re-export if the source was modified after the last export (`raw/pages.json` `modified`; hub: `custom-route.json`/`portal.json` `modified`).
