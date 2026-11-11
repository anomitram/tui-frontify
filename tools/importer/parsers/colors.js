import { block, variants } from '../utils/frontify.js';

/* Frontify "Colors" (brand essentials color) block. Colour data comes from the
 * page's captured GraphQL response (getColorBlockColors), keyed by block id. */
const REPS = [
  ['rgba', 'RGBA', (v) => `${v.red}, ${v.green}, ${v.blue}, ${v.alpha ?? 1}`],
  ['hex', 'HEX', (v) => v],
  ['hsl', 'HSL', (v) => (typeof v === 'object' ? `${v.hue}, ${v.saturation}, ${v.lightness}` : v)],
  ['lab', 'LAB', (v) => (typeof v === 'object' ? `${v.l}, ${v.a}, ${v.b}` : v)],
  ['ral', 'RAL', (v) => v],
  ['pantone', 'PMS', (v) => v],
  ['pantoneCoated', 'PMS Coated', (v) => v],
  ['pantoneUncoated', 'PMS Uncoated', (v) => v],
  ['pantoneCp', 'PMS CP', (v) => v],
  ['pantonePlastics', 'PMS Plastics', (v) => v],
  ['pantoneTextile', 'PMS Textile', (v) => v],
  ['cmyk', 'CMYK', (v) => `${v.cyan}, ${v.magenta}, ${v.yellow}, ${v.black}`],
  ['cmykCoated', 'CMYK Coated', (v) => `${v.cyan}, ${v.magenta}, ${v.yellow}, ${v.black}`],
  ['cmykUncoated', 'CMYK Uncoated', (v) => `${v.cyan}, ${v.magenta}, ${v.yellow}, ${v.black}`],
  ['cmykNewspaper', 'CMYK Newspaper', (v) => `${v.cyan}, ${v.magenta}, ${v.yellow}, ${v.black}`],
  ['ncs', 'NCS', (v) => v],
  ['hks', 'HKS', (v) => v],
  ['threeM', '3M', (v) => v],
  ['oracal', 'Oracal', (v) => v],
  ['cssVariable', 'CSS Variable', (v) => v],
];

export default function parse(b, ctx) {
  const s = b.settings || {};
  const colors = ctx.colors[String(b.id)];
  if (!colors) {
    ctx.notes.push(`Colors block ${b.id}: colour values not captured`);
    ctx.missing.push(`colors-${b.id}`);
    return [];
  }
  const enabled = new Set(s.enabledRepresentations || []);
  const present = REPS.filter(([k]) => colors.some((c) => c.representations?.[k]?.value != null));
  const v = variants(
    s.view || 'card',
    s.showColorUsageDescription && 'show-description',
    s.hasCardBorder && 'card-border',
    s.showTableHeader && 'table-header',
    s.isSpacingCustom && `gap-${s.spacingCustom}`,
    !s.isCornerRadiusCustom && s.cornerRadius && s.cornerRadius !== 'none' && `radius-${s.cornerRadius}`,
    s.isSwatchSizeCustom && 'swatch-custom',
    ...present.filter(([k]) => enabled.has(k)).map(([k]) => `show-${k}`),
  );
  const rows = [];
  if (s.title) rows.push(['Title', s.title]);
  if (s.description) rows.push(['Description', s.description]);
  rows.push(['Name', 'Usage', ...present.map(([, label]) => label)]);
  colors.forEach((c) => {
    rows.push([c.name || '', c.description || '', ...present.map(([k, , fmt]) => {
      const val = c.representations?.[k]?.value;
      return val == null ? '' : String(fmt(val));
    })]);
  });
  return [block(ctx, `Colors (${v})`, rows)];
}
