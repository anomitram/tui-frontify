/*
 * Flip Card (Frontify "Flip Card" marketplace block): cards that turn over on hover, keyboard
 * focus or (variant "click") click, with a 3D rotation (variants direction-left|right|up|down).
 * Rows:
 *   Settings | --flip-cols-l: 3; --flip-bp-l: 1180px; --flip-cols-m: 2; --flip-bp-m: 600px;
 *              --flip-cols-s: 1; --flip-gap; --flip-min-height; --flip-border; --flip-radius;
 *              --flip-shadow; --flip-padding; --flip-duration; --flip-timing; --flip-perspective
 *   per card: front | back | style
 *     front/back: optional picture (first paragraph; covers the face like Frontify's face
 *                 background) + rich text
 *     style: CSS variables (--front-bg; --front-color; --front-size: contain|cover;
 *            --front-position; --back-*), then optional "Front: n: class: heading4; text-align: x"
 *            and "Back: ..." paragraphs (Frontify text styles, Text block syntax).
 * Columns follow the viewport width (measured: 3 columns at 1440 although the block is only
 * 971px wide): cols-l from bp-l, cols-m from bp-m, else cols-s.
 */

const TOP = 'h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote';
// Frontify text style of a heading tag when the author gave none
const TAG_STYLE = {
  H1: 'heading1', H2: 'heading2', H3: 'heading3', H4: 'heading4', H5: 'custom1', H6: 'custom2', BLOCKQUOTE: 'quote',
};

/** "--a: 1; --b: 2" -> [["--a", "1"], ["--b", "2"]] (custom properties only). */
function parseVars(text) {
  return (text || '').split(';')
    .map((d) => d.trim())
    .filter((d) => d.startsWith('--'))
    .map((d) => {
      const i = d.indexOf(':');
      return i > 0 ? [d.slice(0, i).trim(), d.slice(i + 1).trim()] : [d, ''];
    })
    .filter(([, v]) => v);
}

/** Re-apply Frontify text styles ("n: class: x; text-align: y") to the n-th top-level element. */
function applyStyles(content, spec) {
  const els = [...content.children].filter((el) => el.matches(TOP));
  spec.split(/\s*\n\s*|\s+(?=\d+\s*:\s)/).forEach((line) => {
    const m = /^\s*(\d+)\s*:\s*(.+)$/.exec(line);
    const el = m && els[Number(m[1]) - 1];
    if (!el) return;
    m[2].split(';').map((d) => d.trim()).filter(Boolean).forEach((decl) => {
      const [prop, ...rest] = decl.split(':');
      const value = rest.join(':').trim();
      if (prop.trim() === 'class') el.classList.add(value);
      else if (prop.trim() === 'text-align') el.style.textAlign = value;
    });
  });
  els.forEach((el) => {
    if (TAG_STYLE[el.tagName] && !el.className) el.classList.add(TAG_STYLE[el.tagName]);
  });
}

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

/** One face: picture (first paragraph that only holds a picture) + text. */
function buildFace(cell, side, spec) {
  const face = document.createElement('div');
  face.className = `flip-card-face flip-card-${side}`;
  const content = document.createElement('div');
  content.className = 'flip-card-content';
  content.append(...(cell ? cell.childNodes : []));
  wrapInline(content);
  const first = content.firstElementChild;
  const pic = first?.matches('picture, img') ? first : first?.querySelector('picture, img');
  if (pic && !first.textContent.trim()) {
    const media = document.createElement('div');
    media.className = 'flip-card-media';
    media.append(pic.closest('picture') || pic);
    if (first !== pic) first.remove();
    face.append(media);
  }
  if (spec) applyStyles(content, spec);
  if (content.textContent.trim() || content.querySelector('img')) face.append(content);
  return face;
}

/** Columns per viewport width (Frontify grid_*_breakpoint/columns). */
function watchColumns(block, opts) {
  const queries = [
    [opts['--flip-bp-l'], opts['--flip-cols-l']],
    [opts['--flip-bp-m'], opts['--flip-cols-m']],
  ].filter(([bp, cols]) => bp && cols)
    .map(([bp, cols]) => [window.matchMedia(`(min-width: ${bp})`), cols]);
  const update = () => {
    const hit = queries.find(([mq]) => mq.matches);
    block.style.setProperty('--flip-cols', (hit ? hit[1] : opts['--flip-cols-s']) || 1);
  };
  queries.forEach(([mq]) => mq.addEventListener('change', update));
  update();
}

export default function decorate(block) {
  const click = block.classList.contains('click');
  const opts = {};
  const grid = document.createElement('div');
  grid.className = 'flip-card-grid';

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const label = cells[0]?.textContent.trim().toLowerCase();
    if (cells.length === 2 && label === 'settings') {
      parseVars(cells[1].textContent).forEach(([k, v]) => {
        opts[k] = v;
        block.style.setProperty(k, v);
      });
      return;
    }
    if (!cells.length || (!row.textContent.trim() && !row.querySelector('img'))) return;

    const [frontCell, backCell, styleCell] = cells;
    const card = document.createElement('div');
    card.className = 'flip-card-card';
    // style cell: CSS variables, then "Front: <spec>" / "Back: <spec>" (paragraphs or one text)
    const specs = {};
    const paras = [...(styleCell?.querySelectorAll('p') || [])].map((p) => p.textContent);
    const styleText = paras.join('\n') || styleCell?.textContent || '';
    styleText.split(/\s*(?=\b(?:front|back)\s*:)/i).forEach((part) => {
      const m = /^(front|back)\s*:\s*([\s\S]*)$/i.exec(part.trim());
      if (m) {
        const [, side, spec] = m;
        specs[side.toLowerCase()] = spec;
      } else parseVars(part).forEach(([k, v]) => card.style.setProperty(k, v));
    });

    const inner = document.createElement('div');
    inner.className = 'flip-card-inner';
    const front = buildFace(frontCell, 'front', specs.front);
    const back = buildFace(backCell, 'back', specs.back);
    inner.append(front, back);
    card.append(inner);

    if (click) {
      card.setAttribute('role', 'button');
      card.setAttribute('aria-pressed', 'false');
      card.tabIndex = 0;
      const toggle = () => {
        const on = card.classList.toggle('is-flipped');
        card.setAttribute('aria-pressed', String(on));
      };
      card.addEventListener('click', (e) => { if (!e.target.closest('a')) toggle(); });
      card.addEventListener('keydown', (e) => {
        if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); }
      });
    } else if (!card.querySelector('a, button')) {
      // keyboard users flip the card by focusing it (CSS :focus-within)
      card.tabIndex = 0;
    }
    grid.append(card);
  });

  watchColumns(block, opts);
  block.replaceChildren(grid);
}
