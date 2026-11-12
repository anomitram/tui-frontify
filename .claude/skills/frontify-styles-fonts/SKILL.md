---
name: frontify-styles-fonts
description: Extract design tokens, appearance and fonts from a Frontify document or portal hub and turn them into EDS CSS (styles/styles.css, styles/fonts.css, styles/theme-<route>.css, styles/hub.css). Use when porting a new Frontify document or portal, when a page's colours, type scale, buttons or header look off, or when fonts are missing or wrong.
---

# Frontify styles, appearance and fonts

**Parameters (generic):** `HOST`, `DOC_ID` or `PORTAL_ID`, `LANG`, the font project ids, and the data dir. Run `frontify-migrate` first to know the model. Hard rules from AGENTS.md apply.

## Sources per model
| What | Document (e.g. 396) | Portal hub (e.g. 162) |
|---|---|---|
| Stylesheet (CSS text with `@font-face` and typography) | `/api/guideline-stylesheets/document/{doc}` | `/api/guideline-stylesheets/portal/{portal}?language={lang}` |
| Design settings (type scale, accents, buttons) | GraphQL `getGuidelineDesignSettings`, captured in `capture/<id>/graphql.json` | the portal stylesheet's hub rules |
| Layout and header | GraphQL `GetDocumentPageThemeSettings` (sidebar, header, content width) | `/api/portal/{portal}/appearance` + the captured `styles.json` rects |
| Font lists | `/api/portal/{portal}/font-families`, `/font-styles` | same endpoints for the hub's portal |
| Logo / cover | theme logo (doc export) | `/api/portal/{portal}/theme-asset/cover` (real file name) |
| Grid and cell rules | — | Frontify app CSS `cdn.frontify.com/css/frontify-bootstrap.*.css` (URL from the captured HTML) |

All these endpoints are fetched by the export (`export.mjs` / `export-hub.mjs`) into `<dir>/raw/`. Don't fetch them again by hand.

## Steps
1. **Fonts:** read the `@font-face` rules in the stylesheet. Each source URL carries a `project_id=`; keep only the projects the stylesheet declares (doc 396: `projectId` 540 plus brand-essentials; portal 162: `HUB_FONT_PROJECTS=1516,1650`).
   - Download them with the assets step (`frontify-assets`). `/api/font-file/{id}` ignores `format=`, so request only the declared (id, format) pairs.
   - Publish as `fonts/<prefix>-<family>-<weight>-<style>.<ext>` (doc 396: `ambit-*`, `brand-*`; portal 162: `mlife-*`), declared in `styles/fonts.css`. A per-portal prefix keeps two portals' cuts of the same family apart.
2. **Document tokens:** map the design settings to CSS variables in `styles/styles.css` (type scale, accents, buttons, layout). The doc 396 values are in AGENTS.md "Brand rules".
3. **Portal theme:** write `styles/theme-<route>.css`, scoped to `body.<route>`.
   - Colours, typography and buttons from the portal stylesheet; header geometry from the capture at each width.
   - The header is themed only through CSS variables (`--header-background`, `--header-link-*`, `--header-logo-*`, `--header-inner-*`, `--header-tools-reserve`); never fork `blocks/header`.
   - `scripts/hub.js` `loadHubTheme()` loads `styles/hub.css` and `styles/theme-<Theme metadata>.css`.
4. **Hub grid and cells:** extract the exact rules from Frontify's app CSS with `python3 -I tools/frontify-export/extract_css_rules.py <frontify-bootstrap.css> <out.css> <selector regex…>` (keeps the `@media` context; portal 162 output is in `migration-work/frontify-portal-162/app-css/`) and port them, scoped, into `styles/hub.css` (grid: `.p-row`, `.p-col--N`, breakpoints 768/992px) and `blocks/hub-cell/hub-cell.css` (`.pb-text-image__*`, `.cm-image-legacy`). This is more exact than measuring rendered pages.
5. **Inline text styles** (hub cells): Quill inline font sizes, colours, alignment and `custom1/2` classes travel in the cell's `Styles` row; they are not theme tokens.

## Checks
- Every font a page uses resolves locally (no request to Frontify hosts at runtime; `verify_migration.py` / `verify_hub.py` report 0 runtime dependencies).
- Font files are signature-checked (`check_signatures.py`); the source sends no checksum, so call them "signature-checked", not "verified".
- Compare computed styles of headings, body, links and buttons with the capture's `styles.json` at every captured width.
- Brand colours must come from the palette (AGENTS.md); there's no black in the TUI palette.
