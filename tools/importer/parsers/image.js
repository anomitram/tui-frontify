import {
  slateToHtml, slateIsEmpty, frag, block, variants, img, rgbaToCss,
} from '../utils/frontify.js';

/* Frontify "Image" block: one image plus optional title (name) and caption (description). */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const a = (b.assets?.image || [])[0];
  if (!a) { ctx.notes.push(`Image block ${b.id} has no image asset`); return []; }
  const pic = img(ctx, `asset-${a.id}`, s.altText || a.alternative_text || '', { width: a.width, height: a.height });
  const v = variants(
    s.alignment && s.alignment !== 'Center' && `align-${s.alignment}`,
    s.positioning && s.positioning !== 'Below' && `caption-${s.positioning}`,
    s.hasCustomRatio && `ratio-${s.ratioChoice}`,
    s.autosizing && s.autosizing !== 'none' && `autosize-${s.autosizing}`,
    !s.hasCustomPadding && s.paddingChoice && s.paddingChoice !== 'None' && `padding-${s.paddingChoice}`,
    s.hasBackground && 'background',
    s.hasBorder && 'border',
    s.hasRadius_cornerRadius && `radius-${s.radiusChoice_cornerRadius}`,
    s.downloadable && 'downloadable',
  );
  const rows = [[pic || '']];
  if (!slateIsEmpty(s.name)) rows.push(['Title', frag(ctx, slateToHtml(s.name, ctx, { keepEmpty: false }))]);
  if (!slateIsEmpty(s.description)) rows.push(['Caption', frag(ctx, slateToHtml(s.description, ctx, { keepEmpty: false }))]);
  if (s.hasLink && s.linkObject?.link?.link) rows.push(['Link', s.linkObject.link.link]);
  if (s.hasBackground) rows.push(['Background', rgbaToCss(s.backgroundColor)]);
  if (s.hasBorder) rows.push(['Border', `${s.borderWidth} ${String(s.borderStyle).toLowerCase()} ${rgbaToCss(s.borderColor)}`]);
  if (s.downloadable && ctx.assets[`asset-${a.id}`]) rows.push(['Download', ctx.assets[`asset-${a.id}`]]);
  const atts = (b.assets?.attachments || []).filter((x) => ctx.assets[`asset-${x.id}`]);
  if (atts.length) {
    const cell = ctx.document.createElement('div');
    atts.forEach((x) => {
      const p = ctx.document.createElement('p');
      p.append(ctx.document.createElement('a'));
      p.firstChild.href = ctx.assets[`asset-${x.id}`];
      p.firstChild.textContent = x.file_name;
      cell.append(p);
    });
    rows.push(['Attachments', cell]);
  }
  return [block(ctx, v ? `Image (${v})` : 'Image', rows)];
}
