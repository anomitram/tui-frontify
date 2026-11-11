/* Helpers for importing Frontify hub (portal home) grid cells. */

const BLOCK_SEL = 'h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote';

/** Map a Frontify link to the migrated structure via the payload's link map. */
export function resolveLink(url, ctx) {
  if (!url) return url;
  const rec = ctx.linkMap[url];
  if (rec?.migrated) return rec.migrated;
  if (rec?.target) return rec.target; // out of scope: link to the resolved original target
  return url.startsWith('/') ? ctx.host + url : url;
}

/**
 * Convert cell HTML (Frontify/Quill) to clean authorable HTML plus per-element style overrides.
 * Inline font-size / colour / alignment and custom text styles cannot survive markdown, so they
 * are returned as "n: css" lines for a Styles row; the hub-cell block re-applies them.
 */
export function convertCellHtml(html, ctx) {
  const d = ctx.document.createElement('div');
  d.innerHTML = (html || '').replace(/\uFEFF/g, '');
  d.querySelectorAll('span[contenteditable]').forEach((s) => s.replaceWith(...s.childNodes));
  d.querySelectorAll('br.softbreak').forEach((br) => br.removeAttribute('class'));
  // buttons: primary -> <strong><a>, secondary -> <em><a>, tertiary -> <em><strong><a>
  d.querySelectorAll('a').forEach((a) => {
    const href = resolveLink(a.getAttribute('href'), ctx);
    const cls = a.className || '';
    const clean = ctx.document.createElement('a');
    clean.href = href;
    // trim ordinary whitespace only: a trailing no-break space is part of the source button width
    // (markdown trims it, so a zero-width space after it keeps it)
    clean.textContent = a.textContent.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '').replace(/\u00a0$/, '\u00a0\u200b');
    if (a.getAttribute('target') === '_blank') clean.setAttribute('target', '_blank');
    let el = clean;
    if (/btn-primary/.test(cls)) { el = ctx.document.createElement('strong'); el.append(clean); }
    if (/btn-secondary/.test(cls)) { el = ctx.document.createElement('em'); el.append(clean); }
    if (/btn-tertiary/.test(cls)) { const s = ctx.document.createElement('strong'); s.append(clean); el = ctx.document.createElement('em'); el.append(s); }
    a.replaceWith(el);
  });
  const styles = [];
  [...d.querySelectorAll(BLOCK_SEL)].filter((el) => !el.parentElement.closest(BLOCK_SEL)).forEach((el, i) => {
    const css = [];
    const custom = (/(custom\d)/.exec(el.className || '') || [])[1];
    if (custom) css.push(`class: ${custom}`);
    const align = (/ql-align-(\w+)/.exec(el.className || '') || [])[1];
    if (align) css.push(`text-align: ${align}`);
    const fs = el.style?.fontSize;
    if (fs) css.push(`font-size: ${fs}`);
    if (el.style?.color) css.push(`color: ${el.style.color}`);
    // Frontify's editor keeps runs of spaces (white-space: pre-wrap), e.g. the gaps between buttons
    // sharing a paragraph. Rendering collapses them to one space, so the lengths of whitespace-only
    // runs between elements travel as "spaces: n,n" and the hub-cell block restores them.
    const runs = [...el.childNodes].filter((n) => n.nodeType === 3 && n.previousSibling && n.nextSibling
      && /^[\s\u00a0]+$/.test(n.nodeValue)).map((n) => n.nodeValue.length);
    if (runs.some((n) => n > 1)) css.push('white-space: pre-wrap', `spaces: ${runs.join(',')}`);
    const spans = [...el.querySelectorAll('span[style]')];
    const colors = [...new Set(spans.map((s) => s.style.color).filter(Boolean))];
    if (colors.length === 1 && !el.style?.color) css.push(`color: ${colors[0]}`);
    spans.forEach((s) => s.replaceWith(...s.childNodes));
    el.removeAttribute('style');
    el.removeAttribute('class');
    // empty heading/paragraph kept as an (invisible) spacer like Frontify renders it
    if (!el.textContent.trim() && !el.querySelector('img,a')) el.innerHTML = '\u200B';
    if (css.length) styles.push(`${i + 1}: ${css.join('; ')}`);
  });
  return { html: d.innerHTML, styles };
}

export function box(p) {
  if (!p) return null;
  const v = (x) => {
    if (x === 0 || x === '0' || x == null) return '0';
    return typeof x === 'number' ? `${x}px` : String(x);
  };
  return [p.top, p.right, p.bottom, p.left].map(v).join(' ');
}

export const len = (x) => {
  if (x == null || x === '') return null;
  return typeof x === 'number' ? `${x}px` : String(x);
};
