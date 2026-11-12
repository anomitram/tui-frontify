---
name: tui-new-page
description: Create a new TUI Brand Hub page that isn't from Frontify - a guideline page that plugs into the sidebar, pagination and anchors, or a portal hub page built from grid rows and cells with its own theme, nav and footer. Use when asked to add, draft or restructure a brand guideline page or a portal home on the migrated site.
---

# New brand guideline page

**Parameters:** category (existing or new), page title, slug, section headings, content blocks. Brand rules are in `AGENTS.md` (TUI Brand Hub section); don't restate them in content.

## Steps
1. **Path:** `/<category-slug>/<page-slug>`, lowercase with hyphens. Check `docs/tui-brandhub/SITEMAP.md` so it doesn't clash with an existing path (slugs repeat across categories).
2. **Page structure:**
   - First section: only the `h1` page title.
   - Then one section per topic, each starting with an `h2`. These become the sidebar sub-entries.
   - Body text is default content; use empty paragraphs for extra spacing.
   - Blocks: use only existing ones (`callout`, `image`, `image-grid`, `video`, `annotations`, `divider`, `attachments`, `colors`, `asset-kit`, `audio`, `text` for multi-column). Their table formats are in skill `frontify-block-mapping`.
3. **Metadata block:**
   - `Title`: `<Page> - TUI Master Brand Home - TUI MASTER BRAND NEW`
   - `Template`: `guideline`
   - `Category` and `Category Slug`
   - `Last Modified`, written as e.g. `November 11, 2026 at 9:05 AM`
4. **Navigation:** add the page to the `/sidebar` document: under its category's bold title, a list item linking to the page, with a nested list of `#<heading-slug>` links, one per `h2`.
   - The list order is the pagination order.
   - The link text must equal the `h2` text: the template matches them by text and sets `id = slug`.
5. **Assets:** put them under `/assets/<key>/<url-safe-name>` (or upload to DA). Images must be ≤ 18 MB (use `resize_for_eds.py`).
6. **Check locally:**
   - open `/content/<path>` at 1440 and 390 wide
   - sidebar shows the page and its headings
   - prev/next labels are right
   - heading anchors work
   - run `verify_migration.py` for links
7. **Remote:** DA upload, preview and publish only when the user asks in the current message. Report which surfaces changed.

## Variant: a new portal hub page (grid of cells, like `/tuimagiclife`)
1. **Path:** `/<route>`, plus `/<route>/nav` and `/<route>/footer` (copy an existing portal's as a start). Check `SITEMAP.md` for clashes.
2. **Metadata:** `Template: hub`, `Theme: <route>`, `Nav: /<route>/nav`, `Footer: /<route>/footer`.
3. **Theme:** `styles/theme-<route>.css`, scoped to `body.<route>`; header only through its CSS variables (skill `frontify-styles-fonts`). Use the portal's own brand colours, not the doc 396 palette, unless it's a TUI master-brand portal.
4. **Rows and cells:** one section per row with `Section Metadata` `Style: hub-row` (and `Width`, `Content Width`, `Gutter`, `Margin Top`, `Margin Bottom`, `Background` as needed); one `Hub Cell (<layout>, w-<n>)` or `Hub Divider (w-<n>)` block per cell, widths in a row summing to 12. Row formats: skill `frontify-block-mapping`.
5. **No** sidebar, pagination, headings with anchors or `/sidebar` entry.
6. **Check locally** at 1440, 768 and 375 (`hub-shot-local.js` adds the doctype), then the same remote rule as step 7 above.

## Checks
- Colours, fonts and spacing come from `styles/styles.css` tokens (hub: the theme file); don't add inline styles.
- Copy follows the tone-of-voice pillars. Read `/tone-of-voice/*` for anything beyond the pillar names, since the details are unverified in memory.
- If a design element has no existing block, flag it and propose a new block. Don't approximate it with ad-hoc markup.
