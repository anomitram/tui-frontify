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

## TUI Brand Hub (migrated from Frontify document 396)
Reference: `docs/tui-brandhub/CONTEXT.md` (file locations, glossary, resume state) and `docs/tui-brandhub/SITEMAP.md`.
Procedures: project skills `frontify-export`, `frontify-block-mapping`, `frontify-assets`, `frontify-links-redirects`, `frontify-visual-verify`, `tui-new-page`.
Tokens in `styles/styles.css :root`, from Frontify design settings, captured 2026-11-10. Revisit if the source is edited after that date.

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

### Migration conventions
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
  - `/r/<token>` links go through the redirect sheet.
  - Links to other Frontify documents and portals stay absolute and are listed as out of scope.
- Local preview serves content under `/content/`. Use `contentPath()`/`localizeLinks()` from `scripts/scripts.js`.

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
