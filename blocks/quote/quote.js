/*
 * Quote (Frontify "Quote" block).
 * Variant classes: quotation-marks|indentation, left-<mark>, right-<mark> (double-up, double-down,
 * single-up, single-down, none), align-left|center|right, anchor-full-width|anchor-hug-text,
 * size-small|medium|large, accent-line (indentation type).
 * Rows: quote text | optional "Author | name" | optional "Settings | --quote-marks-color;
 * --quote-size; --quote-line".
 * Measured on The Mora (page 9981): 32px marks (large) in the quote colour, 28px gap, quote text
 * in the theme's quote style, author right-aligned below as "- name".
 */

// Frontify's "DoubleUp" mark (viewBox 0 0 1 1), copied from the rendered block
const DOUBLE = 'M0.0273438 0.849994V0.587182C0.0273438 0.462627 0.0568218 0.364229 0.115778 0.291987C0.175564 0.219745 0.262338 0.172414 0.376098 0.149994V0.279531C0.291401 0.306103 0.23452 0.351773 0.205458 0.416542C0.190511 0.450587 0.184283 0.485878 0.186774 0.522414H0.382326V0.849994H0.0273438ZM0.966489 0.279531C0.882622 0.305273 0.826157 0.351773 0.797094 0.419033C0.780487 0.454739 0.773844 0.489199 0.777165 0.522414H0.972717V0.849994H0.617735V0.587182C0.617735 0.460967 0.648043 0.362153 0.70866 0.290741C0.770107 0.21933 0.85605 0.172414 0.966489 0.149994V0.279531Z';
const SINGLE = DOUBLE.slice(0, DOUBLE.indexOf('ZM') + 1);
const MARKS = {
  'double-up': `<path d="${DOUBLE}"/>`,
  'double-down': `<path d="${DOUBLE}" transform="rotate(180 0.5 0.5)"/>`,
  'single-up': `<path d="${SINGLE}" transform="translate(0.2955 0)"/>`,
  'single-down': `<path d="${SINGLE}" transform="rotate(180 0.5 0.5) translate(0.2955 0)"/>`,
};

function mark(block, side) {
  const prefix = `${side}-`;
  const choice = [...block.classList].find((c) => c.startsWith(prefix))?.slice(prefix.length);
  if (!choice || choice === 'none' || !MARKS[choice]) return null;
  const span = document.createElement('span');
  span.className = `quote-mark quote-mark-${side}`;
  span.innerHTML = `<svg viewBox="0 0 1 1" aria-hidden="true" focusable="false" fill="currentColor">${MARKS[choice]}</svg>`;
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
  const text = document.createElement('blockquote');
  text.className = 'quote-text';
  let author = '';

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const label = cells.length === 2 ? cells[0].textContent.trim().toLowerCase() : '';
    if (label === 'author') {
      author = cells[1].textContent.trim();
      return;
    }
    if (label === 'settings') {
      setVars(block, cells[1].textContent);
      return;
    }
    cells.forEach((cell) => {
      [...cell.childNodes].forEach((n) => {
        // a quote paragraph may come wrapped in its own blockquote: keep only the paragraphs
        if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'BLOCKQUOTE') text.append(...n.childNodes);
        else if (n.nodeType === Node.ELEMENT_NODE || n.textContent.trim()) text.append(n);
      });
    });
  });
  // loose text becomes a paragraph
  [...text.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).forEach((n) => {
    if (!n.textContent.trim()) { n.remove(); return; }
    const p = document.createElement('p');
    n.replaceWith(p);
    p.append(n);
  });

  const figure = document.createElement('figure');
  figure.className = 'quote-figure';
  figure.append(text);
  if (author) {
    const cap = document.createElement('figcaption');
    cap.className = 'quote-author';
    cap.textContent = `- ${author}`;
    figure.append(cap);
  }

  const inner = document.createElement('div');
  inner.className = 'quote-inner';
  const marks = block.classList.contains('quotation-marks');
  const left = marks ? mark(block, 'left') : null;
  const right = marks ? mark(block, 'right') : null;
  inner.append(...[left, figure, right].filter(Boolean));
  block.replaceChildren(inner);
}
