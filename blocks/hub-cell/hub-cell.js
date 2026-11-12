/*
 * Hub Cell: Frontify portal-home "text & image" cell, rebuilt with Frontify's own structure so
 * the ported layout rules apply 1:1.
 * Variants: textover | text | image | leftright | rightleft | topbottom | bottomtop, w-<n>,
 * text-<position>, image-<position>, cover.
 * Rows: picture, rich text, then key/value rows: Link, Image Link, New Window, Image New Window,
 * Image Background, Content Padding, Image Padding, Content Width, Image Width, Ratio, Overlay,
 * Content Background, Border, Styles.
 * Links as in Frontify: the image area goes to Image Link (else Link), the rest of the cell to Link
 * (else Image Link); each has its own new-window flag.
 */
import { contentPath, decorateInlineButtons } from '../../scripts/scripts.js';

const LAYOUTS = ['textover', 'text', 'image', 'leftright', 'rightleft', 'topbottom', 'bottomtop'];
const KEYS = ['link', 'image link', 'new window', 'image new window', 'image background', 'content padding', 'image padding', 'content width',
  'image width', 'ratio', 'overlay', 'content background', 'border', 'styles', 'frontify cell'];

function readRows(block) {
  const cfg = {};
  let picture = null;
  let content = null;
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const label = cells[0]?.textContent.trim().toLowerCase();
    if (cells.length >= 2 && KEYS.includes(label)) {
      cfg[label] = cells[1].innerText ?? cells[1].textContent;
      return;
    }
    const pic = row.querySelector('picture, img');
    if (!picture && pic && !row.textContent.trim()) {
      picture = pic.closest('picture') || pic;
      return;
    }
    if (!content) [content] = cells;
  });
  return { cfg, picture, content };
}

/** Re-apply Frontify inline text styles ("n: css; css") to the n-th top-level text element. */
function applyStyles(content, spec) {
  if (!content || !spec) return;
  const els = [...content.querySelectorAll('h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote')]
    .filter((el) => !el.parentElement.closest('h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote'));
  // entries are "<n>: css; css"; line breaks may be lost in conversion, so split before "<n>:"
  spec.split(/\s*\n\s*|\s+(?=\d+\s*:\s)/).forEach((line) => {
    const m = /^\s*(\d+)\s*:\s*(.+)$/.exec(line);
    if (!m) return;
    const el = els[Number(m[1]) - 1];
    if (!el) return;
    m[2].split(';').map((d) => d.trim()).filter(Boolean).forEach((decl) => {
      const [prop, ...rest] = decl.split(':');
      const value = rest.join(':').trim();
      if (prop.trim() === 'class') el.classList.add(value);
      else if (prop.trim() === 'spaces') {
        // restore the source's runs of spaces between inline elements (rendering collapses them)
        const lengths = value.split(',').map(Number);
        const gaps = [...el.childNodes].filter((n) => n.nodeType === 3 && n.previousSibling
          && n.nextSibling && /^\s+$/.test(n.nodeValue));
        gaps.forEach((g, i) => { if (lengths[i] > 0) g.nodeValue = ' '.repeat(lengths[i]); });
      } else el.style.setProperty(prop.trim(), value);
    });
  });
}

export default function decorate(block) {
  const { cfg, picture, content } = readRows(block);
  if (block.classList.contains('none')) {
    // empty Frontify cell: only holds its column width
    block.textContent = '';
    if (cfg['frontify cell']) block.dataset.frontifyCell = cfg['frontify cell'];
    return;
  }
  const layout = LAYOUTS.find((l) => block.classList.contains(l)) || (picture ? 'image' : 'text');
  const pos = (prefix) => ([...block.classList].find((c) => c.startsWith(prefix)) || `${prefix}topleft`).slice(prefix.length);
  // contentPath: local preview mounts pages under /content (no-op on Edge Delivery)
  const href = contentPath(cfg.link || cfg['image link']);
  const imageHref = contentPath(cfg['image link'] || cfg.link);
  const imageNewWindow = cfg['image new window'] === 'true' || (!cfg['image link'] && cfg['new window'] === 'true');
  const contain = block.classList.contains('cover-mode-contain');
  const cover = layout === 'image' && block.classList.contains('cover');

  const wrap = document.createElement('div');
  wrap.className = `pb-text-image__content layout-${layout}`;
  if (contain) wrap.classList.add('pb-text-image__content--cover-mode-contain');

  const image = document.createElement(imageHref ? 'a' : 'div');
  image.className = 'pb-text-image__image';
  if (imageHref) {
    image.href = imageHref;
    if (imageNewWindow) { image.target = '_blank'; image.rel = 'noopener'; }
  }
  if (cfg['image background']) image.style.background = cfg['image background'];
  if (!picture) image.classList.add('state-empty');
  if (cfg['image padding']) image.style.padding = cfg['image padding'];
  const inner = document.createElement('div');
  inner.className = `pb-text-image__image-inner state-${pos('image-')}`;
  if (cover) inner.classList.add('state-cover');
  inner.style.width = '100%';
  const container = document.createElement('div');
  container.className = 'pb-text-image__image-container';
  if (picture) {
    const legacy = document.createElement('div');
    legacy.className = 'cm-image-legacy';
    if (cover) {
      // Frontify's script drops "state-cover" from the holder when the columns stack (< 768px;
      // verified on all 26 cover images of portal 161), so the image keeps its own ratio there
      const wide = window.matchMedia('(width >= 768px)');
      const sync = () => legacy.classList.toggle('state-cover', wide.matches);
      sync();
      wide.addEventListener('change', sync);
    }
    if (cfg.ratio) legacy.style.paddingBottom = cfg.ratio;
    const img = picture.querySelector('img') || picture;
    img.classList.add('cm-image-legacy__image');
    if (contain) img.classList.add('cm-image-legacy__wrap--contain');
    img.loading = block.closest('.section')?.previousElementSibling ? 'lazy' : 'eager';
    legacy.append(picture);
    container.append(legacy);
  }
  inner.append(container);
  const overlay = document.createElement('div');
  overlay.className = 'pb-text-image__image-overlay';
  if (cfg.overlay) overlay.style.background = cfg.overlay;
  image.append(inner, overlay);

  const text = document.createElement('div');
  text.className = 'pb-text-image__text';
  const textInner = document.createElement('div');
  textInner.className = `pb-text-image__text-inner state-visible state-${pos('text-')} co-editor`;
  if (cfg['content padding']) textInner.style.padding = cfg['content padding'];
  if (cfg['content width']) textInner.style.maxWidth = cfg['content width'];
  // Frontify paints the content background on the whole text area, not just the text column
  if (cfg['content background']) text.style.background = cfg['content background'];
  if (content) {
    applyStyles(content, cfg.styles);
    decorateInlineButtons(content);
    textInner.append(...content.childNodes);
  }
  text.append(textInner);

  if ((layout === 'leftright' || layout === 'rightleft') && cfg['image width']) {
    const w = parseFloat(cfg['image width']);
    image.style.flex = `1 ${cfg['image width']}`;
    text.style.flex = `1 ${100 - w}%`;
  }
  if (cfg.border) {
    const [b, r] = cfg.border.split(';');
    wrap.style.border = b.trim();
    const rad = /radius\s+(\S+)/.exec(r || '');
    if (rad) [, wrap.style.borderRadius] = rad;
  }
  wrap.append(image, text);
  if (href) {
    // Frontify makes the whole cell clickable when it has a link
    wrap.dataset.link = href;
    text.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (cfg['new window'] === 'true') window.open(href, '_blank', 'noopener');
      else window.location.href = href;
    });
  }
  block.textContent = '';
  const mod = document.createElement('div');
  mod.className = 'pb-text-image';
  mod.append(wrap);
  block.append(mod);
  if (cfg['frontify cell']) block.dataset.frontifyCell = cfg['frontify cell'];
}
