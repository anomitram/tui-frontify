import { decorateIcons, getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { contentPath, localizeLinks } from '../../scripts/scripts.js';

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
      if (a) {
        item.append(a);
        try {
          if (new URL(a.href, window.location).pathname.split('/')[1] === window.location.pathname.split('/')[1]
            || !isExternal(a.href)) a.classList.add('active');
        } catch (e) { /* ignore */ }
      } else item.textContent = li.textContent;
      ul.append(item);
    }
  });
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
    const text = li.textContent;
    const m = /:([\w-]+):\s*(.*)/.exec(text);
    const name = m ? m[1] : '';
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

export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(contentPath(navPath));
  block.textContent = '';
  if (!fragment) return;
  const [brandSec, linksSec, toolsSec] = [...fragment.children];

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

  const links = linksSec ? buildLinks(linksSec) : document.createElement('ul');
  const { tools, hamburger } = buildTools(toolsSec, nav);
  inner.append(brand, links, tools);
  nav.append(inner);

  const menu = buildMobileMenu(links);
  nav.append(menu);
  hamburger.addEventListener('click', () => {
    const open = nav.getAttribute('aria-expanded') !== 'true';
    nav.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.style.overflowY = open ? 'hidden' : '';
    const slot = menu.querySelector('.nav-menu-sidebar');
    if (open && !slot.children.length) {
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
  wrapper.append(rail, nav);
  block.append(wrapper);
  decorateIcons(wrapper);
  localizeLinks(wrapper);

  const refit = () => fitLinks(inner, links);
  requestAnimationFrame(refit);
  document.fonts?.ready.then(refit);
  window.addEventListener('resize', refit);
}
