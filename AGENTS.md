# AGENTS.md

Edge Delivery Services. Read a block first. Omissions are in the repo or known.

## Avoid
- `scripts/aem.js` is vendored. Never edit.
- Markup comes from the backend. `curl localhost:3000/x.plain.html` first.
- `buildAutoBlocks` rewrites content before your block runs.
- Authors omit and add cells. Decorate defensively.
- No build step; devDependencies only.
- Scope CSS to `.blockname`; `-wrapper`/`-container` are section classes.
- `fragment/fragment.js` is the only cross-block import. Otherwise use `/scripts/`.

## Outdated
- `fstab.yaml`, `helix-query.yaml`, `paths.json` are retired. Config lives at tools.aem.live.

## Remember
- `npx -y @adobe/aem-cli up`: local code, previewed content.
- Merging `main` ships code; content publishes separately.
- A PR without a `{branch}--tui-frontify--anomitram.aem.page/{path}` link is rejected.
- All committed files are served. Use `.hlxignore`.
- Skills: `/plugin marketplace add adobe/skills`, then `aem-edge-delivery-services` (24 skills, incl. `docs-search`).

## TUI Brand Hub (migrated from Frontify: document 396, portal 162 home, homepage = portal 161)
Reference: `docs/tui-brandhub/CONTEXT.md` (file locations, glossary, resume state) and `docs/tui-brandhub/SITEMAP.md` (status per page, document and portal).
Procedures: start with skill `frontify-migrate`, which detects document vs hub and orders the rest:
`frontify-export`, `frontify-styles-fonts`, `frontify-assets`, `frontify-block-mapping`, `frontify-links-redirects`, `frontify-visual-verify`; `tui-new-page` for new pages.

### Frontify-hosted sites: rules that held in both migrations (2026-11-10/11)
- Frontify is a single-page app. Read the same-origin JSON APIs; use a browser only for reference captures.
- Detect the page model first. `/document/<id>` is a document. `/hub/<id>` or `/<route>` (resolve with `/api/custom-route/<route>`) is a portal hub. The site root `/` is the dashboard: `/api/dashboard/portal-destination` names the hub it shows (TUI Brand Hub: portal 161).
- Import offline from local source pages built from the export; never import from the live site.
- Scope is the requested page or document only. Links elsewhere point at the resolved Frontify target (never `/r/`) and are listed as out of scope.
- Keep local images under `/assets/` with meaningful file names: documents `/assets/<key>/<url-safe original name>`; hubs `/assets/<route>/<descriptive-name>` (Frontify hub images only have random ids, so names come from `image-names.json` overrides, the cell heading or the link target). Never write `content.da.live` URLs into local pages: the platform's Sync copies local images into each page's DA media folder as `<local name>-<hash>`, so random local names become random DA names. `upload-pages-to-da.mjs` follows the same convention.
- Test scripts must add a doctype, because the local preview runs in quirks mode. Grow the window to page height, as the reference capture does.
- Before any preview, check that the branch serves the code the page needs. After publishing, re-check live from several requests, because a CDN node can stay stale for up to 2 h.
- Published markup differs from local: `:icon:` text becomes `<span class="icon">`, and images become `media_*`. Code must handle both forms.

### Brand rules for every page
- Text colour: TUI Deep Blue `#1B115C`. The palette has no black; use Deep Blue for black.
- Core colours: TUI Red `#D40E14`, TUI Sky Blue `#70CBF4` (hero colour), TUI Deep Blue `#1B115C`, TUI Energy Blue `#3567F6`.
  Energy Blue is digital only; use CMYK 93/60/0/0 for print.
- Sky Blue tints: 60% `#A9E0F8`, 40% `#C6EAFB`, 20% `#E2F5FD`, 10% `#F1FAFE`.
- Callout accents: info `#3567F6`, note `#F39300`, tip `#30B675`, warning `#D40E14`.
  The light appearance uses the accent as text on a 10% tint.
- Type scale (line-height 1.3):

  | Element | Font | Size | Notes |
  |---|---|---|---|
  | h1 (page title) | Ambit Bold | 40px | weight 700 |
  | h2 (sidebar section heading) | Ambit Bold | 22px | weight 400 |
  | h3 | Ambit SemiBold | 18px | |
  | h4 | Ambit SemiBold | 16px | margin-bottom 5px |
  | h5 (Frontify "custom1") | TUITypeLtRg_W | 16px | bold |
  | body | TUITypeLtRg_W | 15px | paragraph margin 0 |
  | link | Ambit Regular | 15px | `#3567F6`, underlined |
  | quote | Ambit Regular | 24px | `#B9B9B9` |
  | image title | Ambit Regular | 15px | |
  | image caption | TUITypeLtRg_W | 13.5px | |

- Layout:
  - left rail 61px `#F8F8F5`, header 90px Sky Blue
  - sidebar 220px, content column 800px plus 50px padding on each side
  - 10px scrollbar gutter
- Spacing: section padding 16px top and bottom; 30px gap between blocks.
  Use empty paragraphs for extra space, as the source does.
- Buttons: Ambit SemiBold 16px, padding 10px 20px, radius 30px, Energy Blue fill; Sky Blue on hover.
- Logo (source: Logo Misuse page):
  - use only colours from the core palette
  - don't distort or rotate it, outline it, or add gradients or effects
  - don't resize the text lock-up or add information to it
  - don't distort, detach or translate the Live Happy lock-up
- Tone of voice pillars: Positive energy, Bold expertise, Insightful edge.
  Read `/tone-of-voice/*` before writing copy. Further detail is unverified.

### Migration conventions: document pages (document 396)
- Page paths: `/<category-slug>/<page-slug>`, or `/<slug>` without a category.
  - Keep Frontify slugs exactly, including `-1` suffixes.
  - Heading ids are the Frontify heading slugs; the sidebar matches them by text.
- Structure:
  - One Frontify section = one EDS section.
  - An empty section keeps a `Section Metadata | Style | empty` marker.
  - The page title (h1) sits in its own first section.
- Templates (metadata `Template`):
  - `guideline` builds the sidebar, pagination, "Last modified" and go-to-top from `/sidebar`.
  - `redirect` is used for `/` and `/document/396`.
- Assets:
  - Path: `/assets/<manifest-key>/<url-safe file name>`. Spaces become `-`, other symbols `_`.
  - The original file name is the link text or download name.
  - Images must stay ≤ 18 MB (Edge Delivery's limit is 20 MB).
- Links:
  - Links within this document are rewritten to new paths.
  - `/r/<token>` links that point to this document resolve offline (the tokens are in the export); old URLs go to the redirect sheet.
- Local preview serves content under `/content/`. Use `contentPath()`/`localizeLinks()` from `scripts/scripts.js`.

### TUI MAGIC LIFE portal (Frontify portal 162, page `/tuimagiclife`, template `hub`, theme `tuimagiclife`)
Tokens are in `styles/theme-tuimagiclife.css`, from the portal 162 hub stylesheet (2026-11-11).
- Colours:
  - yellow `#FFF500` (header)
  - navy `#00264F` (text and headings)
  - turquoise `#81D7E4` (section background)
  - pink `#FF3E86` (support section)
  - link `#2BB4CA`
- Fonts: Ambit for headings and the header; TUI Type 17px/1.2 for body text; TUI Type Light 14px for buttons.
- Headings: h1 44px, h2 32px (70px top margin), h3 22px, h4 18px.
- Buttons: padding 10px 20px, radius 5px.
  - primary `#50C7DA`, hover `#2BB4CA`
  - secondary `#003166`, hover `#00264F`
- Layout: the grid is ported 1:1 from Frontify in `styles/hub.css`.
  - Column widths step at 768px and 992px.
  - Rows are sections with `hub-row` metadata; cells are `hub-cell` / `hub-divider` blocks.

### Migration conventions: portal hub pages (differences from documents, verified on portals 162 and 161)
- Path `/<route>`, with per-portal `/<route>/nav` and `/<route>/footer` named in page metadata (`Nav`, `Footer`).
  The homepage (portal 161) is `/index` (= `/`) with theme and chrome `brandhub` (`/brandhub/nav`, `/brandhub/footer`); the guideline chrome no longer writes `/index`.
- Links to migrated targets become local paths (`tools/frontify-export/migrated-targets.mjs`, config `migrated`): document 396 pages, `/tuimagiclife`, and the dashboard / hub 161 → `/`. Everything else stays on Frontify.
  Metadata: `Template: hub`, `Theme: <route>` (loads `styles/theme-<route>.css`).
- No sidebar, pagination, headings or anchors. One grid row = one section; each cell = one block, with `w-<1..12>` for its width.
- `scripts/hub.js` applies Section Metadata itself before blocks load.
- The cell DOM and CSS are rebuilt 1:1 from Frontify's app CSS. Inline text styles travel in a `Styles` row.
- `/r/` targets on a hub sit in other documents: resolve them with `/api/permanent-link/<token>` and record them in the link map (no redirect sheet).
- Search, Brand Assistant, Intercom, analytics and view tracking are excluded. The header keeps the excluded icons' space (`--header-tools-reserve`).

### The Mora portal (Frontify portal 292, under `/the-mora`, theme `the-mora`, all local only)
- `/the-mora` = cover document 1896 (template `doc-cover`). Documents 1887/1888/1889/1893 = `/the-mora/{brand,hotels,support,libraries}/<cat>/<page>` (template `guideline` + `Layout: doc-sections`, metadata `Sidebar`, `Nav: /the-mora/nav`, `Pagination: hide`/`Sidebar: none` from Frontify's per-page settings). Libraries 1891/1892/1894/1908 = `/the-mora/libraries/<name>` (template `library`).
- New Frontify document theme: one section = one EDS section (`doc-row` + `scheme-<hash>` + Columns/Padding/Gutter); one block = one grid cell. Colour schemes are Frontify's resolved `--f-theme-settings-*` variables, shipped verbatim.
- Edit `tools/frontify-export/themes/the-mora.head.css` and `write_doc_cover_css.py`, never the generated `styles/theme-the-mora.css` / `styles/doc-cover.css`; recompose with `compose_theme.py`.
- Verify offline with `tools/frontify-export/local-render-server.mjs` (:3001) and `doc-compare-sections.js`. Details: `docs/tui-brandhub/CONTEXT.md`.

### Hard rules
- Never print, store or paste credentials, cookies, tokens or signed URLs. Auth for tui-brandhub.com is injected by the workspace proxy.
- Stop and report the URL on any of these, and never retry in a loop or work around them:
  - a redirect to `/auth/`
  - an HTTP 401 or 403
  - an HTTP 405 or a "Human Verification" page (bot check)
- One request at a time, with pauses. Never run capture and download jobs in parallel.
- If something can't be reproduced exactly, flag it as not matched. Never silently approximate.
- Re-running the importer overwrites `content/*.plain.html`; local edits are lost.
  Don't change Document Authoring, preview or publish unless asked in the current message.
