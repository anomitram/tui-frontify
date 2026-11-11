import {
  slateToHtml, slateIsEmpty, frag, block, variants, link,
} from '../utils/frontify.js';

/* Frontify "Video" block (legacy block_type "video").
 * Library convention: 1 column; the single content row holds the video link
 * (optional poster image). Settings travel as variants; an optional title is
 * kept as text in the same cell. Aspect ratio is read from the file at runtime. */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const ad = s.asset_data || {};
  const key = `asset-${ad.id || s.asset}`;
  const href = ctx.assets[key];
  if (!href) { ctx.missing.push(key); ctx.notes.push(`Video block ${b.id}: file missing`); return []; }
  const width = s.isCustomWidth ? s.widthCustom : s.widthSimple;
  const v = variants(s.autoplay && 'autoplay', s.loop && 'loop', width && width !== 'auto' && `width-${width}`);
  const cell = ctx.document.createElement('div');
  const p = ctx.document.createElement('p');
  p.append(link(ctx, href, href));
  cell.append(p);
  if (!slateIsEmpty(s.title)) cell.append(...frag(ctx, slateToHtml(s.title, ctx, { keepEmpty: false })).childNodes);
  return [block(ctx, v ? `Video (${v})` : 'Video', [[cell]])];
}
