import {
  block, variants, img, cleanHtml, frag,
} from '../utils/frontify.js';

/* Frontify text style classes of a note's top-level elements ("n: class: custom3"), which
 * cleanHtml removes; '' when there are none. */
function noteStyles(html, ctx) {
  const tpl = ctx.document.createElement('div');
  tpl.innerHTML = html || '';
  return [...tpl.children].map((el, i) => {
    const cls = (el.getAttribute('class') || '').split(/\s+/).find((c) => /^custom\d$/.test(c));
    return cls ? `${i + 1}: class: ${cls}` : '';
  }).filter(Boolean).join('\n');
}

/* Documents whose pages were imported and verified before empty note paragraphs were kept. */
const LEGACY_DOCS = [396];

/* An empty paragraph (Frontify: <p><br></p>) is one line tall; a zero-width space keeps it
 * through html2md. */
const keepEmpty = (html) => html.replace(/<p>(\s|<br[^>]*>)*<\/p>/g, '<p>​</p>');

/* Frontify "Annotations" block: image with numbered bubbles at % positions + notes.
 * Rows: picture; per note: positions | rich text [| styles]; Bubble, Background, Caption. */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const ad = s.asset_data || {};
  const pic = img(ctx, `asset-${ad.id || s.asset}`, s.caption || ad.filename || '', { width: ad.width, height: ad.height });
  const v = variants(s.mode && `mode-${s.mode}`, s.border && 'border', s.bubble_light && 'bubble-light', s.responsive === false && 'fixed');
  const rows = [[pic || '']];
  (s.annotations || []).forEach((an) => {
    const pos = (an.bubbles || []).map((p) => `${Number(p.left).toFixed(4)}% ${Number(p.top).toFixed(4)}%`).join('; ');
    const styles = noteStyles(an.content, ctx);
    let html = cleanHtml(an.content, ctx);
    if (!LEGACY_DOCS.includes(Number(ctx.docId))) html = keepEmpty(html);
    rows.push(styles ? [pos, frag(ctx, html), styles] : [pos, frag(ctx, html)]);
  });
  if (s.bubble) rows.push(['Bubble', s.bubble]);
  if (s.background_color && s.background_color !== 'transparent') rows.push(['Background', s.background_color]);
  if (s.caption) rows.push(['Caption', s.caption]);
  return [block(ctx, v ? `Annotations (${v})` : 'Annotations', rows)];
}
