/* Frontify page heading (section heading shown in the sidebar). */
export default function parse(b, ctx) {
  const level = String(b.settings?.type_style || 'HEADING2').replace(/\D/g, '') || '2';
  const h = ctx.document.createElement(`h${level}`);
  h.textContent = b.title || '';
  return [h];
}
