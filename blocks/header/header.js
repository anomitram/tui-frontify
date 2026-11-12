import { decorateIcons, getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { CONTENT_BASE, contentPath, localizeLinks } from '../../scripts/scripts.js';

/*
 * Frontify document header: left rail ("Back to dashboard"), sky-blue bar with logo,
 * portal navigation (groups become dropdowns, overflow collapses into "More"),
 * and tool icons (Brand Hub, Search, Brand Assistant, mobile menu).
 * Content: /nav document with three sections: brand | links | tools.
 */

const isDesktop = window.matchMedia('(min-width: 900px)');

function icon(name) {
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  return span;
}

function isExternal(href) {
  try { return new URL(href, window.location).origin !== window.location.origin; } catch (e) { return false; } // eslint-disable-line max-len
}

function closeAll(scope, except) {
  scope.querySelectorAll('.nav-drop[aria-expanded="true"], .nav-drop > button[aria-expanded="true"]').forEach((el) => {
    const li = el.closest('.nav-drop');
    if (li !== except) {
      li.setAttribute('aria-expanded', 'false');
      li.querySelector(':scope > button').setAttribute('aria-expanded', 'false');
    }
  });
}

function buildDropItem(label, sublist) {
  const li = document.createElement('li');
  li.className = 'nav-drop';
  li.setAttribute('aria-expanded', 'false');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.append(document.createTextNode(label), icon('chevron-down'));
  const panel = document.createElement('ul');
  panel.className = 'nav-drop-panel';
  [...sublist.children].forEach((c) => panel.append(c));
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = li.getAttribute('aria-expanded') !== 'true';
    closeAll(li.closest('nav'), li.parentElement.closest('.nav-drop'));
    li.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  li.append(btn, panel);
  return li;
}

function decorateLinks(list) {
  list.querySelectorAll('a').forEach((a) => {
    if (isExternal(a.href)) {
      a.target = '_blank';
      a.rel = 'noopener';
      if (a.closest('.nav-drop-panel')) a.append(icon('external-link'));
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = ' (opens in a new tab)';
      a.append(sr);
    }
  });
}

function buildLinks(section) {
  const src = section.querySelector('ul');
  const ul = document.createElement('ul');
  ul.className = 'nav-links';
  if (!src) return ul;
  [...src.children].forEach((li) => {
    const sub = li.querySelector(':scope > ul');
    if (sub) {
      const label = [...li.childNodes].filter((n) => n.nodeType === 3 || (n.nodeType === 1 && n.tagName !== 'UL'))
        .map((n) => n.textContent).join('').trim();
      ul.append(buildDropItem(label, sub));
    } else {
      const item = document.createElement('li');
      item.className = 'nav-item';
      const a = li.querySelector('a');
      if (a) item.append(a);
      else item.textContent = li.textContent;
      ul.append(item);
    }
  });
  // current page: the local link whose path is the longest prefix of this page (The Mora: Home,
  // Brand, Hotels, Support); with a single local link (document 396's own) that link
  const strip = (p) => (CONTENT_BASE && p.startsWith(`${CONTENT_BASE}/`) ? p.slice(CONTENT_BASE.length) : p).replace(/\/$/, '') || '/';
  const cur = strip(window.location.pathname);
  const local = [...ul.querySelectorAll(':scope > li > a')].filter((a) => !isExternal(a.href));
  const pathOf = (a) => strip(new URL(a.href, window.location).pathname);
  let best = null;
  local.forEach((a) => {
    const p = pathOf(a);
    if ((cur === p || cur.startsWith(`${p}/`)) && (!best || p.length > pathOf(best).length)) best = a;
  });
  if (!best && local.length === 1) [best] = local;
  // a longer match inside a dropdown (The Mora: Libraries > Overview) marks the dropdown button
  let bestDrop = null;
  ul.querySelectorAll(':scope > .nav-drop .nav-drop-panel a').forEach((a) => {
    if (isExternal(a.href)) return;
    const p = pathOf(a);
    if ((cur === p || cur.startsWith(`${p}/`)) && p.length > (bestDrop || best ? pathOf(bestDrop || best).length : 0)) bestDrop = a;
  });
  if (bestDrop) bestDrop.closest('.nav-drop').querySelector(':scope > button').classList.add('active');
  else if (best) best.classList.add('active');
  decorateLinks(ul);
  return ul;
}

/** Collapse links that do not fit into a trailing "More" dropdown (Frontify behaviour). */
function fitLinks(bar, links) {
  const more = links.querySelector(':scope > .nav-more');
  if (more) {
    const items = [...more.querySelector('.nav-drop-panel').children];
    items.forEach((it) => links.insertBefore(it, more));
    more.remove();
  }
  if (!isDesktop.matches) return;
  // Frontify keeps a 4.8vw column gutter on both sides of the links before collapsing to More.
  const reserve = () => 0.096 * window.innerWidth + 24; // + one link gap
  const used = () => {
    const kids = [...links.children];
    if (!kids.length) return 0;
    return kids[kids.length - 1].getBoundingClientRect().right - kids[0].getBoundingClientRect().left; // eslint-disable-line max-len
  };
  const fits = () => used() <= links.clientWidth - reserve() + 1;
  if (fits()) return;
  const panel = document.createElement('ul');
  const moreLi = buildDropItem('More', panel);
  moreLi.classList.add('nav-more');
  links.append(moreLi);
  const morePanel = moreLi.querySelector('.nav-drop-panel');
  const candidates = () => [...links.children].filter((c) => c !== moreLi);
  while (!fits() && candidates().length > 1) {
    const last = candidates().pop();
    morePanel.prepend(last);
  }
  decorateIcons(moreLi);
}

function buildSearch() {
  const dialog = document.createElement('dialog');
  dialog.className = 'nav-search-dialog';
  dialog.innerHTML = `<form method="dialog" class="nav-search-form">
      <label class="sr-only" for="nav-search-input">Search this guideline</label>
      <input id="nav-search-input" type="search" placeholder="Search" autocomplete="off">
      <button type="submit" class="nav-search-close" aria-label="Close search"></button>
    </form>
    <ul class="nav-search-results" role="listbox"></ul>`;
  dialog.querySelector('.nav-search-close').append(icon('close'));
  const input = dialog.querySelector('input');
  const results = dialog.querySelector('.nav-search-results');
  let index = null;
  const buildIndex = async () => {
    if (index) return index;
    index = [];
    const frag = await loadFragment(contentPath('/sidebar'));
    frag?.querySelectorAll('a').forEach((a) => {
      const u = new URL(a.href, window.location);
      const pageLi = a.closest('li');
      const cat = a.closest('ul')?.closest('li')?.querySelector(':scope > strong, :scope > p > strong')?.textContent;
      const parentPage = u.hash ? pageLi.parentElement.closest('li')?.querySelector(':scope > a, :scope > p > a')?.textContent : null;
      index.push({
        title: a.textContent.trim(), href: `${u.pathname}${u.hash}`, context: [cat, parentPage].filter(Boolean).join(' › '),
      });
    });
    return index;
  };
  input.addEventListener('input', async () => {
    const q = input.value.trim().toLowerCase();
    const idx = await buildIndex();
    results.textContent = '';
    if (!q) return;
    idx.filter((e) => e.title.toLowerCase().includes(q) || e.context.toLowerCase().includes(q)).slice(0, 30).forEach((e) => { // eslint-disable-line max-len
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = e.href;
      a.innerHTML = '<span class="title"></span><span class="context"></span>';
      a.querySelector('.title').textContent = e.title;
      a.querySelector('.context').textContent = e.context;
      a.addEventListener('click', () => dialog.close());
      li.append(a);
      results.append(li);
    });
  });
  return dialog;
}

function buildTools(section, nav) {
  const tools = document.createElement('div');
  tools.className = 'nav-tools';
  const items = section ? [...section.querySelectorAll('li')] : [];
  items.forEach((li) => {
    // The icon is authored as ":name:" text; published pages already turn it into
    // <span class="icon icon-name"> (the local preview keeps the text).
    const text = li.textContent;
    const iconSpan = li.querySelector('span.icon');
    const spanName = iconSpan ? ([...iconSpan.classList].find((c) => c.startsWith('icon-')) || '').slice(5) : '';
    const m = /:([\w-]+):\s*(.*)/.exec(text);
    const name = m ? m[1] : spanName;
    const label = m ? m[2].trim() : text.trim();
    const a = li.querySelector('a');
    if (name === 'search') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-tool nav-tool-search';
      btn.setAttribute('aria-label', label || 'Search');
      btn.append(icon('search'));
      const dialog = buildSearch();
      nav.append(dialog);
      btn.addEventListener('click', () => { dialog.showModal(); dialog.querySelector('input').focus(); });
      tools.append(btn);
      return;
    }
    const link = document.createElement('a');
    link.className = `nav-tool nav-tool-${name}`;
    link.href = a ? a.href : '#';
    if (a && isExternal(a.href)) { link.target = '_blank'; link.rel = 'noopener'; }
    if (name === 'brand-hub') {
      link.append(icon('brand-hub'));
      const span = document.createElement('span');
      span.textContent = label;
      link.append(span);
    } else {
      link.setAttribute('aria-label', label);
      link.append(icon(name));
    }
    tools.append(link);
  });
  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = 'nav-tool nav-hamburger';
  hamburger.setAttribute('aria-label', 'Open navigation');
  hamburger.setAttribute('aria-controls', 'nav-menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.append(icon('menu'), icon('close'));
  tools.append(hamburger);
  return { tools, hamburger };
}

function buildMobileMenu(links) {
  const menu = document.createElement('div');
  menu.id = 'nav-menu';
  menu.className = 'nav-menu';
  const linkClone = links.cloneNode(true);
  linkClone.classList.add('nav-menu-links');
  linkClone.querySelectorAll('.nav-drop > button').forEach((b) => {
    b.addEventListener('click', () => {
      const li = b.closest('.nav-drop');
      const open = li.getAttribute('aria-expanded') !== 'true';
      li.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  menu.append(linkClone);
  const sidebarSlot = document.createElement('div');
  sidebarSlot.className = 'nav-menu-sidebar';
  menu.append(sidebarSlot);
  return menu;
}

/* Frontify document theme mobile navigation (icons copied from Frontify's markup) */
const DOC_MENU_CHEVRON = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>';
const DOC_MENU_CLOSE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" d="M17.964 4.764a.9.9 0 011.273 1.273L13.273 12l5.964 5.964a.9.9 0 01-1.273 1.273l-5.963-5.964-5.964 5.963a.9.9 0 01-1.273-1.273L10.728 12 4.764 6.037a.9.9 0 011.273-1.273l5.964 5.964z"/></svg>';

/** Page path without the local preview mount, ".html" and a trailing slash. */
function sitePath(href) {
  let p = new URL(href, window.location).pathname;
  if (CONTENT_BASE && p.startsWith(`${CONTENT_BASE}/`)) p = p.slice(CONTENT_BASE.length);
  return p.replace(/\.html$/, '').replace(/\/$/, '') || '/';
}

function docMenuLink(href, text, cls, current) {
  const a = document.createElement('a');
  a.href = href;
  a.className = `doc-menu-link ${cls}${current ? ' current' : ''}`;
  if (current) {
    a.setAttribute('aria-current', 'page');
    a.innerHTML = '<span class="sr-only">Current page: </span>';
  }
  a.append(document.createTextNode(text));
  return a;
}

/** Accordion item: trigger button + panel; fill(panel) runs on first open. */
function docMenuAccordion(label, level, open, fill) {
  const li = document.createElement('li');
  li.className = `doc-menu-item level-${level}`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'doc-menu-trigger';
  btn.innerHTML = `<span class="doc-menu-trigger-inner"><span class="doc-menu-label"></span><span class="doc-menu-chevron">${DOC_MENU_CHEVRON}</span></span>`;
  btn.querySelector('.doc-menu-label').textContent = label;
  btn.querySelector('.doc-menu-label').title = label;
  const panel = document.createElement('div');
  panel.className = 'doc-menu-panel';
  let filled = null;
  const set = async (isOpen) => {
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    li.classList.toggle('open', isOpen);
    panel.hidden = !isOpen;
    if (isOpen && !filled) filled = fill(panel);
    await filled;
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  li.append(btn, panel);
  const ready = set(open);
  return { li, ready };
}

/**
 * Frontify document theme (pages with doc sections) mobile navigation: a dark panel with the portal
 * navigation as an accordion. Every document lists its categories and pages from its sidebar
 * document (<document path>/sidebar, loaded when the document is opened); the current document and
 * category start open. Library documents (no sidebar) are plain links. Search and Brand Assistant
 * are excluded, as in the header.
 */
async function buildDocMenu(menu, linkList, tools, close) {
  const { parseSidebar } = await import('../../scripts/guideline.js');
  const cur = sitePath(window.location.href);
  const sidebars = {};
  const sidebarOf = (path) => {
    sidebars[path] = sidebars[path] || loadFragment(contentPath(`${path === '/' ? '' : path}/sidebar`))
      .then((f) => (f ? parseSidebar(f) : null)).catch(() => null);
    return sidebars[path];
  };
  // current document: the navigation path that is the longest prefix of this page
  const docPaths = [...linkList.querySelectorAll('a')].filter((a) => !isExternal(a.href))
    .map((a) => sitePath(a.href)).filter((p) => p !== '/' && (cur === p || cur.startsWith(`${p}/`)));
  const currentDoc = docPaths.sort((a, b) => b.length - a.length)[0];
  const isCurrentDoc = (path) => path === currentDoc;
  const pageList = (pages, cls) => {
    const ul = document.createElement('ul');
    pages.filter((p) => !p.hidden).forEach((p) => {
      const li = document.createElement('li');
      li.append(docMenuLink(p.href, p.title, cls, p.href === cur));
      ul.append(li);
    });
    return ul;
  };
  // a document: its uncategorised pages and categories (accordions), or one link without sidebar
  const fillDoc = (path, label) => async (panel) => {
    const cats = await sidebarOf(path);
    const ul = document.createElement('ul');
    if (!cats || !cats.length) {
      const li = document.createElement('li');
      li.append(docMenuLink(path, label, 'level-2', path === cur));
      ul.append(li);
    }
    const waits = [];
    (cats || []).forEach((cat) => {
      if (cat.title === null) {
        ul.append(...pageList(cat.pages, 'level-2').children);
        return;
      }
      const open = cat.pages.some((p) => p.href === cur);
      const item = docMenuAccordion(cat.title, 2, open, async (p) => p.append(pageList(cat.pages, 'level-3')));
      waits.push(item.ready);
      ul.append(item.li);
    });
    panel.append(ul);
    localizeLinks(panel);
    await Promise.all(waits);
  };
  const divider = () => Object.assign(document.createElement('div'), { className: 'doc-menu-divider' });
  const docItem = (a) => {
    const path = sitePath(a.href);
    const label = a.textContent.trim();
    return docMenuAccordion(label, 1, isCurrentDoc(path), fillDoc(path, label));
  };

  menu.textContent = '';
  menu.classList.add('doc-menu');
  const bar = document.createElement('div');
  bar.className = 'doc-menu-bar';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'doc-menu-close';
  closeBtn.setAttribute('aria-label', 'Close navigation');
  closeBtn.innerHTML = DOC_MENU_CLOSE;
  closeBtn.addEventListener('click', close);
  bar.append(closeBtn);
  const scroller = document.createElement('div');
  scroller.className = 'doc-menu-scroll';
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Document');
  const list = document.createElement('ul');
  list.className = 'doc-menu-list';
  nav.append(list);
  scroller.append(nav);
  menu.append(bar, scroller);

  const waits = [];
  const entries = [...linkList.children];
  // library documents have no sidebar: probe the group items once to tell documents from links
  const probe = await Promise.all(entries.map((li) => (li.classList.contains('nav-drop')
    ? Promise.all([...li.querySelectorAll('.nav-drop-panel a')].map((a) => (isExternal(a.href) ? null : sidebarOf(sitePath(a.href)))))
    : null)));
  entries.forEach((li, i) => {
    const last = i === entries.length - 1;
    if (li.classList.contains('nav-drop')) {
      const group = document.createElement('li');
      const box = document.createElement('div');
      box.className = 'doc-menu-group';
      const title = document.createElement('p');
      title.className = 'doc-menu-group-label';
      title.textContent = li.querySelector(':scope > button').textContent.trim();
      const ul = document.createElement('ul');
      const subs = [...li.querySelectorAll('.nav-drop-panel a')];
      subs.forEach((a, j) => {
        let item;
        if (probe[i][j]) {
          const acc = docItem(a);
          waits.push(acc.ready);
          item = acc.li;
        } else {
          item = document.createElement('li');
          item.append(docMenuLink(a.getAttribute('href'), a.textContent.trim(), 'level-1', sitePath(a.href) === cur));
        }
        if (j < subs.length - 1) item.append(divider());
        ul.append(item);
      });
      box.append(title, ul);
      group.append(box);
      list.append(group);
      return;
    }
    const a = li.querySelector('a');
    if (!a) return;
    if (isExternal(a.href)) {
      const item = document.createElement('li');
      item.append(docMenuLink(a.getAttribute('href'), a.textContent.trim(), 'level-1', false));
      list.append(item);
      return;
    }
    const acc = docItem(a);
    waits.push(acc.ready);
    // Frontify draws a divider under every document except the last navigation item
    if (!last) acc.li.append(divider());
    list.append(acc.li);
  });
  const hub = tools.querySelector('.nav-tool-brand-hub');
  if (hub) {
    const item = document.createElement('li');
    item.append(docMenuLink(hub.getAttribute('href'), hub.textContent.trim(), 'level-1', false));
    list.append(item);
  }
  await Promise.all(waits);
}

export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(contentPath(navPath));
  block.textContent = '';
  if (!fragment) return;
  const [brandSec] = fragment.children;
  let [, linksSec, toolsSec] = [...fragment.children];
  // An empty links section (a portal without navigation, e.g. the homepage) is dropped when the
  // nav is published, so the tools section moves up: recognise it by its tool icons.
  const isTools = (sec) => !!sec && (!!sec.querySelector('.icon-brand-hub, .icon-search, .icon-brand-assistant')
    || /:(brand-hub|search|brand-assistant):/.test(sec.textContent));
  if (!toolsSec && isTools(linksSec)) {
    toolsSec = linksSec;
    linksSec = null;
  }

  // left rail
  const rail = document.createElement('div');
  rail.className = 'header-rail';
  const back = brandSec?.querySelectorAll('a')[1];
  if (back) {
    const a = document.createElement('a');
    a.href = back.href;
    a.className = 'header-rail-back';
    a.setAttribute('aria-label', back.textContent.trim());
    a.append(icon('arrow-left'));
    rail.append(a, Object.assign(document.createElement('span'), { className: 'header-rail-separator' }));
  }

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main navigation');
  const inner = document.createElement('div');
  inner.className = 'nav-inner';

  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  const logoLink = brandSec?.querySelector('a');
  if (logoLink) {
    const a = document.createElement('a');
    a.href = logoLink.href;
    const img = logoLink.querySelector('img');
    if (img) {
      const clean = img.cloneNode();
      clean.removeAttribute('loading');
      clean.width = 100;
      a.append(clean);
    } else a.textContent = logoLink.textContent;
    brand.append(a);
  }

  // no navigation: keep an empty links list so the header grid keeps its three columns
  const links = linksSec ? buildLinks(linksSec) : Object.assign(document.createElement('ul'), { className: 'nav-links' });
  const { tools, hamburger } = buildTools(toolsSec, nav);
  inner.append(brand, links, tools);
  nav.append(inner);

  const menu = buildMobileMenu(links);
  nav.append(menu);
  // Frontify document theme pages (doc sections): Frontify's dark navigation panel instead
  const docMenu = document.body.classList.contains('guideline') && document.body.classList.contains('doc-sections');
  let docMenuBuilt = null;
  hamburger.addEventListener('click', async () => {
    const open = nav.getAttribute('aria-expanded') !== 'true';
    if (open && docMenu) {
      docMenuBuilt = docMenuBuilt || buildDocMenu(menu, menu.querySelector('.nav-menu-links'), tools, () => hamburger.click());
      await docMenuBuilt;
    }
    nav.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.style.overflowY = open ? 'hidden' : '';
    if (open && docMenu) menu.querySelector('.doc-menu-close')?.focus();
    const slot = menu.querySelector('.nav-menu-sidebar');
    if (open && slot && !slot.children.length) {
      const sidebar = document.querySelector('main .guideline-sidebar');
      if (sidebar) slot.append(sidebar.querySelector('ul').cloneNode(true));
      slot.querySelectorAll('.category-title').forEach((b) => b.addEventListener('click', () => b.closest('.category').classList.toggle('open')));
    }
  });
  nav.setAttribute('aria-expanded', 'false');

  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) closeAll(nav); });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      closeAll(nav);
      if (nav.getAttribute('aria-expanded') === 'true') hamburger.click();
    }
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  // optional header background image (Frontify document page "headerBackgroundImage"): a picture in
  // the brand section that is not inside a link
  const bgImg = getMetadata('header-image') === 'none' ? null
    : [...(brandSec?.querySelectorAll('img') || [])].find((i) => !i.closest('a'));
  if (bgImg) {
    const bg = document.createElement('div');
    bg.className = 'nav-background';
    const pic = bgImg.closest('picture') || bgImg;
    bgImg.alt = '';
    bgImg.loading = 'eager';
    bg.append(pic);
    wrapper.classList.add('has-background');
    wrapper.append(bg);
  }
  wrapper.append(rail, nav);
  block.append(wrapper);
  decorateIcons(wrapper);
  localizeLinks(wrapper);

  const refit = () => fitLinks(inner, links);
  requestAnimationFrame(refit);
  document.fonts?.ready.then(refit);
  window.addEventListener('resize', refit);
}
