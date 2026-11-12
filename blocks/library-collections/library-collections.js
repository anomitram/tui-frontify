/*
 * Library Collections: the curated collections of a Frontify library (cards with a 2x2 collage,
 * name, "Featured • N assets"); two rows are shown, "Show more" reveals the rest.
 * Rows: settings "Title | <heading>", "Sort | <label>"; then one row per collection:
 * pictures (up to 4) | name | "Featured" or empty | "N assets" | link.
 */
import { readLibraryRows, LIBRARY_ICONS } from '../../scripts/library.js';

const VISIBLE_ROWS = 2;
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function buildCard(cells) {
  const [picsCell, nameCell, featuredCell, countCell, linkCell] = cells;
  const a = linkCell?.querySelector('a');
  const card = el(a ? 'a' : 'div', 'library-collection');
  if (a) {
    card.href = a.getAttribute('href');
    if (/^https?:/.test(card.href)) { card.target = '_blank'; card.rel = 'noopener'; }
  }
  const collage = el('span', 'library-collage');
  const imgs = [...(picsCell?.querySelectorAll('img') || [])].slice(0, 4);
  for (let i = 0; i < 4; i += 1) {
    const cellEl = el('span', 'library-collage-cell');
    const img = imgs[i];
    if (img) {
      img.loading = 'lazy';
      img.alt = '';
      cellEl.append(img.closest('picture') || img);
    }
    collage.append(cellEl);
  }
  const text = el('span', 'library-collection-text');
  const name = el('span', 'library-collection-name', nameCell?.textContent.trim() || '');
  const meta = el('span', 'library-collection-meta');
  const featured = featuredCell?.textContent.trim();
  if (featured) meta.append(el('span', 'library-collection-featured', featured), el('span', null, '•'));
  meta.append(document.createTextNode(countCell?.textContent.trim() || ''));
  text.append(name, meta);
  card.append(collage, text);
  const li = el('li');
  li.append(card);
  return li;
}

export default function decorate(block) {
  const { settings, items } = readLibraryRows(block, ['title', 'sort']);
  block.textContent = '';
  const header = el('div', 'library-header');
  const titles = el('div', 'library-heading');
  const h = settings.title?.querySelector('h1, h2, h3, h4, h5, h6') || el('h2', null, settings.title?.textContent.trim() || 'Collections');
  titles.append(h, el('span', 'library-count', `${items.length} item${items.length === 1 ? '' : 's'}`));
  header.append(titles);
  if (settings.sort) {
    // the collection order is Frontify's "Default"; no other order is known offline
    const sort = el('span', 'library-sort-label');
    sort.innerHTML = `${LIBRARY_ICONS.sort}<span></span>${LIBRARY_ICONS.caret}`;
    sort.querySelector('span').textContent = settings.sort.textContent.trim();
    header.append(sort);
  }
  const list = el('ul', 'library-collection-list');
  items.forEach((cells) => list.append(buildCard(cells)));
  const more = el('button', 'library-show-more', 'Show more');
  more.type = 'button';
  const moreWrap = el('div', 'library-show-more-wrap');
  moreWrap.append(more);
  block.append(header, list, moreWrap);

  let expanded = false;
  const apply = () => {
    const cols = getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const limit = expanded ? Infinity : cols * VISIBLE_ROWS;
    [...list.children].forEach((li, i) => { li.hidden = i >= limit; });
    moreWrap.hidden = expanded || items.length <= limit;
  };
  more.addEventListener('click', () => {
    const firstHidden = [...list.children].find((li) => li.hidden);
    expanded = true;
    apply();
    firstHidden?.querySelector('a')?.focus();
  });
  new ResizeObserver(apply).observe(list);
  apply();
}
