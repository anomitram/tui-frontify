import { box } from '../utils/hub.js';

/* Frontify hub DIVIDER cell -> "Hub Divider" block (line height/colour, padding, background). */
export default function parse(cell, ctx) {
  const s = cell.settings || {};
  const rows = [
    ['Line', `${s.height || 1}px ${s.background || 'rgb(221, 221, 221)'}`],
    ['Padding', box(s.padding) || '25px 0 25px 0'],
  ];
  if (s.containerBackground && !/,\s*0\)$/.test(s.containerBackground)) rows.push(['Background', s.containerBackground]);
  rows.push(['Frontify Cell', `${cell.teaser} (row ${ctx.rowId}, sort ${cell.sort})`]);
  return ctx.WebImporter.Blocks.createBlock(ctx.document, { name: `Hub Divider (w-${cell.width || 12})`, cells: rows });
}
