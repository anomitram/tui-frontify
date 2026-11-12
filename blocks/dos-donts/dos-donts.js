/*
 * Dos Donts (Frontify "Do & Don't" block): a grid of do/don't items.
 * Variant classes: columns-1..4, mode-text-and-image|mode-text|mode-image, style-underline|
 * style-icons, image-fill|image-fit, strikethrough, do-icon-<choice>, dont-icon-<choice>.
 * Rows:
 *   Settings | --dd-col-gap; --dd-row-gap; --dd-do-color; --dd-dont-color; --dd-bg; --dd-border;
 *              --dd-radius; --dd-image-height (all optional)
 *   per item: Do|Don't | picture | text (optional heading = item title, then body)
 * Item (measured on The Mora): image (12px radius, 12px below), coloured title row, 3px line in the
 * do/don't colour (12px above and below), body text.
 */

const ICONS = {
  checkmark: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  'checkmark-circle': '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  'cross-circle': '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
};

const BLOCKS = 'P,H1,H2,H3,H4,H5,H6,UL,OL,BLOCKQUOTE,DIV,PICTURE,TABLE,FIGURE'.split(',');

/** Wrap runs of loose inline content (a one-paragraph cell loses its <p>) in paragraphs. */
function wrapInline(container) {
  let p = null;
  [...container.childNodes].forEach((n) => {
    const block = n.nodeType === Node.ELEMENT_NODE && BLOCKS.includes(n.tagName);
    const blank = n.nodeType === Node.TEXT_NODE && !n.textContent.trim();
    if (block || (blank && !p)) { p = null; return; }
    if (!p) { p = document.createElement('p'); n.before(p); }
    p.append(n);
  });
}

function icon(block, kind) {
  const prefix = `${kind}-icon-`;
  const choice = [...block.classList].find((c) => c.startsWith(prefix))?.slice(prefix.length)
    || (kind === 'do' ? 'checkmark-circle' : 'cross-circle');
  const svg = ICONS[choice] || ICONS[kind === 'do' ? 'checkmark-circle' : 'cross-circle'];
  const span = document.createElement('span');
  span.className = 'dos-donts-icon';
  span.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${svg}</svg>`;
  return span;
}

/** Settings cell "--a: 1; --b: 2" -> custom properties on the block. */
function setVars(block, text) {
  text.split(';').map((d) => d.trim()).filter((d) => d.startsWith('--')).forEach((d) => {
    const i = d.indexOf(':');
    const value = d.slice(i + 1).trim();
    if (i > 0 && value) block.style.setProperty(d.slice(0, i).trim(), value);
  });
}

export default function decorate(block) {
  const grid = document.createElement('div');
  grid.className = 'dos-donts-grid';
  const icons = block.classList.contains('style-icons');
  const underline = !icons || block.classList.contains('style-underline');

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const label = cells[0]?.textContent.trim().toLowerCase().replace(/[’']/g, '');
    if (label === 'settings' && cells.length === 2) {
      setVars(block, cells[1].textContent);
      return;
    }
    if (!cells.length) return;
    const kind = label === 'do' ? 'do' : 'dont';
    const picCell = cells.find((c, i) => i > 0 && c.querySelector('picture, img'));
    const textCell = cells.slice(1).reverse().find((c) => c !== picCell);

    const item = document.createElement('div');
    item.className = `dos-donts-item is-${kind}`;

    if (picCell) {
      const media = document.createElement('div');
      media.className = 'dos-donts-image';
      media.append(picCell.querySelector('picture') || picCell.querySelector('img'));
      item.append(media);
    }

    const heading = document.createElement('div');
    heading.className = 'dos-donts-heading';
    if (icons) heading.append(icon(block, kind));
    const title = document.createElement('span');
    title.className = 'dos-donts-title';
    const sr = document.createElement('span');
    sr.className = 'dos-donts-label';
    sr.textContent = kind === 'do' ? 'Do: ' : 'Don’t: ';
    title.append(sr);
    const first = textCell?.firstElementChild;
    if (first && /^H[1-6]$/.test(first.tagName)) {
      title.append(...first.childNodes);
      first.remove();
    }
    heading.append(title);
    item.append(heading);

    if (underline) {
      const line = document.createElement('div');
      line.className = 'dos-donts-line';
      line.setAttribute('aria-hidden', 'true');
      item.append(line);
    }

    const text = document.createElement('div');
    text.className = 'dos-donts-text';
    if (textCell) text.append(...textCell.childNodes);
    wrapInline(text);
    item.append(text);
    grid.append(item);
  });

  block.replaceChildren(grid);
}
