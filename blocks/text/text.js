/*
 * Text (Frontify "Text" block) - multi-column rich text, a text block that directly follows
 * another one, or one grid cell of a document cover page ("cell" variant).
 * Variant classes: columns-2..5, gutter-auto|s|m|l|custom, cell.
 * Rows: rich text (one or more cells), optional "Gutter | 20px", optional "Styles | n: css; css"
 * (the Frontify text style of the n-th top-level element: "class: heading1; text-align: right";
 * "li-class: custom2" styles the items of a list).
 */

import { decorateInlineButtons } from '../../scripts/scripts.js';

const GUTTERS = {
  auto: 'normal', s: '10px', m: '30px', l: '50px',
};
const TOP = 'h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote';

function toLength(value) {
  const v = (value || '').trim().toLowerCase();
  if (/^-?\d+(\.\d+)?$/.test(v)) return `${v}px`;
  return /^-?\d+(\.\d+)?(px|rem|em|%)$/.test(v) ? v : '';
}

/** Re-apply Frontify text styles ("n: css; css") to the n-th top-level element. */
function applyStyles(content, spec) {
  const els = [...content.querySelectorAll(TOP)].filter((el) => !el.parentElement.closest(TOP));
  // entries are "<n>: css; css"; line breaks may be lost in conversion, so split before "<n>:"
  spec.split(/\s*\n\s*|\s+(?=\d+\s*:\s)/).forEach((line) => {
    const m = /^\s*(\d+)\s*:\s*(.+)$/.exec(line);
    const el = m && els[Number(m[1]) - 1];
    if (!el) return;
    m[2].split(';').map((d) => d.trim()).filter(Boolean).forEach((decl) => {
      const [prop, ...rest] = decl.split(':');
      const value = rest.join(':').trim();
      if (prop.trim() === 'class') el.classList.add(value);
      else if (prop.trim() === 'id') el.id = value; // heading anchor (Frontify heading slug)
      else if (prop.trim() === 'button-class') el.querySelectorAll('a').forEach((a) => a.classList.add(value));
      else if (prop.trim() === 'li-class') el.querySelectorAll(':scope > li').forEach((li) => li.classList.add(value));
      else el.style.setProperty(prop.trim(), value);
    });
  });
}

/** Frontify checkbox list items ("checkbox-item" style): a disabled checkbox before the text. */
function decorateCheckboxes(content) {
  content.querySelectorAll('.checkbox-item').forEach((item) => {
    const box = document.createElement('span');
    box.className = 'checkbox-box';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.tabIndex = -1;
    input.setAttribute('aria-disabled', 'true');
    input.addEventListener('click', (e) => e.preventDefault());
    box.append(input);
    const label = document.createElement('span');
    label.className = 'checkbox-label';
    label.append(...item.childNodes);
    item.append(box, label);
  });
}

export default function decorate(block) {
  const content = document.createElement('div');
  content.className = 'text-content';
  let gutter = '';
  let styles = '';

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const label = cells.length === 2 ? cells[0].textContent.trim().toLowerCase() : '';
    if (label === 'gutter') {
      gutter = toLength(cells[1].textContent);
      return;
    }
    if (label === 'styles') {
      styles = cells[1].innerText ?? cells[1].textContent;
      return;
    }
    cells.forEach((cell) => content.append(...cell.childNodes));
  });

  if (styles) applyStyles(content, styles);
  decorateCheckboxes(content);
  // no-break spaces travel as word joiners (U+2060) through the content pipeline
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (t.nodeValue.includes('\u2060')) t.nodeValue = t.nodeValue.replace(/\u2060/g, '\u00A0');
  }
  decorateInlineButtons(content);
  const preset = [...block.classList].find((c) => c.startsWith('gutter-'))?.slice(7);
  if (gutter) content.style.columnGap = gutter;
  else if (GUTTERS[preset]) content.style.columnGap = GUTTERS[preset];

  block.replaceChildren(content);
}
