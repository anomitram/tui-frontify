import {
  block, variants, img, cleanHtml, frag,
} from '../utils/frontify.js';

/* Frontify "Annotations" block: image with numbered bubbles at % positions + notes. */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const ad = s.asset_data || {};
  const pic = img(ctx, `asset-${ad.id || s.asset}`, s.caption || ad.filename || '', { width: ad.width, height: ad.height });
  const v = variants(s.mode && `mode-${s.mode}`, s.border && 'border', s.bubble_light && 'bubble-light', s.responsive === false && 'fixed');
  const rows = [[pic || '']];
  (s.annotations || []).forEach((an) => {
    const pos = (an.bubbles || []).map((p) => `${Number(p.left).toFixed(4)}% ${Number(p.top).toFixed(4)}%`).join('; ');
    rows.push([pos, frag(ctx, cleanHtml(an.content, ctx))]);
  });
  if (s.bubble) rows.push(['Bubble', s.bubble]);
  if (s.background_color && s.background_color !== 'transparent') rows.push(['Background', s.background_color]);
  if (s.caption) rows.push(['Caption', s.caption]);
  return [block(ctx, v ? `Annotations (${v})` : 'Annotations', rows)];
}
