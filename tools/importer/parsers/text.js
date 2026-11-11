import {
  slateToHtml, frag, block, variants,
} from '../utils/frontify.js';

/* Frontify "Text" block. Default content, except multi-column text, or a Text
 * block directly following another one (kept as a block so the inter-block gap survives). */
export default function parse(b, ctx, { prevType } = {}) {
  const s = b.settings || {};
  const html = slateToHtml(s.content || '', ctx);
  const cols = Number(s.columnNumber || 1);
  if (!html.trim()) return [];
  if (cols > 1 || prevType === 'Text') {
    const v = variants(cols > 1 && `columns-${cols}`, s.isColumnGutterCustom && 'gutter-custom', cols > 1 && s.columnGutterSimple && `gutter-${s.columnGutterSimple}`);
    const rows = [[frag(ctx, html)]];
    if (s.isColumnGutterCustom && s.columnGutterCustom) rows.push(['Gutter', s.columnGutterCustom]);
    return [block(ctx, v ? `Text (${v})` : 'Text', rows)];
  }
  return [...frag(ctx, html).childNodes];
}
