/*
 * Hub Divider: Frontify portal-home divider cell.
 * Rows: Line ("<height>px <colour>"), Padding ("t r b l"), optional Background.
 */
export default function decorate(block) {
  const cfg = {};
  [...block.children].forEach((row) => {
    const [k, v] = row.children;
    if (k && v) cfg[k.textContent.trim().toLowerCase()] = v.textContent.trim();
  });
  const [height = '1px', ...color] = (cfg.line || '1px rgb(221, 221, 221)').split(' ');
  const content = document.createElement('div');
  content.className = 'pb-divider__content';
  content.style.padding = cfg.padding || '25px 0';
  if (cfg.background) content.style.background = cfg.background;
  const hr = document.createElement('hr');
  hr.className = 'pb-divider__line';
  hr.style.height = height;
  hr.style.background = color.join(' ');
  content.append(hr);
  block.textContent = '';
  block.append(content);
}
