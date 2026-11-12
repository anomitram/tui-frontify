import {
  block, link, decodeEntities, fileTarget,
} from '../utils/frontify.js';

/* Frontify "Attachments" (downloads) block. Row: file link | size | type. */
export default function parse(b, ctx) {
  const rows = (b.settings?.downloads || []).map((d) => {
    const href = ctx.assets[`attachment-${d.attachment}`];
    if (!href) ctx.missing.push(`attachment-${d.attachment}`);
    const title = decodeEntities(d.title || '');
    return [href ? link(ctx, fileTarget(ctx, href), title) : title, d.size || '', d.ext || ''];
  });
  return [block(ctx, 'Attachments', rows)];
}
