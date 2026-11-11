import {
  slateToHtml, frag, block, variants,
} from '../utils/frontify.js';

/* Frontify "Callout" block: type (info/warning/tip/note), appearance (light/strong),
 * padding, radius, icon, width, alignment. */
export default function parse(b, ctx) {
  const s = b.settings || {};
  const v = variants(
    s.type || 'info',
    s.appearance || 'light',
    s.width && s.width !== 'fullWidth' && `width-${s.width}`,
    s.alignment && s.alignment !== 'left' && `align-${s.alignment}`,
    !s.hasCustomPadding && `padding-${s.paddingChoice || 'm'}`,
    !s.hasExtendedCustomRadius && `radius-${s.extendedRadiusChoice || 'none'}`,
    // Frontify shows the chosen icon whenever iconType is set (iconSwitch only toggles custom icons).
    s.iconType && s.iconType !== 'none' && `icon-${s.iconType}`,
  );
  const rows = [[frag(ctx, slateToHtml(s.textValue || '', ctx))]];
  if (s.hasCustomPadding) rows.push(['Padding', [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((x) => x || '0px').join(' ')]);
  if (s.hasExtendedCustomRadius) rows.push(['Radius', [s.extendedRadiusTopLeft, s.extendedRadiusTopRight, s.extendedRadiusBottomRight, s.extendedRadiusBottomLeft].map((x) => x || '0px').join(' ')]);
  return [block(ctx, `Callout (${v})`, rows)];
}
