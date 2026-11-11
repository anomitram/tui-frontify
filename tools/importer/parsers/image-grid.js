import { block, variants, img } from '../utils/frontify.js';

/* Frontify "Image grid" block. One row per image: picture | title | caption. */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const v = variants(`columns-${s.columns || 2}`, s.border && 'border');
  const rows = (s.assets || []).map((it) => {
    const ad = it.asset_data || {};
    const pic = img(ctx, `asset-${ad.id || it.asset}`, it.alt || it.title || '', { width: ad.width, height: ad.height });
    const row = [pic || '', it.title || '', it.caption || ''];
    if (it.background && it.background !== 'transparent') row.push(it.background);
    return row;
  });
  return [block(ctx, `Image Grid (${v})`, rows)];
}
