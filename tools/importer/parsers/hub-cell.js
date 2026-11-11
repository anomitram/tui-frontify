import {
  convertCellHtml, resolveLink, box, len,
} from '../utils/hub.js';

/* Frontify hub TEXTIMAGE cell -> "Hub Cell" block.
 * Variants: layout (textover|text|image|leftright|rightleft|topbottom|bottomtop), w-<1..12>,
 * text-<position>, image-<position>, cover, contain.
 * Rows: picture, rich text, then key/value settings (only when set). */
export default function parse(cell, ctx) {
  const s = cell.settings || {};
  const variants = [
    s.layout || 'text', `w-${cell.width || 12}`,
    s.content_position && `text-${s.content_position}`,
    s.image_position && `image-${s.image_position}`,
    s.cover && 'cover', s.cover_mode && s.cover_mode !== 'cover' && `cover-mode-${s.cover_mode}`,
  ].filter(Boolean);
  const rows = [];
  const key = `cell-${cell.sort}-${cell.key}`;
  const src = ctx.assets[key];
  const img = s.image && typeof s.image === 'object' ? s.image : null;
  if (src) {
    const el = ctx.document.createElement('img');
    el.src = src;
    el.alt = s.image_alt || '';
    rows.push([el]);
  } else if (img?.file_id && s.layout !== 'text') {
    ctx.notes.push(`cell ${key}: image ${img.file_id} has no file in the hub data (not rendered by Frontify)`);
  }
  const { html, styles } = convertCellHtml(s.content || '', ctx);
  if (html.trim()) {
    const div = ctx.document.createElement('div');
    div.innerHTML = html;
    rows.push([div]);
  }
  const kv = (k, v) => { if (v != null && v !== '') rows.push([k, String(v)]); };
  kv('Link', s.link?.url ? resolveLink(s.link.url, ctx) : null);
  kv('Image Link', s.image_link?.url ? resolveLink(s.image_link.url, ctx) : null);
  if (s.new_window || s.link?.new_window) kv('New Window', 'true');
  kv('Content Padding', box(s.content_padding));
  const ip = box(s.image_padding);
  if (ip && ip !== '0 0 0 0') kv('Image Padding', ip);
  kv('Content Width', len(s.content_width));
  kv('Image Width', len(s.image_width));
  if (src && img?.ratio_percent) kv('Ratio', `${Number(img.ratio_percent).toFixed(4)}%`);
  kv('Overlay', s.image_overlay);
  kv('Content Background', s.content_background);
  if (s.border && (s.border.width || s.border.radius)) kv('Border', `${s.border.width || 0}px solid ${s.border.color}; radius ${s.border.radius || 0}px`);
  if (styles.length) rows.push(['Styles', styles.join('\n')]);
  kv('Frontify Cell', `${cell.teaser} (row ${ctx.rowId}, sort ${cell.sort})`);
  return ctx.WebImporter.Blocks.createBlock(ctx.document, { name: `Hub Cell (${variants.join(', ')})`, cells: rows });
}
