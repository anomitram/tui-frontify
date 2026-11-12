import { block, variants, img } from '../utils/frontify.js';

/* Documents imported and verified before download / viewer / caption alignment were kept. */
const LEGACY_DOCS = [396];

/* Alignment of the caption's top-level elements (Quill classes ql-align-*, which html2md drops):
 * "n: text-align: center" lines; '' when there are none. */
function captionStyles(html, ctx) {
  const tpl = ctx.document.createElement('div');
  tpl.innerHTML = html || '';
  return [...tpl.children].map((el, i) => {
    const m = /\bql-align-(left|center|right|justify)\b/.exec(el.getAttribute('class') || '');
    return m ? `${i + 1}: text-align: ${m[1]}` : '';
  }).filter(Boolean).join('\n');
}

/* Frontify "Image grid" block. One row per image: picture | title | caption
 * [| background colour [| caption styles]]. Variants: columns-<n>, border; document theme pages
 * also download (download button per image) and no-viewer (asset viewer off). */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const legacy = LEGACY_DOCS.includes(Number(ctx.docId));
  const v = variants(
    `columns-${s.columns || 2}`,
    s.border && 'border',
    !legacy && s.downloadable && 'download',
    !legacy && s.asset_viewer_enabled === false && 'no-viewer',
  );
  const rows = (s.assets || []).map((it) => {
    const ad = it.asset_data || {};
    const pic = img(ctx, `asset-${ad.id || it.asset}`, it.alt || it.title || '', { width: ad.width, height: ad.height });
    const row = [pic || '', it.title || '', it.caption || ''];
    const bg = it.background && it.background !== 'transparent' ? it.background : '';
    const styles = legacy ? '' : captionStyles(it.caption, ctx);
    if (bg || styles) row.push(bg);
    if (styles) row.push(styles);
    return row;
  });
  return [block(ctx, `Image Grid (${v})`, rows)];
}
