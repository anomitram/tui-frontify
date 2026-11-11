/*
 * Attachments (Frontify legacy "Attachments" / downloads block).
 * One row per file: link (href = file, text = title) | size (e.g. "6 KB") | extension.
 */

const STROKE = 'fill="none" stroke="#c4c6cd" stroke-width="1"';

// new-style Frontify file icon: outlined sheet with folded corner
const SHEET = `<path d="M2 .5h29.5l8 8V50a1.5 1.5 0 0 1-1.5 1.5H2A1.5 1.5 0 0 1 .5 50V2A1.5 1.5 0 0 1 2 .5Z" fill="#fff" ${STROKE}/>`
  + `<path d="M31 .5V9h8.5" ${STROKE}/>`;

const ICONS = {
  // legacy sprite style (shadowed sheet with text lines), as shown for Word files
  docx: '<path d="M.5 48.5V4A2.5 2.5 0 0 1 3 1.5h24.5l12 12v35Q39.5 50.5 37 50.5H3Q.5 50.5.5 48.5Z" fill="#fff"/>'
    + '<path d="M.5 48V4A2.5 2.5 0 0 1 3 1.5h24.5l12 12V48" fill="none" stroke="#797976"/>'
    + '<path d="M.5 48q0 2.5 2.5 2.5h34q2.5 0 2.5-2.5" fill="none" stroke="#c5c5c3"/>'
    + '<path d="M3 51.5h34" stroke="#b2b2b2" stroke-opacity=".7"/>'
    + '<path d="M28.5 2.5v10h10Z" fill="#efefef" stroke="#8c8c8c" stroke-linejoin="round"/>'
    + '<path d="M27.5 13h12v8Q34 15 27.5 13Z" fill="#000" fill-opacity=".05"/>'
    + '<path d="M7 12.3h16.5M7 19.25h26M7 26.2h26" stroke="#666" stroke-width="1.75"/>',
  pptx: `${SHEET}<rect x="10.5" y="19.5" width="19" height="17" rx="1.5" fill="#fff" ${STROKE}/>`
    + '<path d="M11 20h18v3H11Z" fill="#f1f2f4"/>'
    + `<path d="M10.5 23.5h19" ${STROKE}/>`
    + '<path d="M17.6 26v7l5.2-3.5Z" fill="none" stroke="#c4c6cd" stroke-width="1.2" stroke-linejoin="round"/>',
  pdf: `${SHEET}<path d="M10 20.5h20M10 25.5h20M10 30.5h20M10 35.5h12" ${STROKE}/>`,
  zip: `${SHEET}<path d="M18 .5v3h3v3h-3v3h3v3h-3v3h3v3h-3" ${STROKE}/>`
    + `<rect x="16.5" y="21.5" width="7" height="9" rx="1" ${STROKE}/>`,
};
ICONS.doc = ICONS.docx;
ICONS.ppt = ICONS.pptx;
ICONS.key = ICONS.pptx;

function fileIcon(ext) {
  const span = document.createElement('span');
  span.className = 'attachments-icon';
  span.setAttribute('aria-hidden', 'true');
  const shapes = ICONS[ext];
  // Frontify has no icon for unknown types (e.g. .ase) and leaves the slot empty
  if (shapes) {
    span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">${shapes}</svg>`;
  }
  return span;
}

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
};

/** Frontify stores attachment titles HTML-escaped (e.g. "D&#039;accord"); show them decoded. */
function decodeEntities(value) {
  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] !== '#') return NAMED[code.toLowerCase()] ?? match;
    const num = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return num > 0 && num <= 0x10ffff ? String.fromCodePoint(num) : match;
  });
}

function extensionOf(value) {
  return (value || '').trim().replace(/^\./, '').toLowerCase();
}

export default function decorate(block) {
  const list = document.createElement('ul');
  list.className = 'attachments-list';

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const link = row.querySelector('a[href]');
    const titleText = decodeEntities((link || cells[0])?.textContent.trim() || '');
    if (!titleText) return;

    const size = cells.length > 1 ? cells[1].textContent.trim() : '';
    let ext = cells.length > 2 ? extensionOf(cells[2].textContent) : '';
    if (!ext && link) {
      const path = decodeURIComponent(new URL(link.href, window.location.href).pathname);
      ext = path.includes('.') ? extensionOf(path.split('.').pop()) : '';
    }

    const li = document.createElement('li');
    li.className = 'attachments-item';
    const target = document.createElement(link ? 'a' : 'div');
    target.className = 'attachments-link';
    if (link) {
      target.href = link.getAttribute('href');
      // Prefer the authored link text (original file name); published URLs use URL-safe names.
      const linkText = (link.textContent || '').trim();
      const fileName = /\.[a-z0-9]{2,5}$/i.test(linkText) ? linkText : decodeURIComponent(target.pathname.split('/').pop() || '');
      target.setAttribute('download', fileName || titleText);
    }

    const meta = document.createElement('span');
    meta.className = 'attachments-meta';
    const title = document.createElement('span');
    title.className = 'attachments-title';
    title.textContent = titleText;
    meta.append(title);
    const info = [size, ext].filter(Boolean).join(' - ');
    if (info) {
      const infoEl = document.createElement('span');
      infoEl.className = 'attachments-info';
      infoEl.textContent = info;
      meta.append(infoEl);
    }

    target.append(fileIcon(ext), meta);
    li.append(target);
    list.append(li);
  });

  if (list.children.length % 2) list.lastElementChild.classList.add('attachments-item-full');
  block.replaceChildren(list);
}
