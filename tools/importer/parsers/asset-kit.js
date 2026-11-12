import {
  slateToHtml, slateIsEmpty, frag, block, variants, img, link, rgbaToCss, isServable, fileTarget,
} from '../utils/frontify.js';

// file types Edge Delivery serves from content (images, svg, pdf, mp4)
const SERVABLE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf', 'mp4'];

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
    // Frontify's radius switch (hasRadius_blocks) selects a custom value; off = the radius choice
    !s.hasRadius_blocks && s.radiusChoice_blocks && `radius-${s.radiusChoice_blocks}`,
  );
  const rows = [];
  if (!slateIsEmpty(s.title)) rows.push(['Title', frag(ctx, slateToHtml(s.title, ctx, { keepEmpty: false }))]);
  if (!slateIsEmpty(s.description)) rows.push(['Description', frag(ctx, slateToHtml(s.description, ctx, { keepEmpty: false }))]);
  // "Download package" = Frontify's zip of the kit. Without a local zip (Edge Delivery content
  // cannot serve zip files), a kit with a single servable file downloads that file; otherwise the
  // block links the button to the Frontify page (page metadata "Original Url").
  const pkg = ctx.assets[`assetkit-${b.id}`];
  const files = b.assets?.images || [];
  const single = files.length === 1 && SERVABLE.includes(String(files[0].ext).toLowerCase())
    ? ctx.assets[`asset-${files[0].id}`] : null;
  // a local zip cannot be served either: the button then opens the Frontify page (ctx.frontifyUrl)
  if (pkg && isServable(pkg)) rows.push(['Package', link(ctx, pkg, 'Download package')]);
  else if (pkg && ctx.frontifyUrl) rows.push(['Package', link(ctx, ctx.frontifyUrl, 'Download package')]);
  else if (single) rows.push(['Package', link(ctx, single, 'Download package')]);
  else ctx.notes.push(`Asset Kit ${b.id}: no package zip; "Download package" links to the Frontify page`);
  if (s.hasRadius_blocks && s.radiusValue_blocks) rows.push(['Radius', s.radiusValue_blocks]);
  const unservable = files.filter((a) => !SERVABLE.includes(String(a.ext).toLowerCase()));
  if (unservable.length) ctx.notes.push(`Asset Kit ${b.id}: files Edge Delivery cannot serve: ${unservable.map((a) => a.file_name || `${a.id}.${a.ext}`).join(', ')}`);
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
    rows.push([thumb || '', file ? link(ctx, fileTarget(ctx, file), a.file_name) : a.file_name, a.title || '', String(a.ext || '')]);
  });
  return [block(ctx, v ? `Asset Kit (${v})` : 'Asset Kit', rows)];
}
