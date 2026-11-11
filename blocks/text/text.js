/*
 * Text (Frontify "Text" block) - multi-column rich text, or a text block that directly
 * follows another one. Variant classes: columns-2..5, gutter-auto|s|m|l|custom.
 * Rows: rich text (one or more cells), optional "Gutter | 20px".
 */

const GUTTERS = {
  auto: 'normal', s: '10px', m: '30px', l: '50px',
};

function toLength(value) {
  const v = (value || '').trim().toLowerCase();
  if (/^-?\d+(\.\d+)?$/.test(v)) return `${v}px`;
  return /^-?\d+(\.\d+)?(px|rem|em|%)$/.test(v) ? v : '';
}

export default function decorate(block) {
  const content = document.createElement('div');
  content.className = 'text-content';
  let gutter = '';

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length === 2 && cells[0].textContent.trim().toLowerCase() === 'gutter') {
      gutter = toLength(cells[1].textContent);
      return;
    }
    cells.forEach((cell) => content.append(...cell.childNodes));
  });

  const preset = [...block.classList].find((c) => c.startsWith('gutter-'))?.slice(7);
  if (gutter) content.style.columnGap = gutter;
  else if (GUTTERS[preset]) content.style.columnGap = GUTTERS[preset];

  block.replaceChildren(content);
}
