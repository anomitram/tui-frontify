---
name: frontify-visual-verify
description: Compare migrated pages with the Frontify reference captures - documents at desktop (1440) and mobile (390) page by page, portal hubs at 1440/768/375 by element position and pixels - locally, on preview or on live. Use after code or content changes to the TUI Brand Hub pages or the TUI MAGIC LIFE hub, when asked whether a page still matches the original, to find layout regressions, or as the render check before publishing.
---

# Visual verification (documents and portal hubs)

**Parameters (generic):** the model, the data dir, page ids (documents; default all) or the route (hubs), and the URL base (local `/content/<path>`, `<branch>--<site>--<org>.aem.page` or `.aem.live`). References come from skill `frontify-export`. `PW_PATH` as in that skill.

## Rules for both
- **Doctype:** the local preview serves pages without a doctype (quirks mode), which changes percentage heights and line heights. Comparison scripts must add `<!DOCTYPE html>` before measuring (the hub scripts do; the document script doesn't, so expect ~1px line-height drift locally).
- **Window height:** references grow the window to the content height (Frontify scrolls an inner element), so `vh` units are huge there. Local shots must do the same.
- **Published markup:** preview/live turn `:icon:` text into `<span class="icon icon-x">` and rename images to `media_*`. Match images by position or order, not by name, and test that form before calling a render check passed.
- **CDN:** after a publish, repeat live requests several times and check `last-modified`; one node can stay stale for up to 2 h.
- Look at the worst cases yourself. Pixel percentages overstate vertical shifts.

## Documents
1. Local screenshots: `PW_PATH=… node tools/frontify-export/visual-capture-local.mjs migration-work/frontify migration-work/frontify/local-shots [ids]`. One page at a time, scrollbars rendered to match the reference gutter. About 12 minutes for 84 pages: run it in the background and poll (commands time out after 10 minutes).
2. Images taller than 16,000px exceed ImageMagick's limit: `node tools/frontify-export/tile-tall-png.js <png…>`.
3. Compare: `python3 -I tools/frontify-export/visual_compare.py migration-work/frontify [ids]` → `visual-report.json` (height difference, differing pixels at `-fuzz 10%`) and side-by-side PNGs in `visual-diff/`. Mobile is compared with the deliberate 21px left shift compensated (`mobile_overflow.py` explains the source overflow).

## Portal hubs
1. One command per URL (local, preview or live): `PW_PATH=… python3 -I tools/frontify-export/hub_render_check.py <url> <dir>/capture <outDir>` → `<outDir>/visual-report.json`. It runs, per width 1440/768/375:
   - `hub-shot-local.js <url> <out.png> <width>`: screenshot with doctype and grown window
   - `hub-compare-rects.js <url> <dir>/capture <width>`: offsets of every row, cell, image and text element against `capture/<w>.styles.json`
   - ImageMagick `compare` below the header (the header differs only where excluded tools were)
2. Content check: `python3 -I tools/frontify-export/verify_hub.py . <dir> <route>` (rows, cells, text, assets, links, runtime dependencies).
3. Hover: compare the buttons against `capture/hover-states.json`.

## Checks: accepted baselines (2026-11-11)
| | Baseline | Treat as a regression |
|---|---|---|
| Doc 396 desktop | 74/83 pages ≤ 5% different, 78/83 within 1% height | height changes > 1%, or a block visibly differs side by side |
| Doc 396 mobile | 54/83 ≤ 5%; the source's own overflow causes the rest | |
| Hub 162 local | 36/36 elements at 0px offset at every width; heights identical; below-header 0.03% / 0.006% / 0.004% | any element offset > 1px, any height change |
| Hub 162 preview/live (`main`) | 14/14 images and 22/22 text elements in place; below-header 0.032% / 0.008% / 0.765% (mobile = Edge Delivery image compression) | missing images, offsets, or > 1% below the header |

- Ignore the invalid document references: 1796 mobile ("Something went wrong") and 1798 desktop/mobile (blank / bot check).
- Before trusting a document reference, check its `styles.json` title (see `frontify-export`).
