import {
  slateToHtml, slateIsEmpty, frag, block, variants, link,
} from '../utils/frontify.js';

/* Frontify "Audio" block: title + audio file (+ optional download). */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const a = (b.assets?.audio || [])[0];
  if (!a) { ctx.notes.push(`Audio block ${b.id} has no file`); return []; }
  const href = ctx.assets[`asset-${a.id}`];
  if (!href) ctx.missing.push(`asset-${a.id}`);
  const v = variants(s.downloadable && 'downloadable', s.positioning && s.positioning !== 'Above' && `title-${s.positioning}`);
  const rows = [];
  if (!slateIsEmpty(s.title)) rows.push(['Title', frag(ctx, slateToHtml(s.title, ctx, { keepEmpty: false }))]);
  rows.push([href ? link(ctx, href, a.file_name) : a.file_name]);
  return [block(ctx, v ? `Audio (${v})` : 'Audio', rows)];
}
