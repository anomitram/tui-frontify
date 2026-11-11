import {
  slateToHtml, slateIsEmpty, frag, block, variants, img, link, rgbaToCss,
} from '../utils/frontify.js';

/* Frontify "Asset Kit" block: title, description, asset thumbnails, count, and a
 * "Download package" link to a pre-built zip of all assets in the kit. */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const v = variants(
    s.showThumbnails && 'thumbnails',
    s.showCount && 'count',
    s.hasBorder_blocks && 'border',
    s.hasBackgroundBlocks && 'background',
    s.hasBorder_thumbnails && 'thumbnail-border',
    s.hasBackgroundThumbnails && 'thumbnail-background',
    s.hasRadius_blocks && `radius-${s.radiusChoice_blocks}`,
  );
  const rows = [];
  if (!slateIsEmpty(s.title)) rows.push(['Title', frag(ctx, slateToHtml(s.title, ctx, { keepEmpty: false }))]);
  if (!slateIsEmpty(s.description)) rows.push(['Description', frag(ctx, slateToHtml(s.description, ctx, { keepEmpty: false }))]);
  const pkg = ctx.assets[`assetkit-${b.id}`];
  if (pkg) rows.push(['Package', link(ctx, pkg, 'Download package')]);
  else ctx.notes.push(`Asset Kit ${b.id}: no package zip`);
  if (s.hasBorder_blocks) rows.push(['Border', `${s.borderWidth_blocks} ${String(s.borderStyle_blocks).toLowerCase()} ${rgbaToCss(s.borderColor_blocks)}`]);
  if (s.hasBackgroundThumbnails) rows.push(['Thumbnail background', rgbaToCss(s.backgroundColorThumbnails)]);
  (b.assets?.images || []).forEach((a) => {
    const key = `asset-${a.id}`;
    const file = ctx.assets[key];
    if (!file) ctx.missing.push(key);
    const isImage = a.object_type === 'IMAGE' && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(String(a.ext).toLowerCase());
    const icon = ctx.assets[`icon-file-${String(a.ext).toLowerCase()}.svg`];
    let thumb = '';
    if (isImage || ctx.assets[`preview-${a.id}`]) thumb = img(ctx, key, a.title || a.file_name);
    else if (icon) {
      thumb = ctx.document.createElement('img');
      thumb.src = icon;
      thumb.alt = `${a.ext} file`;
    }
    rows.push([thumb || '', file ? link(ctx, file, a.file_name) : a.file_name, a.title || '', String(a.ext || '')]);
  });
  return [block(ctx, v ? `Asset Kit (${v})` : 'Asset Kit', rows)];
}
