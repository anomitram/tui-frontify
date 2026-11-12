/*
 * Library: the asset list of a Frontify library ("Assets / N items", sort, justified grid).
 * Variants: logos, media, icons, documents.
 * Rows: settings "Key | value" (Title, Count, Sort, View All, Row Height, Details), then one row
 * per asset: picture | title | type | dimensions | duration or pages | date (YYYY-MM-DD) | size |
 * link. Layout = Frontify's justified grid (target row height "Row Height", 8px spacing, 15%
 * tolerance, row heights clamped to 0.5x-2x, a last incomplete row keeps the previous row's
 * height); with Details "always" the info bar below the preview is part of the tile. Tiles are
 * rendered in batches as the page scrolls; the Library Search block filters them.
 */
import { readLibraryRows, LIBRARY_ICONS, LIBRARY_FILTER_EVENT } from '../../scripts/library.js';
import { contentPath } from '../../scripts/scripts.js';

const KINDS = ['logos', 'media', 'icons', 'documents'];
const SPACING = 8;
const TOLERANCE = 0.15;
const BATCH = 60;
const VIDEO_EXT = ['mp4', 'mov', 'flv', 'wmv', 'mkv', 'avi', 'gif']; // Frontify "Type: Video"

const formatDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
};
const itemsLabel = (n) => `${n} item${n === 1 ? '' : 's'}`;
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/** Frontify's justified layout. Rows: { start, end, height, unit } (tile width = aspect x unit). */
export function justify(aspects, width, target) {
  const rows = [];
  const minAspect = (width / target) * (1 - TOLERANCE);
  const maxAspect = (width / target) * (1 + TOLERANCE);
  const clamp = (h) => Math.max(0.5 * target, Math.min(h, 2 * target));
  const sum = (from, to) => aspects.slice(from, to).reduce((s, a) => s + a, 0);
  const rowWidth = (n) => width - (n - 1) * SPACING;
  let start = 0;
  let i = 0;
  // justified rows fill the width at their natural height; only the height is clamped
  const complete = (end, h) => {
    rows.push({
      start, end, height: clamp(h), unit: h,
    });
    start = end;
  };
  while (i < aspects.length) {
    const n = i - start + 1;
    const ratio = sum(start, i + 1);
    if (ratio < minAspect) {
      i += 1;
    } else if (ratio > maxAspect && n > 1) {
      const prev = sum(start, i);
      const prevTarget = rowWidth(n - 1) / target;
      if (Math.abs(ratio - rowWidth(n) / target) > Math.abs(prev - prevTarget)) {
        complete(i, rowWidth(n - 1) / prev);
      } else {
        i += 1;
        complete(i, rowWidth(n) / ratio);
      }
    } else {
      i += 1;
      complete(i, rowWidth(n) / ratio);
    }
  }
  if (start < aspects.length) {
    const height = rows.length ? rows[rows.length - 1].height : target;
    rows.push({
      start, end: aspects.length, height, unit: height,
    });
  }
  return rows;
}

/** The file an <img> shows: its src without the query (published: ./media_<hash>.svg). */
function imageFile(img) {
  const src = img.getAttribute('src') || '';
  try {
    const u = new URL(src, window.location.href);
    return `${u.origin === window.location.origin ? '' : u.origin}${u.pathname}`;
  } catch (e) {
    return src.split('?')[0];
  }
}

/**
 * The link cell, if it is a working link: the content upload rewrites links to files into
 * content.da.live URLs (401 for visitors) or into "<name>-pdf" page paths (404).
 */
function workingLink(a) {
  const href = a?.getAttribute('href');
  if (!href) return '';
  try {
    const u = new URL(href, window.location.href);
    if (/(^|\.)da\.live$/.test(u.hostname)) return '';
    if (u.origin === window.location.origin && /-(svg|jpe?g|png|gif|webp|pdf|mp4|mov|zip)$/i.test(u.pathname)) return '';
  } catch (e) {
    return '';
  }
  return href;
}

function parseItem(cells, index, kind) {
  const [picCell, titleCell, typeCell, dimCell, extraCell, dateCell, sizeCell, linkCell] = cells;
  const img = picCell?.querySelector('img');
  if (!img) return null;
  const dims = /(\d+)\s*[×x]\s*(\d+)/.exec(dimCell?.textContent || '');
  const w = dims ? Number(dims[1]) : Number(img.getAttribute('width')) || 1;
  const h = dims ? Number(dims[2]) : Number(img.getAttribute('height')) || 1;
  const ext = (typeCell?.textContent || '').trim();
  const title = (titleCell?.textContent || img.alt || '').trim();
  // logo and icon tiles show the SVG file itself: download it from the tile's own image
  const isFile = ['logos', 'icons'].includes(kind) && ext.toLowerCase() === 'svg';
  const href = isFile ? imageFile(img) : workingLink(linkCell?.querySelector('a'));
  return {
    index,
    picture: img.closest('picture') || img,
    img,
    title,
    ext,
    dims: dims ? `${w} × ${h} px` : '',
    extra: (extraCell?.textContent || '').trim(),
    date: (dateCell?.textContent || '').trim(),
    size: (sizeCell?.textContent || '').trim(),
    href,
    download: isFile ? `${title.replace(/[\\/:*?"<>|]+/g, '_')}.svg` : '',
    aspect: w / h,
    type: VIDEO_EXT.includes(ext.toLowerCase()) ? 'video' : 'image',
    orientation: (w === h && 'square') || (w > h ? 'landscape' : 'portrait'),
  };
}

function buildCard(item, kind) {
  const li = el('li', 'library-tile');
  const card = el(item.href ? 'a' : 'div', 'library-card');
  if (item.href) {
    card.href = item.href;
    if (item.download) card.setAttribute('download', item.download);
    else if (/^https?:/.test(item.href)) {
      card.target = '_blank';
      card.rel = 'noopener';
    }
    card.setAttribute('aria-label', `${item.download ? 'Download' : 'Open'} ${item.title}`);
  }
  const preview = el('span', 'library-preview');
  item.img.loading = 'lazy';
  item.img.removeAttribute('fetchpriority');
  preview.append(item.picture);
  const info = el('span', 'library-info');
  info.append(el('span', 'library-title', item.title));
  if (kind !== 'icons') {
    const meta = el('span', 'library-meta');
    if (item.ext) meta.append(el('span', 'library-badge', item.ext));
    const parts = [item.extra || item.dims, item.date && formatDate(item.date), item.size]
      .filter(Boolean);
    meta.append(el('span', 'library-meta-text', parts.join('  •  ')));
    info.append(meta);
  }
  card.append(preview, info);
  li.append(card);
  return li;
}

/**
 * Rows of a further part of the library (a page with the same Library block, e.g.
 * /the-mora/libraries/media/assets-2): fetched as plain HTML and parsed without rendering, so
 * its images only load when their tiles are shown. Media paths are relative to the part page.
 */
async function fetchPart(href) {
  const { pathname } = new URL(href, window.location.href);
  const path = contentPath(pathname.replace(/\.(plain\.)?html$/, ''));
  const resp = await fetch(`${path}.plain.html`);
  if (!resp.ok) return [];
  const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
  const base = new URL(path, window.location.href);
  doc.querySelectorAll('img[src^="./media_"]').forEach((i) => { i.src = new URL(i.getAttribute('src'), base).href; });
  doc.querySelectorAll('source[srcset^="./media_"]').forEach((x) => { x.srcset = new URL(x.getAttribute('srcset'), base).href; });
  const block = doc.querySelector('.library');
  if (!block) return [];
  const rows = [...block.children].map((r) => [...r.children]);
  return rows.filter((cells) => cells[0]?.querySelector('img'))
    .map((cells) => cells.map((c) => document.adoptNode(c)));
}

function buildSort(label) {
  const wrap = el('div', 'library-sort');
  const btn = el('button', 'library-sort-button');
  btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `${LIBRARY_ICONS.sort}<span class="library-sort-label"></span>${LIBRARY_ICONS.caret}`;
  btn.querySelector('.library-sort-label').textContent = label;
  const menu = el('ul', 'library-sort-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  const options = [['newest', 'Newest first'], ['oldest', 'Oldest first']].map(([value, text]) => {
    const li = el('li');
    li.setAttribute('role', 'none');
    const opt = el('button', 'library-sort-option', text);
    opt.type = 'button';
    opt.setAttribute('role', 'menuitemradio');
    opt.dataset.value = value;
    li.append(opt);
    menu.append(li);
    return opt;
  });
  const open = (yes) => {
    menu.hidden = !yes;
    btn.setAttribute('aria-expanded', yes ? 'true' : 'false');
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(menu.hidden); });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) open(false); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { open(false); btn.focus(); } });
  const select = (value) => {
    options.forEach((o) => o.setAttribute('aria-checked', o.dataset.value === value ? 'true' : 'false'));
    btn.setAttribute('aria-label', `Sort by ${label}, ${options.find((o) => o.dataset.value === value).textContent}`);
  };
  wrap.append(btn, menu);
  return {
    wrap, options, select, close: () => open(false),
  };
}

export default function decorate(block) {
  const kind = KINDS.find((k) => block.classList.contains(k)) || 'media';
  const { settings, items: rows } = readLibraryRows(block, ['title', 'count', 'sort', 'view-all', 'row-height', 'details', 'parts']);
  const target = Number.parseFloat(settings['row-height']?.textContent) || 220;
  const details = (settings.details?.textContent || (['icons', 'documents'].includes(kind) ? 'always' : 'hover')).trim().toLowerCase();
  const items = rows.map((cells, i) => parseItem(cells, i, kind)).filter(Boolean);
  // further parts of a large library (Edge Delivery allows 200 images per page): loaded in order
  const parts = [...(settings.parts?.querySelectorAll('a') || [])].map((a) => a.getAttribute('href'));
  // Details "always": the info bar (48px title only, 72px with metadata) is part of the tile
  const bar = kind === 'icons' ? 48 : 72;
  const tileAspect = (a) => (details === 'always' ? (a * target) / (target + bar) : a);
  block.classList.add(`details-${details}`);
  block.textContent = '';

  // header: title + count, sort or "View all"
  const header = el('div', 'library-header');
  const titles = el('div', 'library-heading');
  const h = settings.title?.querySelector('h1, h2, h3, h4, h5, h6') || el('h2', null, settings.title?.textContent.trim() || 'Assets');
  const authoredCount = settings.count?.textContent.trim();
  const count = el('span', 'library-count', authoredCount || itemsLabel(items.length));
  titles.append(h, count);
  header.append(titles);
  let sort = null;
  if (settings['view-all']) {
    const a = settings['view-all'].querySelector('a');
    if (a) {
      a.className = 'library-view-all';
      if (/^https?:/.test(a.href)) { a.target = '_blank'; a.rel = 'noopener'; }
      const sr = el('span', 'library-sr-only', ` ${h.textContent}`);
      a.append(sr);
      header.append(a);
    }
  } else if (settings.sort) {
    sort = buildSort(settings.sort.textContent.trim());
    header.append(sort.wrap);
  }

  const grid = el('ul', 'library-grid');
  const empty = el('p', 'library-empty', 'No assets found.');
  empty.hidden = true;
  const sentinel = el('div', 'library-sentinel');
  block.append(header, grid, empty, sentinel);

  const state = {
    order: 'newest', query: '', filters: {}, view: items, shown: BATCH, width: 0,
  };
  const cards = new Map();

  const layout = () => {
    const width = grid.clientWidth;
    if (!width) return;
    state.width = width;
    const { view } = state;
    const rowsOut = justify(view.map((it) => tileAspect(it.aspect)), width, target);
    let top = 0;
    const visible = new Set();
    let bottom = 0;
    rowsOut.some((r) => {
      let left = 0;
      for (let k = r.start; k < r.end; k += 1) {
        const it = view[k];
        const w = Math.min(width, tileAspect(it.aspect) * r.unit);
        let li = cards.get(it);
        if (!li) { li = buildCard(it, kind); cards.set(it, li); }
        Object.assign(li.style, {
          left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${r.height}px`,
        });
        if (li.parentElement !== grid || li.dataset.pos !== String(k)) {
          li.dataset.pos = String(k);
          grid.append(li);
        }
        visible.add(li);
        left += w + SPACING;
      }
      bottom = top + r.height;
      top = bottom + SPACING;
      return r.end >= state.shown;
    });
    [...grid.children].forEach((li) => { if (!visible.has(li)) li.remove(); });
    // keep the DOM order = the view order (keyboard focus order)
    [...visible].sort((a, b) => a.dataset.pos - b.dataset.pos).forEach((li) => grid.append(li));
    grid.style.height = `${bottom}px`;
    empty.hidden = view.length > 0 || parts.length > 0;
    sentinel.hidden = visible.size >= view.length && !parts.length;
  };

  let loading = null;
  const loadNext = () => {
    if (!loading && parts.length) {
      loading = fetchPart(parts[0]).catch(() => []).then((cellRows) => {
        parts.shift();
        cellRows.forEach((cells) => {
          const it = parseItem(cells, items.length, kind);
          if (it) items.push(it);
        });
        loading = null;
      });
    }
    return loading || Promise.resolve();
  };
  const loadAll = async () => {
    // eslint-disable-next-line no-await-in-loop -- parts are appended in order
    while (parts.length) await loadNext();
  };

  const filtering = () => !!state.query || Object.values(state.filters).some((x) => x.size);
  const computeView = () => {
    const q = state.query.toLowerCase();
    let view = items.filter((it) => (!q || it.title.toLowerCase().includes(q))
      && Object.entries(state.filters).every(([key, set]) => !set.size || set.has(it[key])));
    // the authored order is Frontify's "Date added, newest first"
    if (state.order === 'oldest') view = view.slice().reverse();
    state.view = view;
    const total = authoredCount || itemsLabel(items.length);
    count.textContent = filtering() ? itemsLabel(view.length) : total;
  };

  // render more rows while the end of the grid is near the viewport
  let filling = false;
  const fill = () => {
    if (filling) return;
    filling = true;
    requestAnimationFrame(() => {
      filling = false;
      const near = sentinel.getBoundingClientRect().top < window.innerHeight + 600;
      if (!grid.clientWidth || !near) return;
      if (state.shown < state.view.length) {
        state.shown += BATCH;
        layout();
        fill();
      } else if (parts.length) {
        // the tiles of this page are shown: append the next part (same order)
        loadNext().then(() => { computeView(); layout(); fill(); });
      }
    });
  };

  // search, filters and sort cover all parts: load the remaining parts first
  let run = 0;
  const update = async () => {
    run += 1;
    const mine = run;
    if (parts.length && (filtering() || state.order !== 'newest')) {
      block.setAttribute('aria-busy', 'true');
      await loadAll();
      block.removeAttribute('aria-busy');
      if (mine !== run) return;
    }
    computeView();
    state.shown = BATCH;
    layout();
    fill();
  };

  if (sort) {
    sort.select('newest');
    sort.options.forEach((o) => o.addEventListener('click', () => {
      state.order = o.dataset.value;
      sort.select(state.order);
      sort.close();
      update();
    }));
  }
  document.addEventListener(LIBRARY_FILTER_EVENT, (e) => {
    state.query = e.detail?.query || '';
    state.filters = e.detail?.filters || {};
    update();
  });

  new ResizeObserver(() => { if (grid.clientWidth !== state.width) layout(); }).observe(grid);
  new IntersectionObserver((entries) => {
    if (entries.some((en) => en.isIntersecting)) fill();
  }, { rootMargin: '600px 0px' }).observe(sentinel);
  layout();
}
