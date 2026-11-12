---
name: frontify-block-mapping
description: Map Frontify guideline blocks (documents) and hub grid rows and cells (portal hubs) to this project's EDS sections and blocks, and (re)generate pages offline through the bundled import scripts. Use when re-importing TUI Brand Hub pages or the TUI MAGIC LIFE hub, importing new Frontify pages or hubs, changing how a Frontify block type or cell layout is converted, or asking which EDS block renders which Frontify element.
---

# Frontify block mapping and import (documents and portal hubs)

**Parameters (generic):** the model (skill `frontify-migrate`), the data dir, and for documents the page ids (all by default), for hubs the route. Inputs are the exported `raw` and `capture` folders (skill `frontify-export`). Parsers live in `tools/importer/parsers/`, blocks in `blocks/`.

## Document mapping (template `guideline`)

| Frontify block (`display_name`) | EDS output | Settings → classes and rows | Edge cases |
|---|---|---|---|
| heading item (no `display_name`, has `slug`) | `h2` default content | `type_style` HEADING2 → h2 | id = Frontify heading slug; the `guideline` template gives it its own wrapper so the 30px block gap applies |
| Text | default content | — | `text` block only when `columnNumber>1` (`columns-3`) or when it directly follows another Text block; empty paragraphs become zero-width-space spacers; Slate `custom1/2` → h5/h6 |
| Callout | `callout (type, appearance, padding-x, radius-x, icon-x)` | rows `Padding`, `Radius` when custom | show the icon whenever `iconType != none`, even with `iconSwitch:false` (Frontify does); `textValue` is Slate JSON |
| Image | `image` | rows `Title`, `Caption`, `Link`, `Background`, `Border`, `Download`, `Attachments` | PDF/AI originals display the `preview-<id>` PNG; images must be ≤ 18 MB; one image has its own attachments (page 6833) |
| Video | `video (autoplay, loop, width-Npx)` | one cell: the mp4 link (+ title paragraphs) | library convention: one column, link only; ratio read from the file |
| Annotations | `annotations (mode-x, border)` | row 1 picture, then `"left% top%" \| note`, plus `Bubble`, `Caption` | positions are percentages; several bubbles per note separated by `; ` |
| Image grid | `image-grid (columns-N, border)` | row per image: picture \| title \| caption | titles can contain HTML (`<b>`) |
| Divider | `divider (solid\|no-line, height-x)` | row `Line \| 1px solid rgba()` | |
| Attachments | `attachments` | row: link \| size \| ext | titles are HTML-escaped in the source; decode them |
| Colors | `colors (card, show-<rep>…)` | header row of labels, then one row per colour | values come only from captured GraphQL; if missing, the parser logs `colors-<id>` and drops the block, so re-capture first |
| Audio | `audio (downloadable)` | `Title` row + file link | |
| Asset Kit | `asset-kit (…)` | `Title`, `Description`, `Package` (pre-built zip), then asset rows | Frontify zips kits server-side, so build zips with `build_asset_kits.py` |
| Section settings | `Section Metadata` | gutters, padding, max-width; `Style: empty` for empty sections | |

Page chrome: `/nav` (rail, logo, portal navigation, tools), `/sidebar` (navigation tree; an italic link = untitled page hidden from the sidebar but kept in pagination), `/footer` (empty), and the redirect documents `/index` and `/document/{doc}`. They come out of the first page's import (`emitChrome`).

## Hub mapping (template `hub`, theme `<route>`)

| Frontify element | EDS output | Rows / classes | Edge cases |
|---|---|---|---|
| grid row | one section with `Section Metadata`: `Style: hub-row` (`hub-row, empty` without visible cells), `Row`, `Width`, `Content Width`, `Gutter` (= `margin`), `Margin Top`, `Margin Bottom` (% of width), `Background` | — | order rows by their cells' `sort`; `scripts/hub.js` reads this metadata itself, before blocks load, and builds `.po-brandportal__row-wrap > .p-row > .p-col--N` |
| cell `TEXTIMAGE` | `Hub Cell (<layout>, w-<1..12>, text-<pos>, image-<pos>, cover, cover-mode-x)` | picture; rich text; then only when set: `Link`, `Image Link`, `New Window`, `Content Padding`, `Image Padding`, `Content Width`, `Image Width`, `Ratio`, `Overlay`, `Content Background`, `Border`, `Styles`, `Frontify Cell` | layouts `textover\|text\|image\|leftright\|rightleft\|topbottom\|bottomtop`; an image `file_id` without a file is not rendered by Frontify either (logged in notes); `Ratio` drives `.cm-image-legacy` padding-bottom |
| cell rich text (Quill HTML) | default content inside the cell | `convertCellHtml()` in `tools/importer/utils/hub.js` | `strong`/`em` links become primary/secondary buttons; inline font size, colour, alignment and `custom1/2` go to `Styles` as `n: css; css` (split on `n:` when reading, because line breaks can be lost); a trailing no-break space in a link gets a zero-width space after it |
| cell `DIVIDER` | `Hub Divider (w-<n>)` | `Line` (`<height>px <colour>`), `Padding`, `Background` (if not transparent), `Frontify Cell` | default line `1px rgb(221, 221, 221)`, padding `25px 0 25px 0` |
| cell `NONE` / `preview_content` | in a row with real cells: `Hub Cell (none, w-<n>)` (empty, keeps its column width); in an all-empty row: nothing | `Frontify Cell` | `preview_content` is editor placeholder text; an empty row still renders 1px high (`p-col` min-height) |
| cell image settings (portal 161) | `Image Background` row, `Image New Window` row, variants `cover`, `cover-mode-contain` | — | the image area links to `Image Link` (else `Link`), the text area to `Link`; `cover` + layout `image` gets `state-cover`, dropped on the holder below 768px (Frontify script); contain = `--cover-mode-contain` + `wrap--contain`; images are `display:block` (Frontify reset) |
| cell image crop | the published image file is cropped | — | `file_url` `rect=x,y,w,h&reference_width=R`: `build-hub-sources.mjs` crops the copy with ImageMagick (portal 161: 2 of 63) |
| several buttons in one paragraph or a button in a heading | buttons via `hub-cell.js` `decorateInlineButtons` | bold = primary, italic = secondary, bold+italic = accent | runs of spaces between them travel as `Styles` `n: white-space: pre-wrap; spaces: 11,10` (rendering collapses spaces) |
| portal custom page footer (`portal.footer` `{markup_, style}`) | `/<route>/footer`: copyright paragraph + link list; styles in the theme | — | portal 161 only; in Frontify it's absolutely positioned after the content, here a normal footer (page ~55px taller) |
| portal header | `/<route>/nav` (logo from `theme-asset/cover`, the portal's documents from `/api/document/navigation/{portal}`, Brand Hub icon) | metadata `Nav` | excluded tools keep their space via `--header-tools-reserve` |
| portal footer | `/<route>/footer` | metadata `Footer` | |

`hub-cell` rebuilds Frontify's `pb-text-image` DOM and its CSS is a scoped port of `frontify-bootstrap.css`; don't simplify it. The content background covers the whole text area; textover text is `position: relative`; long words break (`overflow-wrap`).

## Import steps
S=`/home/node/.excat-marketplaces/excat-marketplace/excat/skills/excat-content-import/scripts`

| Step | Document | Hub |
|---|---|---|
| 1. Build offline source pages (no requests to the source; copies assets into `content/`) | `node tools/frontify-export/build-sources.mjs migration-work/frontify migration-work/frontify/source-pages content` (also the redirect map) | `[SOURCE_PORT=…] [PAGE_PATH=/index] [ORIGINAL_URL=…] node tools/frontify-export/build-hub-sources.mjs <dir> <dir>/source-pages content <route>` (also `link-map.json`/`.csv` and `image-names.generated.json`; hand-checked names in `<dir>/image-names.json`, made by looking at the images) |
| 2. Serve them | `python3 -I -m http.server 8099 --bind 127.0.0.1 --directory migration-work/frontify/source-pages` | same with port `8098` (portal 162) or `8097` (homepage) and `<dir>/source-pages` |
| 3. Bundle | `$S/aem-import-bundle.sh --importjs tools/importer/import-guideline-page.js` | `… --importjs tools/importer/import-hub-page.js` |
| 4. Import (`--force` is required: every source URL shares one cache key) | `node $S/run-bulk-import.js --import-script tools/importer/import-guideline-page.bundle.js --urls <urls.txt or subset> --force` | `… import-hub-page.bundle.js --urls tools/importer/urls-hub-<route>.txt --force` → `/<route>`, `/<route>/nav`, `/<route>/footer` |
| 5. Verify | `python3 -I tools/frontify-export/verify_migration.py .` | `[PAGE_PATH=/index] python3 -I tools/frontify-export/verify_hub.py . <dir> <route>` |

Use different ports so one server can be stopped without `pkill -f` (which can kill its own shell).

## Checks
- Document: all pages show `block_counts_match` and `missing_words == 0`, with 0 internal link issues and 0 runtime dependencies.
- Hub: rows and cells counts match `grid.json` (portal 162: 12/12 rows, 21/21 cells), text matches, all assets present, 0 runtime dependencies.
- New block type or cell layout: add a parser plus a `blocks/<name>` block, then update the table above.

Pitfalls the importers already handle (html2md):
- strips `<script>`, so the payload is read in `onLoad`
- drops whitespace-only paragraphs and a trailing `<br>`, so spacers and `<br>` get a zero-width space
- trims spaces inside inline tags, so edge spaces are kept outside (or followed by a zero-width space)
- moves `<em>` outside `<a>`, which then renders as `.button.secondary`
- joins multi-line table-cell values, so multi-value rows use an explicit prefix (`n:`)
