/*
 * Image block (Frontify "Image").
 * Row 1: picture. Optional label rows: Title | Caption | Link | Background | Border | Download |
 * Attachments (one link per file; link text = original file name) | Styles (Frontify text style
 * per title/caption element: "title 1: class: image-title-text; text-align: left", one per line).
 * Variants: align-left / align-right, border, background, radius-*, downloadable.
 */

const LABELS = ['title', 'caption', 'link', 'background', 'border', 'download', 'attachments', 'styles'];

const SVG = (size, path) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="${path}"/></svg>`;
const PAPERCLIP = SVG(16, 'M7.451 4.635c-.568.557-.951 1.405-.951 2.57v8.03C6.5 17.525 8.62 20 11.353 20c1.467 0 2.897-.393 3.94-1.174 1.016-.762 1.707-1.92 1.707-3.59V6.823h1.5v8.411c0 2.153-.92 3.752-2.308 4.792-1.363 1.020-3.132 1.473-4.839 1.473C7.737 21.500 5 18.298 5 15.235v-8.03c0-1.510.506-2.764 1.402-3.641.89-.874 2.107-1.314 3.422-1.314 1.317 0 2.504.443 3.362 1.327.856.884 1.314 2.137 1.314 3.629v8.03c0 1.612-1.257 2.661-2.765 2.661-1.586 0-2.700-1.303-2.735-2.642-.013-.497-.013-2.615-.010-4.590L8.996 8 9 7.143v-.322l.75.003.75.002v.084l-.001.238-.003.856-.006 2.664c-.003 1.990-.003 4.078.010 4.547a1.243 1.243 0 001.235 1.182c.786 0 1.265-.48 1.265-1.162v-8.03c0-1.183-.358-2.034-.892-2.584-.532-.549-1.308-.871-2.284-.871-.98 0-1.800.324-2.373.885m2.302 1.439a.75.75 0 01.747.752l-.75-.002L9 6.820a.75.75 0 01.753-.747m7.997 0a.75.75 0 01.75.75H17a.75.75 0 01.75-.75');
const CARET = SVG(12, 'M19.78 7.69a.75.75 0 010 1.06L12.53 16l-.53.53-.53-.53-7.25-7.25a.75.75 0 011.06-1.06L12 14.41l6.72-6.72a.75.75 0 011.06 0');
const FILE_ICON = SVG(24, 'M6 2.5h8.31l4.19 4.19V20a1.5 1.5 0 01-1.5 1.5H6A1.5 1.5 0 014.5 20V4A1.5 1.5 0 016 2.5M6 4v16h12V8h-4.5V4zm9 .81V6.5h1.69z');
const IMAGE_ICON = SVG(24, 'M5 3.5h14A1.5 1.5 0 0120.5 5v14a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 19V5A1.5 1.5 0 015 3.5M5 5v10.94l3.97-3.97a.75.75 0 011.06 0l2.47 2.47 3.47-3.47a.75.75 0 011.06 0L19 13.44V5zm14 10.56-2.5-2.5-3.47 3.47a.75.75 0 01-1.06 0L9.5 14.06l-4.5 4.5V19h14zM9 7a2 2 0 110 4 2 2 0 010-4m0 1.5a.5.5 0 100 1 .5.5 0 000-1');

function humanSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${u ? n.toFixed(2) : n} ${units[u]}`;
}

function buildAttachments(cell) {
  const links = [...cell.querySelectorAll('a[href]')];
  if (!links.length) return null;
  const count = links.length;

  const wrap = document.createElement('div');
  wrap.className = 'image-attachments';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'image-attachments-trigger';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', `Open attachments, ${count} ${count === 1 ? 'attachment' : 'attachments'}`);
  trigger.innerHTML = `${PAPERCLIP}<span aria-hidden="true">${count}</span>${CARET}`;

  const menu = document.createElement('div');
  menu.className = 'image-attachments-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  const list = document.createElement('div');
  list.className = 'image-attachments-list';
  const metas = [];
  links.forEach((link) => {
    const href = link.getAttribute('href');
    const name = link.textContent.trim() || decodeURIComponent(href.split('/').pop());
    const ext = (name.match(/\.([a-z0-9]+)$/i) || href.match(/\.([a-z0-9]+)(\?|#|$)/i) || [])[1] || '';
    const item = document.createElement('a');
    item.className = 'image-attachments-item';
    item.setAttribute('role', 'menuitem');
    item.href = href;
    item.download = name;
    const isImage = /^(png|jpe?g|gif|svg|webp|tiff?|bmp)$/i.test(ext);
    item.innerHTML = `<span class="image-attachments-icon">${isImage ? IMAGE_ICON : FILE_ICON}</span>`;
    const text = document.createElement('span');
    text.className = 'image-attachments-text';
    const title = document.createElement('span');
    title.className = 'image-attachments-title';
    title.innerHTML = '<span class="image-attachments-sr">Download attachment </span>';
    title.append(name);
    const meta = document.createElement('span');
    meta.className = 'image-attachments-meta';
    meta.textContent = ext.toLowerCase();
    text.append(title, meta);
    item.append(text);
    list.append(item);
    metas.push({ href, meta, ext: ext.toLowerCase() });
  });
  menu.append(list);
  wrap.append(trigger, menu);

  let sized = false;
  const fillSizes = () => {
    if (sized) return;
    sized = true;
    metas.forEach(({ href, meta, ext }) => {
      fetch(href, { method: 'HEAD' }).then((r) => {
        const size = humanSize(Number(r.headers.get('content-length')));
        if (r.ok && size) meta.textContent = `${size} - ${ext}`;
      }).catch(() => {});
    });
  };

  const onOutside = (e) => {
    // eslint-disable-next-line no-use-before-define
    if (!wrap.contains(e.target)) setOpen(false);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      // eslint-disable-next-line no-use-before-define
      setOpen(false);
      trigger.focus();
    }
  };
  function setOpen(open) {
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    wrap.classList.toggle('is-open', open);
    if (open) {
      fillSizes();
      document.addEventListener('click', onOutside);
      document.addEventListener('keydown', onKey);
    } else {
      document.removeEventListener('click', onOutside);
      document.removeEventListener('keydown', onKey);
    }
  }
  trigger.addEventListener('click', () => setOpen(menu.hidden));
  list.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  return wrap;
}

function readRows(block) {
  const data = {};
  let picture = null;
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const pic = row.querySelector('picture') || row.querySelector('img');
    if (!picture && pic) {
      picture = pic.closest('picture') || pic;
      return;
    }
    const [label, value] = cells;
    if (!value) return;
    const key = label.textContent.trim().toLowerCase();
    if (LABELS.includes(key)) data[key] = value;
  });
  return { picture, data };
}

/** "title 2: class: image-title-text; text-align: left" -> class/style on the 2nd title element. */
function applyStyles(data) {
  const spec = data.styles.innerText ?? data.styles.textContent;
  spec.split(/\s*\n\s*|\s+(?=(?:title|caption)\s+\d+\s*:\s)/).forEach((line) => {
    const m = /^\s*(title|caption)\s+(\d+)\s*:\s*(.+)$/i.exec(line);
    const cell = m && data[m[1].toLowerCase()];
    const el = cell && [...cell.children][Number(m[2]) - 1];
    if (!el) return;
    m[3].split(';').map((d) => d.trim()).filter(Boolean).forEach((decl) => {
      const [prop, ...rest] = decl.split(':');
      const value = rest.join(':').trim();
      if (prop.trim() === 'class') el.classList.add(value);
      else el.style.setProperty(prop.trim(), value);
    });
  });
}

function setNaturalLimits(img) {
  const apply = () => {
    const h = Number(img.getAttribute('height')) || img.naturalHeight;
    if (h) img.style.maxHeight = `${h}px`;
  };
  if (img.getAttribute('height') || img.complete) apply();
  else img.addEventListener('load', apply, { once: true });
}

function openViewer(block, img) {
  const dialog = document.createElement('dialog');
  dialog.className = 'image-viewer';
  dialog.setAttribute('aria-label', img.alt || 'Image viewer');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'image-viewer-close';
  close.setAttribute('aria-label', 'Close');
  const large = document.createElement('img');
  large.src = img.currentSrc || img.src;
  large.alt = img.alt;
  large.className = 'image-viewer-img';
  dialog.append(close, large);
  const shut = () => dialog.close();
  close.addEventListener('click', shut);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) shut(); });
  dialog.addEventListener('close', () => dialog.remove());
  block.append(dialog);
  dialog.showModal();
}

export default function decorate(block) {
  const { picture, data } = readRows(block);
  if (!picture) {
    block.replaceChildren();
    return;
  }
  const img = picture.tagName === 'IMG' ? picture : picture.querySelector('img');

  const figure = document.createElement('figure');
  figure.className = 'image-figure';

  const frame = document.createElement('div');
  frame.className = 'image-frame';
  if (data.background) frame.style.backgroundColor = data.background.textContent.trim();
  if (data.border) frame.style.border = data.border.textContent.trim();

  let media = picture;
  const href = data.link?.querySelector('a')?.getAttribute('href') || data.link?.textContent.trim();
  if (href) {
    const a = document.createElement('a');
    a.className = 'image-link';
    a.href = href;
    a.append(picture);
    media = a;
  } else if (img) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'image-viewer-trigger';
    btn.setAttribute('aria-label', `Open image${img.alt ? `: ${img.alt}` : ''}`);
    btn.append(picture);
    btn.addEventListener('click', () => openViewer(block, img));
    media = btn;
  }
  frame.append(media);

  // top-right button area (attachments flyout, download)
  const actions = document.createElement('div');
  actions.className = 'image-actions';
  const attachments = data.attachments && buildAttachments(data.attachments);
  if (attachments) actions.append(attachments);
  if (data.download) {
    const url = data.download.querySelector('a')?.getAttribute('href') || data.download.textContent.trim();
    if (url) {
      const dl = document.createElement('a');
      dl.className = 'image-download';
      dl.href = url;
      dl.download = '';
      dl.setAttribute('aria-label', 'Download');
      actions.append(dl);
    }
  }
  if (actions.children.length) {
    frame.append(actions);
    if (attachments) frame.classList.add('has-attachments');
  }
  figure.append(frame);

  if (data.styles) applyStyles(data);
  const hasTitle = data.title && data.title.textContent.trim();
  const hasCaption = data.caption && data.caption.textContent.trim();
  if (hasTitle || hasCaption) {
    const cap = document.createElement('figcaption');
    if (hasTitle) {
      data.title.className = 'image-title';
      cap.append(data.title);
    }
    if (hasCaption) {
      data.caption.className = 'image-caption';
      cap.append(data.caption);
    }
    figure.append(cap);
  }

  // frame ratio variant "ratio-16-11" (Frontify ratio setting): the image fills that frame
  const ratio = [...block.classList].map((c) => c.match(/^ratio-(\d+)-(\d+)$/)).find(Boolean);
  if (img && ratio) img.style.aspectRatio = `${ratio[1]} / ${ratio[2]}`;
  if (img) {
    if (!ratio) setNaturalLimits(img);
    const sections = [...document.querySelectorAll('main .section')];
    const idx = sections.indexOf(block.closest('.section'));
    if (idx > 1 && !img.hasAttribute('loading')) img.loading = 'lazy';
  }
  block.replaceChildren(figure);
}
