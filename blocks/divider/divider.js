/*
 * Divider (Frontify "Divider" block).
 * Variant classes: solid|dashed|dotted|no-line, height-small|medium|large, align-center|right.
 * Rows: "Line | 1px solid rgba(...)" (or "none"), optional "Height | 10px", "Width | 50%".
 */

const LENGTH = /^\d+(\.\d+)?(px|rem|em|%|vh)?$/;

function toLength(value) {
  const v = (value || '').trim().toLowerCase();
  if (!LENGTH.test(v)) return '';
  return /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v;
}

export default function decorate(block) {
  const opts = {};
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    opts[cells[0].textContent.trim().toLowerCase()] = cells[1].textContent.trim();
  });

  const box = document.createElement('div');
  box.className = 'divider-box';
  const height = toLength(opts.height);
  if (height) box.style.height = height;
  const width = toLength(opts.width);
  if (width) box.style.width = width;

  const hr = document.createElement('hr');
  const line = (opts.line || '').trim();
  if (line && line.toLowerCase() !== 'none' && !block.classList.contains('no-line')) {
    const match = line.match(/^(\S+)\s+(solid|dashed|dotted)\s+(.+)$/i);
    if (match) {
      const [, thickness, style, color] = match;
      if (toLength(thickness)) hr.style.borderTopWidth = toLength(thickness);
      hr.style.borderTopStyle = style.toLowerCase();
      if (CSS.supports('color', color)) hr.style.borderTopColor = color;
    }
  } else if (line.toLowerCase() === 'none' || block.classList.contains('no-line')) {
    hr.classList.add('no-line');
  }
  box.append(hr);
  block.replaceChildren(box);
}
