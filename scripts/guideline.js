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

function renderSidebar(categories, current) {
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
    li.className = `category${isCurrentCat ? ' open active' : ''}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-title';
    btn.textContent = cat.title;
    btn.setAttribute('aria-expanded', isCurrentCat ? 'true' : 'false');
    btn.setAttribute('aria-controls', `sidebar-cat-${ci}`);
    btn.addEventListener('click', () => {
      const open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
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

function scrollSpy(sidebar) {
  const items = [...sidebar.querySelectorAll('.page.active .heading')];
  if (!items.length) return;
  const targets = items.map((li) => document.getElementById(li.dataset.slug)).filter(Boolean);
  const update = () => {
    let active = null;
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
}

/** Async part: sidebar, anchors, pagination, last modified. */
export async function loadGuideline(main) {
  const current = normalizePath(window.location.pathname);
  let categories = [];
  try {
    const frag = await loadFragment(contentPath('/sidebar'));
    if (frag) categories = parseSidebar(frag);
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
  const pag = pagination(flat, current);
  if (pag) {
    content.append(pag);
    decorateIcons(pag);
    localizeLinks(pag);
  }
  const lm = getMetadata('last-modified');
  if (lm) {
    const p = document.createElement('p');
    p.className = 'guideline-last-modified';
    p.textContent = `Last modified on ${lm}`;
    content.append(p);
  }
  scrollSpy(sidebar);
  goToTop();

  const { hash } = window.location;
  if (hash) {
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) el.scrollIntoView();
  }
}
