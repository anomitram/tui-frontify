/*
 * Hub Cell: Frontify portal-home "text & image" cell, rebuilt with Frontify's own structure so
 * the ported layout rules apply 1:1.
 * Variants: textover | text | image | leftright | rightleft | topbottom | bottomtop, w-<n>,
 * text-<position>, image-<position>, cover.
 * Rows: picture, rich text, then key/value rows: Link, Image Link, New Window, Content Padding,
 * Image Padding, Content Width, Image Width, Ratio, Overlay, Content Background, Border, Styles.
 */
const LAYOUTS = ['textover', 'text', 'image', 'leftright', 'rightleft', 'topbottom', 'bottomtop'];
const KEYS = ['link', 'image link', 'new window', 'content padding', 'image padding', 'content width',
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
      else el.style.setProperty(prop.trim(), value);
    });
  });
}

export default function decorate(block) {
  const { cfg, picture, content } = readRows(block);
  const layout = LAYOUTS.find((l) => block.classList.contains(l)) || (picture ? 'image' : 'text');
  const pos = (prefix) => ([...block.classList].find((c) => c.startsWith(prefix)) || `${prefix}topleft`).slice(prefix.length);
  const href = cfg.link || cfg['image link'];

  const wrap = document.createElement('div');
  wrap.className = `pb-text-image__content layout-${layout}`;

  const image = document.createElement(href ? 'a' : 'div');
  image.className = 'pb-text-image__image';
  if (href) {
    image.href = href;
    if (cfg['new window'] === 'true') { image.target = '_blank'; image.rel = 'noopener'; }
  }
  if (!picture) image.classList.add('state-empty');
  if (cfg['image padding']) image.style.padding = cfg['image padding'];
  const inner = document.createElement('div');
  inner.className = `pb-text-image__image-inner state-${pos('image-')}`;
  inner.style.width = '100%';
  const container = document.createElement('div');
  container.className = 'pb-text-image__image-container';
  if (picture) {
    const legacy = document.createElement('div');
    legacy.className = 'cm-image-legacy';
    if (cfg.ratio) legacy.style.paddingBottom = cfg.ratio;
    const img = picture.querySelector('img') || picture;
    img.classList.add('cm-image-legacy__image');
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
