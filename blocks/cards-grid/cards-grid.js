/*
 * Cards Grid (Frontify marketplace block "Cards Grid"): cards with an image and/or rich text,
 * optionally a link. Columns follow the block's own width like Frontify's container queries:
 * 1, 2 from 440px, <n> from 740px.
 *
 * Variants:
 *   columns-<n>; type-imagetext | type-text; text-top (text below the image) | text-behind
 *   (text over the image); h-left|center|right + v-start|middle|bottom (image anchor; also the
 *   fallback text alignment); align-left|center|right, valign-start|middle|bottom (text alignment);
 *   padding-small|medium (text padding); spacing-none|s (gap); radius-none|small|large;
 *   display-fill|fit|none (image cover / contain); border; background;
 *   ratio-<w>-<h> (text card ratio); image-<w>-<h> (image ratio); width-<n> (text max width %).
 * Rows: picture | rich text (title elements, then description) | link [| styles], where styles
 *   are "title: <number of title elements>", "card: --cards-bg: <colour>" (own background),
 *   "all: text-align: x" and "n: class: <text style>; text-align: x" (n-th top-level element).
 * Optional last row "Settings | --cards-bg: …; --cards-border: …; --cards-gap: …;
 *   --cards-padding: …; --cards-radius: …; --cards-ratio: 5 / 7; --cards-image-ratio: 9 / 17;
 *   --cards-image-height: 300px; --cards-text-width: 85%" (custom values).
 */
import { contentPath } from '../../scripts/scripts.js';

const TOP = 'h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote';
// Frontify text style of a top-level element without an explicit class (see BLOCK_TAGS)
const STYLE_OF_TAG = {
  H1: 'heading1',
  H2: 'heading2',
  H3: 'heading3',
  H4: 'heading4',
  H5: 'custom1',
  H6: 'custom2',
  BLOCKQUOTE: 'quote',
  P: 'body',
};
const EXTRA_STYLES = ['custom3', 'image-title', 'image-caption'];
const SETTINGS = /^--cards-[a-z-]+$/;

const variant = (block, prefix) => [...block.classList]
  .find((c) => c.startsWith(prefix))?.slice(prefix.length);

function parseSettings(block, row) {
  const cells = [...row.children];
  if (cells.length < 2 || cells[0].textContent.trim().toLowerCase() !== 'settings') return false;
  cells[1].textContent.split(';').forEach((decl) => {
    const [prop, ...rest] = decl.split(':');
    const value = rest.join(':').trim();
    if (SETTINGS.test(prop.trim()) && value) block.style.setProperty(prop.trim(), value);
  });
  return true;
}

/** Text cell -> title and description containers with the Frontify text style classes. */
function buildText(cell, spec, card) {
  const els = [...(cell?.querySelectorAll(TOP) || [])]
    .filter((el) => !el.parentElement.closest(TOP));
  let titles = 0;
  const apply = (el, decls) => decls.split(';').map((d) => d.trim()).filter(Boolean).forEach((decl) => {
    const [prop, ...rest] = decl.split(':');
    const value = rest.join(':').trim();
    if (prop.trim() === 'class') el.classList.add(value);
    else el.style.setProperty(prop.trim(), value);
  });
  // entries: "title: <n>", "card: decl", "all: decl; decl", "<n>: decl; decl"; line breaks may
  // be lost in conversion, so also split before "<key>:"
  (spec || '').split(/\s*\n\s*|\s+(?=(?:\d+|all|title|card)\s*:\s)/).forEach((line) => {
    const m = /^\s*(\d+|all|title|card)\s*:\s*(.+)$/.exec(line);
    if (!m) return;
    if (m[1] === 'title') titles = Number(m[2]) || 0;
    else if (m[1] === 'card') apply(card, m[2]);
    else if (m[1] === 'all') els.forEach((el) => apply(el, m[2]));
    else if (els[Number(m[1]) - 1]) apply(els[Number(m[1]) - 1], m[2]);
  });
  const title = document.createElement('div');
  title.className = 'cards-grid-title';
  const description = document.createElement('div');
  description.className = 'cards-grid-description';
  els.forEach((el, i) => {
    let node = el;
    if (el.tagName === 'BLOCKQUOTE') {
      // Frontify "quote" is a paragraph style, not an indented quotation
      node = document.createElement('p');
      node.className = el.className;
      node.style.cssText = el.style.cssText;
      const inner = [...el.children];
      if (inner.length && inner.every((c) => c.tagName === 'P')) {
        inner.forEach((p, j) => {
          if (j) node.append(document.createElement('br'));
          node.append(...p.childNodes);
        });
      } else node.append(...el.childNodes);
    }
    const styles = [...Object.values(STYLE_OF_TAG), ...EXTRA_STYLES];
    if (!styles.some((c) => node.classList.contains(c))) {
      node.classList.add(STYLE_OF_TAG[el.tagName] || 'body');
    }
    (i < titles ? title : description).append(node);
  });
  const text = document.createElement('div');
  text.className = 'cards-grid-text';
  if (title.children.length) text.append(title);
  if (description.children.length) text.append(description);
  return text;
}

function imageRatio(img, target) {
  // natural ratio of the asset (Frontify: aspect-ratio = asset width / height)
  const w = Number(img.getAttribute('width')) || img.naturalWidth;
  const h = Number(img.getAttribute('height')) || img.naturalHeight;
  if (w && h) target.style.setProperty('--cards-asset-ratio', `${w} / ${h}`);
  else {
    img.addEventListener('load', () => {
      target.style.setProperty('--cards-asset-ratio', `${img.naturalWidth} / ${img.naturalHeight}`);
    }, { once: true });
  }
}

export default function decorate(block) {
  const behind = !block.classList.contains('text-top') && !block.classList.contains('type-text');
  const textOnly = block.classList.contains('type-text');
  // text alignment: explicit text alignment, else the anchor (Frontify)
  const h = variant(block, 'align-') || variant(block, 'h-') || 'left';
  const v = variant(block, 'valign-') || (behind ? variant(block, 'v-') : '') || 'start';
  block.classList.add(`text-h-${h}`, `text-v-${v === 'bottom' ? 'end' : v}`);

  const list = document.createElement('ul');
  list.className = 'cards-grid-list';
  [...block.children].forEach((row) => {
    if (parseSettings(block, row)) return;
    const [picCell, textCell, linkCell, styleCell] = [...row.children];
    const pic = picCell?.querySelector('picture') || picCell?.querySelector('img');
    const href = linkCell?.querySelector('a')?.getAttribute('href') || linkCell?.textContent.trim();
    if (!pic && !textCell?.textContent.trim() && !href) return; // empty row
    const li = document.createElement('li');
    li.className = 'cards-grid-item';
    const card = document.createElement(href ? 'a' : 'div');
    card.className = 'cards-grid-card';
    if (href) card.href = contentPath(href);
    const text = buildText(textCell, styleCell?.textContent, card);
    const img = pic && (pic.querySelector('img') || pic);
    if (textOnly) {
      const body = document.createElement('div');
      body.className = 'cards-grid-body';
      body.append(text);
      card.append(body);
    } else if (behind) {
      const media = document.createElement('div');
      media.className = 'cards-grid-media';
      if (img) {
        imageRatio(img, media);
        media.append(pic);
      }
      media.append(text);
      card.append(media);
    } else {
      const media = document.createElement('div');
      media.className = 'cards-grid-image';
      if (img) {
        imageRatio(img, media);
        media.append(pic);
      }
      const body = document.createElement('div');
      body.className = 'cards-grid-body';
      body.append(text);
      card.append(media, body);
    }
    li.append(card);
    list.append(li);
  });
  block.replaceChildren(list);
}
