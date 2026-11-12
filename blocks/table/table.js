/*
 * Table (Frontify "Table" block, new document theme).
 * Markup: first row = column headers, every following row = one table row; cells hold rich text.
 * Variants: frontify (Frontify look: 1px grid lines, 8px 10px cell padding),
 * widths-<w1>-<w2>-... (column widths in px from Frontify; the table is as wide as their sum and
 * shrinks with the column on narrow screens, like Frontify's auto table layout).
 */

export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;
  const cols = Math.max(...rows.map((row) => row.children.length));
  const widthClass = [...block.classList].find((c) => /^widths(-\d+)+$/.test(c));
  const widths = widthClass ? widthClass.split('-').slice(1).map(Number) : [];

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  rows.forEach((row, r) => {
    const tr = document.createElement('tr');
    const cells = [...row.children];
    for (let i = 0; i < cols; i += 1) {
      const cell = document.createElement(r === 0 ? 'th' : 'td');
      if (r === 0) {
        cell.scope = 'col';
        if (widths.length === cols && widths[i]) cell.style.width = `${widths[i]}px`;
      }
      const content = document.createElement('div');
      content.className = 'table-cell';
      if (cells[i]) content.append(...cells[i].childNodes);
      cell.append(content);
      tr.append(cell);
    }
    (r === 0 ? thead : tbody).append(tr);
  });
  table.append(thead, tbody);
  block.replaceChildren(table);
}
