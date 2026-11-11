import { block, variants, rgbaToCss } from '../utils/frontify.js';

/* Frontify "Divider" block. */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const height = s.isHeightCustom ? s.heightCustom : s.heightSimple;
  const width = s.isWidthCustom ? s.widthCustom : s.widthSimple;
  const v = variants(
    s.isLine === 'NoLine' ? 'no-line' : String(s.style || 'Solid'),
    !s.isHeightCustom && `height-${s.heightSimple || 'Small'}`,
    s.alignment && s.alignment !== 'Left' && `align-${s.alignment}`,
  );
  const rows = [['Line', s.isLine === 'NoLine' ? 'none' : `${s.thickness || '1px'} ${String(s.style || 'solid').toLowerCase()} ${rgbaToCss(s.color)}`]];
  if (s.isHeightCustom) rows.push(['Height', height]);
  if (width && width !== '100%') rows.push(['Width', width]);
  return [block(ctx, `Divider (${v})`, rows)];
}
