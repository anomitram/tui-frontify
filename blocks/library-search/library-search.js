/*
 * Library Search: the search bar and filter pills of a Frontify library page. Frontify's search
 * (server side, cross-library) is not migrated: the box filters the tiles of this page by title,
 * locally. Rows: "Search | <placeholder>", then one row per filter: "<Name> | <option>, <option>".
 * Filters computed from the tiles: Type (Image, Video) and Orientation (Landscape, Portrait,
 * Square). The Library blocks of the page listen to the filter event.
 */
import { readLibraryRows, LIBRARY_ICONS, LIBRARY_FILTER_EVENT } from '../../scripts/library.js';

// filter name -> tile property (library.js parseItem)
const FILTER_KEYS = { type: 'type', orientation: 'orientation' };

export default function decorate(block) {
  const { settings, items } = readLibraryRows(block, ['search']);
  const placeholder = settings.search?.textContent.trim() || 'Search';
  const filters = items.filter((cells) => cells.length >= 2).map((cells) => ({
    title: cells[0].textContent.trim(),
    options: cells[1].textContent.split(',').map((o) => o.trim()).filter(Boolean),
  })).filter((f) => FILTER_KEYS[f.title.toLowerCase()]);
  block.textContent = '';

  const state = { query: '', filters: {} };
  const send = () => document.dispatchEvent(new CustomEvent(LIBRARY_FILTER_EVENT, {
    detail: { query: state.query, filters: state.filters },
  }));

  const bar = document.createElement('div');
  bar.className = 'library-search-bar';
  bar.setAttribute('role', 'search');
  bar.innerHTML = `${LIBRARY_ICONS.search}<input type="search" autocomplete="off">`;
  const input = bar.querySelector('input');
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder);
  input.addEventListener('input', () => { state.query = input.value.trim(); send(); });

  const pills = document.createElement('div');
  pills.className = 'library-search-filters';
  const closeAll = (except) => pills.querySelectorAll('.library-filter').forEach((f) => {
    if (f === except) return;
    f.querySelector('.library-filter-panel').hidden = true;
    f.querySelector('.library-filter-button').setAttribute('aria-expanded', 'false');
  });
  filters.forEach((f, fi) => {
    const key = FILTER_KEYS[f.title.toLowerCase()];
    state.filters[key] = new Set();
    const wrap = document.createElement('div');
    wrap.className = 'library-filter';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'library-filter-button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', `library-filter-${fi}`);
    btn.innerHTML = `<span class="library-filter-label"></span>${LIBRARY_ICONS.caret}`;
    const label = btn.querySelector('.library-filter-label');
    label.textContent = f.title;
    const panel = document.createElement('div');
    panel.className = 'library-filter-panel';
    panel.id = `library-filter-${fi}`;
    panel.hidden = true;
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.className = 'library-sr-only';
    legend.textContent = f.title;
    group.append(legend);
    f.options.forEach((opt) => {
      const value = opt.toLowerCase();
      const row = document.createElement('label');
      row.className = 'library-filter-option';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = value;
      cb.addEventListener('change', () => {
        if (cb.checked) state.filters[key].add(value);
        else state.filters[key].delete(value);
        const n = state.filters[key].size;
        label.textContent = n ? `${f.title} (${n})` : f.title;
        wrap.classList.toggle('active', n > 0);
        send();
      });
      row.append(cb, document.createTextNode(opt));
      group.append(row);
    });
    panel.append(group);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = panel.hidden;
      closeAll(wrap);
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeAll(); btn.focus(); }
    });
    wrap.append(btn, panel);
    pills.append(wrap);
  });
  document.addEventListener('click', (e) => { if (!pills.contains(e.target)) closeAll(); });

  block.append(bar, pills);
}
