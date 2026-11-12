/*
 * "library" template: a Frontify asset library document (logo, media, icon or document library),
 * e.g. The Mora Libraries > Logotypes. Sections: Library Search, Library Collections (optional),
 * Library. The page layout (1200px content column, 32px padding) is in styles/library.css; the
 * portal theme (Theme metadata) supplies the header and fonts.
 */
import { loadCSS, getMetadata, toClassName } from './aem.js';

/* Frontify UI icons (Fondue), copied from the library page markup */
const path = (d) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="${d}"/></svg>`;
export const LIBRARY_ICONS = {
  sort: path('M7.227 8.712a.75.75 0 001.06 1.06L12 6.06l3.712 3.713a.75.75 0 101.06-1.061L12.53 4.469 12 3.94l-.53.53zm9.546 6.568a.75.75 0 00-1.06-1.06L12 17.932 8.288 14.22a.75.75 0 10-1.06 1.06l4.242 4.243.53.53.53-.53z'),
  caret: path('M19.78 7.69a.75.75 0 010 1.06L12.53 16l-.53.53-.53-.53-7.25-7.25a.75.75 0 011.06-1.06L12 14.41l6.72-6.72a.75.75 0 011.06 0'),
  search: path('M18.5 11a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0m-1.688 6.872a9 9 0 111.06-1.06l2.898 2.898a.75.75 0 11-1.06 1.06z'),
};

/** Event the Library Search block sends to the Library blocks of the page. */
export const LIBRARY_FILTER_EVENT = 'library:filter';

/**
 * Settings rows of the library blocks: "Key | value" rows with a known key. Returns the settings
 * (key -> value cell) and the remaining rows (the items).
 */
export function readLibraryRows(block, keys) {
  const settings = {};
  const items = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = toClassName(cells[0]?.textContent || '');
    const [first, value] = cells;
    if (cells.length === 2 && keys.includes(key) && !first.querySelector('picture, img')) settings[key] = value;
    else items.push(cells);
  });
  return { settings, items };
}

export async function loadLibraryTheme() {
  const theme = toClassName(getMetadata('theme'));
  await Promise.all([
    loadCSS(`${window.hlx.codeBasePath}/styles/library.css`),
    theme ? loadCSS(`${window.hlx.codeBasePath}/styles/theme-${theme}.css`) : null,
  ]);
}
