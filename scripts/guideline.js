/*
 * Guideline page template (Frontify document layout):
 * sidebar navigation, page title, heading anchors, pagination, last modified, go-to-top.
 * The sidebar comes from the /sidebar document (built by the importer from the Frontify
 * navigation tree), so it stays authorable.
 */
import { getMetadata, decorateIcons } from './aem.js';
// eslint-disable-next-line import/no-cycle
import { CONTENT_BASE, contentPath, localizeLinks } from './scripts.js';
// eslint-disable-next-line import/no-cycle
import { loadFragment } from '../blocks/fragment/fragment.js';

const normalizePath = (p) => {
  let path = p.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  if (CONTENT_BASE && path.startsWith(`${CONTENT_BASE}/`)) path = path.slice(CONTENT_BASE.length);
  return path;
};

function icon(name) {
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  return span;
}

/** Parse the sidebar document into [{ title, pages: [{ title, href, headings }] }]. */
export function parseSidebar(root) {
  const list = root.querySelector('ul');
  if (!list) return [];
  return [...list.children].map((li) => {
    const strong = li.querySelector(':scope > strong, :scope > p > strong');
    const pagesUl = li.querySelector(':scope > ul');
    const ownLink = strong ? null : li.querySelector('a');
    const toPage = (pli) => {
      const a = pli.querySelector(':scope > a, :scope > p > a, :scope > p > em > a, :scope > em > a');
      const hs = pli.querySelector(':scope > ul');
      return {
        title: a ? a.textContent.trim() : '',
        href: a ? normalizePath(new URL(a.href, window.location).pathname) : '',
        headings: hs ? [...hs.querySelectorAll(':scope > li > a, :scope > li > p > a')].map((h) => {
          const u = new URL(h.href, window.location);
          return { title: h.textContent.trim(), slug: decodeURIComponent(u.hash.slice(1)) };
        }) : [],
      };
    };
    if (strong && pagesUl) {
      return { title: strong.textContent.trim(), pages: [...pagesUl.children].map(toPage) };
    }
    if (ownLink) {
      const pg = toPage(li);
      // italic link text: untitled page, hidden in the sidebar, labelled by the document title
      // (decorateButtons turns an italic-only link into a "secondary" button, so check that too)
      const italic = ownLink.querySelector('em') || ownLink.closest('em') || ownLink.classList.contains('secondary');
      if (italic) Object.assign(pg, { hidden: true, label: pg.title, title: '' });
      return { title: null, pages: [pg] };
    }
    return null;
  }).filter(Boolean);
}

/*
 * Pages in Frontify's new document theme (body class "doc-sections", e.g. The Mora): all categories
 * stay expanded (sidebarItemNestingChoice "always-visible"), the pagination stays inside the
 * current category and is left out on a category's first page, and the first heading counts as
 * active until another one is scrolled to (all measured on the captures).
 */
const isDocTheme = () => document.body.classList.contains('doc-sections');

function renderSidebar(categories, current) {
  const docTheme = isDocTheme();
  const nav = document.createElement('nav');
  nav.className = 'guideline-sidebar';
  nav.setAttribute('aria-label', 'Guideline navigation');
  const ul = document.createElement('ul');
  categories.forEach((cat, ci) => {
    const isCurrentCat = cat.pages.some((p) => p.href === current);
    if (cat.title === null) {
      // uncategorised page: rendered as a top-level page link
      cat.pages.filter((p) => !p.hidden).forEach((p) => {
        const li = document.createElement('li');
        li.className = `page uncategorized${p.href === current ? ' active' : ''}`;
        const a = document.createElement('a');
        a.href = p.href;
        a.textContent = p.title;
        li.append(a);
        ul.append(li);
      });
      return;
    }
    const li = document.createElement('li');
    const open = isCurrentCat || docTheme;
    li.className = `category${open ? ' open' : ''}${isCurrentCat ? ' active' : ''}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-title';
    btn.textContent = cat.title;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-controls', `sidebar-cat-${ci}`);
    if (!docTheme) {
      btn.addEventListener('click', () => {
        const isOpen = li.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }
    li.append(btn);
    const pages = document.createElement('ul');
    pages.id = `sidebar-cat-${ci}`;
    cat.pages.forEach((p) => {
      const pli = document.createElement('li');
      pli.className = `page${p.href === current ? ' active' : ''}`;
      const a = document.createElement('a');
      a.href = p.href;
      a.textContent = p.title;
      if (p.href === current) a.setAttribute('aria-current', 'page');
      pli.append(a);
      if (p.headings.length) {
        const hs = document.createElement('ul');
        p.headings.forEach((h) => {
          const hli = document.createElement('li');
          hli.className = 'heading';
          hli.dataset.slug = h.slug;
          const ha = document.createElement('a');
          ha.href = `${p.href}#${h.slug}`;
          ha.textContent = h.title;
          hli.append(ha);
          hs.append(hli);
        });
        pli.append(hs);
      }
      pages.append(pli);
    });
    li.append(pages);
    ul.append(li);
  });
  nav.append(ul);
  return nav;
}

/** Give page headings the original Frontify slugs (sidebar + /r/ permalinks rely on them). */
function applyHeadingAnchors(main, page) {
  if (!page) return;
  const h2s = [...main.querySelectorAll('.section h2')];
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  let from = 0;
  page.headings.forEach((h) => {
    const idx = h2s.findIndex((el, i) => i >= from && norm(el.textContent) === norm(h.title));
    if (idx < 0) return;
    const el = h2s[idx];
    el.id = h.slug;
    el.classList.add('page-heading');
    from = idx + 1;
  });
}

/** Frontify headings are separate blocks: give each its own wrapper so the block gap applies. */
function splitHeadingWrappers(main) {
  main.querySelectorAll('.default-content-wrapper > h2.page-heading').forEach((h) => {
    const wrapper = h.parentElement;
    const after = [];
    let n = h.nextSibling;
    while (n) { after.push(n); n = n.nextSibling; }
    const before = [];
    n = h.previousSibling;
    while (n) { before.unshift(n); n = n.previousSibling; }
    if (before.some((x) => x.nodeType === 1)) {
      const pre = document.createElement('div');
      pre.className = 'default-content-wrapper';
      pre.append(...before);
      wrapper.before(pre);
    }
    if (after.some((x) => x.nodeType === 1)) {
      const post = document.createElement('div');
      post.className = 'default-content-wrapper';
      post.append(...after);
      wrapper.after(post);
    }
  });
}

function pagination(flat, current) {
  const i = flat.findIndex((p) => p.href === current);
  if (i < 0) return null;
  const navEl = document.createElement('nav');
  navEl.className = 'guideline-pagination';
  navEl.setAttribute('aria-label', 'Pagination of the current page');
  const make = (p, dir) => {
    const a = document.createElement('a');
    a.href = p.href;
    a.className = dir;
    const label = document.createElement('span');
    label.className = 'label';
    label.innerHTML = '<span class="category"></span><span class="title"></span>';
    label.querySelector('.category').textContent = p.category || '';
    label.querySelector('.title').textContent = p.title;
    if (dir === 'prev') a.append(label, icon('chevron-left'));
    else a.append(icon('chevron-right'), label);
    a.setAttribute('aria-label', `${dir === 'prev' ? 'Previous' : 'Next'} page: ${p.title}`);
    return a;
  };
  // Frontify layout: two halves around a centre divider (the divider belongs to "next").
  const prevSlot = document.createElement('div');
  prevSlot.className = 'slot prev-slot';
  const nextSlot = document.createElement('div');
  nextSlot.className = 'slot next-slot';
  if (flat[i - 1]) prevSlot.append(make(flat[i - 1], 'prev'));
  if (flat[i + 1]) nextSlot.append(make(flat[i + 1], 'next'));
  else navEl.classList.add('no-next');
  navEl.append(prevSlot, nextSlot);
  return navEl;
}

/* Frontify's caret icons (inline, so they take the theme colour) */
const DOC_CARETS = {
  prev: 'M16.31 19.78a.75.75 0 01-1.06 0L8 12.53 7.47 12l.53-.53 7.25-7.25a.75.75 0 011.06 1.06L9.59 12l6.72 6.72a.75.75 0 010 1.06',
  next: 'M7.69 4.22a.75.75 0 011.06 0L16 11.47l.53.53-.53.53-7.25 7.25a.75.75 0 01-1.06-1.06L14.41 12 7.69 5.28a.75.75 0 010-1.06',
};

/**
 * Document theme pagination: previous / next page of the current category, two halves around a 1px
 * divider (Frontify markup: row > box (max 1200px + content padding) > nav > grid 1fr 1px 1fr).
 * Not shown on a category's first page.
 */
function docPagination(categories, current) {
  // Frontify: previous/next page in document order, across categories (e.g. the last page of a
  // category links to the first page of the next one); a page can hide it ("Pagination: hide",
  // from the page's resolved theme setting paginationVisibility).
  if (getMetadata('pagination') === 'hide') return null;
  const pages = categories.flatMap((c) => c.pages.filter((p) => !p.hidden)
    .map((p) => ({ ...p, category: c.title || p.label || '' })));
  const i = pages.findIndex((p) => p.href === current);
  // the first page of a document has none (measured: no capture shows a lone "next")
  if (i < 1) return null;
  const make = (p, dir) => {
    const a = document.createElement('a');
    a.href = p.href;
    a.className = dir;
    a.setAttribute('aria-label', `${dir === 'prev' ? 'Previous' : 'Next'} page: ${p.title}`);
    a.innerHTML = `<span class="label"><span class="category"></span><span class="title"></span></span><span class="caret"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="${DOC_CARETS[dir]}"/></svg></span>`;
    a.querySelector('.category').textContent = p.category;
    a.querySelector('.title').textContent = p.title;
    return a;
  };
  const row = document.createElement('div');
  row.className = 'guideline-pagination-row';
  const box = document.createElement('div');
  box.className = 'guideline-pagination-box';
  const nav = document.createElement('nav');
  nav.className = 'guideline-pagination';
  nav.setAttribute('aria-label', 'Pagination of the current page');
  const grid = document.createElement('div');
  grid.className = 'guideline-pagination-grid';
  const prev = document.createElement('div');
  prev.className = 'slot prev-slot';
  if (pages[i - 1]) prev.append(make(pages[i - 1], 'prev'));
  else prev.setAttribute('aria-hidden', 'true');
  const divider = document.createElement('hr');
  divider.setAttribute('aria-orientation', 'vertical');
  const next = document.createElement('div');
  next.className = 'slot next-slot';
  if (pages[i + 1]) next.append(make(pages[i + 1], 'next'));
  else next.setAttribute('aria-hidden', 'true');
  grid.append(prev, divider, next);
  nav.append(grid);
  box.append(nav);
  row.append(box);
  return row;
}

/**
 * Frontify lays the page out in a table that grows to the widest content: on narrow screens a
 * pagination wider than the content column widens the column (up to 100vw, the right part then
 * scrolls). Expose the pagination's min-content width for the column's min-width.
 */
function fitDocPagination(content, row) {
  const nav = row.querySelector('.guideline-pagination');
  const measure = () => {
    nav.style.width = 'min-content';
    const w = nav.getBoundingClientRect().width;
    nav.style.width = '';
    content.style.setProperty('--pagination-min-width', `${Math.ceil(w)}px`);
  };
  measure();
  document.fonts?.ready.then(measure);
  document.fonts?.addEventListener?.('loadingdone', measure);
}

function scrollSpy(sidebar) {
  const items = [...sidebar.querySelectorAll('.page.active .heading')];
  if (!items.length) return;
  const targets = items.map((li) => document.getElementById(li.dataset.slug)).filter(Boolean);
  const update = () => {
    let active = isDocTheme() && targets[0] ? targets[0].id : null;
    targets.forEach((t) => { if (t.getBoundingClientRect().top < window.innerHeight * 0.3) active = t.id; }); // eslint-disable-line max-len
    items.forEach((li) => li.classList.toggle('active', li.dataset.slug === active));
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function goToTop() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'go-to-top';
  btn.setAttribute('aria-label', 'Go to top');
  btn.append(icon('arrow-up'));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400), { passive: true });
  document.body.append(btn);
  decorateIcons(btn);
}

/** Synchronous part (before LCP): wrap main into the sidebar/content layout. */
export function decorateGuidelineLayout(main) {
  const content = document.createElement('div');
  content.className = 'guideline-content';
  content.append(...main.children);
  const first = content.querySelector(':scope > .section');
  if (first && first.querySelector('h1') && first.children.length === 1) first.classList.add('page-title');
  const placeholder = document.createElement('nav');
  placeholder.className = 'guideline-sidebar';
  main.append(placeholder, content);
  // metadata "Sidebar: none" (document with one uncategorised page): known before first paint
  if (getMetadata('sidebar') === 'none') document.body.classList.add('no-sidebar');
}

/**
 * The sidebar's heading links carry the Frontify slugs as "#slug", but publishing drops the "#..."
 * of same-site links. Fill missing slugs from scripts/guideline-slugs.json (the exported Frontify
 * slugs per page, in order; tools/frontify-export/write_heading_slugs.py).
 */
async function fillMissingSlugs(categories) {
  const pages = categories.flatMap((c) => c.pages);
  if (!pages.some((p) => p.headings.some((h) => !h.slug))) return;
  let known = {};
  try {
    const res = await fetch(`${window.hlx.codeBasePath}/scripts/guideline-slugs.json`);
    if (res.ok) known = await res.json();
  } catch (e) { /* fall back to text-derived slugs */ }
  const norm = (t) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  pages.forEach((p) => {
    const list = (known[p.href] || [])
      .map(([title, slug]) => ({ title: norm(title), slug, used: false }));
    p.headings.forEach((h) => {
      if (h.slug) return;
      const hit = list.find((k) => !k.used && k.title === norm(h.title));
      if (hit) hit.used = true;
      h.slug = hit ? hit.slug
        : norm(h.title).replace(/[^0-9a-z]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    });
  });
}

/** Async part: sidebar, anchors, pagination, last modified. */
/**
 * In-content links to a heading ("/page#slug") lose their "#slug" in the content upload. Put it
 * back from scripts/link-anchors.json ({page: [[link text, target path, slug], ...]}, written by
 * tools/frontify-export/write_link_anchors.py), matching links by target and text, in order.
 */
async function restoreLinkAnchors(main, current) {
  const content = main.querySelector('.guideline-content') || main;
  const candidates = [...content.querySelectorAll('a[href]')].filter((a) => {
    const u = new URL(a.href, window.location);
    return u.origin === window.location.origin && !u.hash && !/\.\w{2,5}$/.test(u.pathname);
  });
  if (!candidates.length) return;
  let map = {};
  try {
    const res = await fetch(`${window.hlx.codeBasePath}/scripts/link-anchors.json`);
    if (res.ok) map = await res.json();
  } catch (e) { return; }
  const list = (map[current] || []).map(([text, target, slug]) => ({
    text: text.replace(/\s+/g, ' ').trim(), target, slug, used: false,
  }));
  if (!list.length) return;
  candidates.forEach((a) => {
    const target = normalizePath(new URL(a.href, window.location).pathname);
    const text = a.textContent.replace(/\s+/g, ' ').trim();
    const hit = list.find((l) => !l.used && l.target === target && l.text === text);
    if (!hit) return;
    hit.used = true;
    a.hash = hit.slug;
  });
}

export async function loadGuideline(main) {
  const current = normalizePath(window.location.pathname);
  let categories = [];
  try {
    // per-document sidebar (metadata "Sidebar", e.g. /the-mora/brand/sidebar); doc 396: /sidebar
    const sidebarMeta = getMetadata('sidebar');
    const sidebarPath = sidebarMeta ? new URL(sidebarMeta, window.location).pathname : '/sidebar';
    const frag = sidebarMeta === 'none' ? null : await loadFragment(contentPath(sidebarPath));
    if (frag) categories = parseSidebar(frag);
    await fillMissingSlugs(categories);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('sidebar failed to load', e);
  }
  const flat = categories.flatMap((c) => c.pages.map((p) => ({ ...p, category: c.title || p.label || '' })));
  const page = flat.find((p) => p.href === current);
  applyHeadingAnchors(main, page);
  splitHeadingWrappers(main);

  const sidebar = renderSidebar(categories, current);
  main.querySelector('.guideline-sidebar').replaceWith(sidebar);
  decorateIcons(sidebar);
  localizeLinks(sidebar);

  const content = main.querySelector('.guideline-content');
  const docTheme = isDocTheme();
  // document theme: a document with a single uncategorised page has no sidebar (measured)
  const single = flat.filter((p) => !p.hidden).length <= 1
    && categories.every((c) => c.title === null);
  if (docTheme && single) document.body.classList.add('no-sidebar');
  const pag = docTheme ? docPagination(categories, current) : pagination(flat, current);
  if (pag) {
    content.append(pag);
    decorateIcons(pag);
    localizeLinks(pag);
    if (docTheme) fitDocPagination(content, pag);
  }
  const lm = getMetadata('last-modified');
  if (lm) {
    const p = document.createElement('p');
    p.className = 'guideline-last-modified';
    p.textContent = `Last modified on ${lm}`;
    if (docTheme) {
      // same row + box as the pagination (Frontify markup)
      const row = document.createElement('div');
      row.className = 'guideline-last-modified-row';
      const box = document.createElement('div');
      box.className = 'guideline-last-modified-box';
      box.append(p);
      row.append(box);
      content.append(row);
    } else content.append(p);
  }
  scrollSpy(sidebar);
  goToTop();
  await restoreLinkAnchors(main, current);

  const { hash } = window.location;
  if (hash) {
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) el.scrollIntoView();
  }
}
