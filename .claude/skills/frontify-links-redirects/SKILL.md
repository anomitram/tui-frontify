---
name: frontify-links-redirects
description: Resolve Frontify custom routes and /r/ permalinks, rewrite links to the migrated structure, and maintain the redirect map (documents) or link map (portal hubs) with migrated / not-migrated status. Use when adding or renaming pages, when links break, when the brand hub domain moves to Edge Delivery, or when asked where an old Frontify URL now points.
---

# Routes, permalinks, link rewriting and redirects (documents and portal hubs)

**Parameters (generic):** `HOST`, `documentId` (documents) or the hub data dir and route (hubs). Hard rules apply: stop on `/auth`, 401, 403 or 405; one request at a time.

## Resolving Frontify URLs
| Form | How to resolve | Notes |
|---|---|---|
| `{HOST}/<route>` | `GET /api/custom-route/<route>` → `data.destination_view`, `data.destination_route.route` | `tuimagiclife` → `hub`, `["hub", 162]` (verified) |
| `{HOST}/r/<token>` | `GET /api/permanent-link/<token>` → `data.url` | `/r/` itself returns only the app shell. Document 396 tokens that point into the document are also in the export, so they resolve offline |
| `{HOST}/document/<id>#/<cat>/<slug>[/<heading>]` | parse; hash routes never reach a server | `cat` `-` means no category |
| titles of targets | `/api/document/<id>` or `/api/portal/<id>` | can return 403 on documents the login can't read (document 758). Report the URL, then on the user's choice skip titles (`SKIP_TITLES=1`) and take labels from `/api/document/navigation/{portal}` or the link text |

Hub: `node tools/frontify-export/resolve-permalinks.mjs <dir>/raw/permalinks.json /r/<token> [/r/<token>…]` (paced by `EXPORT_PAUSE_MS`; add `SKIP_TITLES=1` to skip title lookups).

## Rewrite rules
Documents: `rewriteLink()` in `tools/importer/utils/frontify.js`. Hubs: `resolveLink()` in `tools/importer/utils/hub.js`.

| Source link | Result |
|---|---|
| `{HOST}/document/{doc}#/{cat}/{slug}[/{heading}]` inside the migrated document | `/{cat}/{slug}[#{heading}]` |
| `{HOST}/r/<token>` to a migrated target | the migrated path |
| anything else on `{HOST}` (other documents, hubs, portals, collections, `/dashboard`), including resolved `/r/` | absolute resolved URL (never `/r/`), listed as out of scope |
| relative `/document/...` | made absolute to `{HOST}` |
| `https://name@domain.tld` (a source bug) | `mailto:` |
| link with url `null` and an email address as text | `mailto:`; otherwise text only, noted in the report |
| leading or trailing spaces in a link | moved outside the `<a>` (hub: a trailing no-break space keeps a zero-width space after it) |

## Maps
- **Document** (`build-sources.mjs`): `migration-work/frontify/redirect-map.json`/`.csv` with every old URL → new path (types: document root, page hash route, page permalink, heading anchor, heading permalink), and `redirects-sheet.csv` (`Source,Destination`) with the server-side `/r/` entries.
- **Hub** (`build-hub-sources.mjs`): `<dir>/link-map.json`/`.csv` with `Old URL, Resolved target, Title, Status, Used in`. Status is `internal (this page)` (with the migrated path) or `out of scope (not migrated)`; when a target gets migrated, set its status and path in the builder's link-map logic. No redirect sheet: the hub's `/r/` targets are in other documents.
- Copy the not-migrated targets into `docs/tui-brandhub/SITEMAP.md` so the status list stays complete.

## Steps
1. After a new export, run the source-pages builder (it regenerates the maps), re-import the affected pages (skill `frontify-block-mapping`), then verify (`verify_migration.py`: `internal_link_issues` 0; `verify_hub.py`: links). Review the out-of-scope list.
2. Hash routes: the `/document/{doc}` page (template `redirect`) maps `#/cat/slug/heading` in the browser.
3. Server-side redirects work only once the old domain points at Edge Delivery. Load `redirects-sheet.csv` into the site's redirects only then, and only when asked.
4. Renaming a document page: keep the old path in the redirects sheet, and update `/sidebar` by re-importing the first page (it emits the chrome documents).
5. When a previously out-of-scope target gets migrated: neither rewriter knows it yet. Teach `rewriteLink()` / `resolveLink()` (and the hub builder's link-map status) the new path, rebuild, re-import the pages that link to it, and update its status in `SITEMAP.md`.

## Checks
- Every `#anchor` is a heading slug of its page, taken from `/sidebar`.
- No `href` in `content/` points at `/r/` (verified 2026-11-11: 0). The `Original Permalink` page metadata keeps each document page's own `/r/` token on purpose, as the source of the redirect sheet.
- Test redirects locally, e.g. `/content/document/396#/colour/core-palette/hero-colour` should land on `/content/colour/core-palette#hero-colour`.
