/*
 * Callout (Frontify "Callout" block).
 * Variant classes: info|note|tip|warning, light|strong, padding-s|m|l,
 * radius-none|small|medium|large, icon-info|icon-lightbulb|icon-megaphone,
 * width-hugcontents, align-center|right.
 * Optional rows: "Padding | top right bottom left", "Radius | tl tr br bl".
 */

const ICONS = {
  info: 'M11.5 3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M7.25 8.25A.75.75 0 0 1 8 7.5h2.75a.75.75 0 0 1 .75.75v8.25h1.75a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1 0-1.5H10V9H8a.75.75 0 0 1-.75-.75',
  lightbulb: 'M12.252 10.842a1.5 1.5 0 0 0-.752 1.3v2.283h-3v-2.283a1.5 1.5 0 0 0-.752-1.3 4.5 4.5 0 0 1-.563-.384A4.45 4.45 0 0 1 5.5 6.97C5.5 4.508 7.508 2.5 10 2.5s4.5 2.008 4.5 4.47a4.45 4.45 0 0 1-1.685 3.488 4.5 4.5 0 0 1-.563.383M7 14.425v-2.283a6 6 0 0 1-.75-.511A5.95 5.95 0 0 1 4 6.97C4 3.672 6.686 1 10 1s6 2.673 6 5.97a5.95 5.95 0 0 1-2.25 4.66q-.355.285-.75.511v2.284a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5m1.125 2.99a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5z',
  megaphone: 'M14.5 3.747a.25.25 0 0 0-.38-.214L10.237 5.89l-.18.109H9v4.5h1.062l.182.113 3.874 2.413a.25.25 0 0 0 .382-.212zM9.637 4.5H3.5A2.5 2.5 0 0 0 1 7v2.5c0 .89.465 1.671 1.165 2.114l1.167 5.4A1.25 1.25 0 0 0 4.554 18H6.25c.69 0 1.25-.56 1.25-1.25V12h2.133l3.692 2.3c1.166.725 2.675-.113 2.675-1.486V3.747c0-1.365-1.492-2.204-2.658-1.496zM3.5 6h4v4.5h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1m.283 6 .972 4.5H6V12zm15.292-5.873a.75.75 0 0 0-1.5 0v4.653a.75.75 0 0 0 1.5 0z',
};

const OPTION_ROWS = ['padding', 'radius'];

function iconSvg(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('clip-rule', 'evenodd');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/** Normalise a CSS length list such as "12px 16 0 4px". */
function lengths(value) {
  return value.trim().split(/\s+/).filter(Boolean)
    .map((v) => (/^-?\d+(\.\d+)?$/.test(v) ? `${v}px` : v))
    .filter((v) => /^-?\d+(\.\d+)?(px|rem|em|%)$/.test(v))
    .join(' ');
}

export default function decorate(block) {
  const rows = [...block.children];
  const content = document.createElement('div');
  content.className = 'callout-text';

  rows.forEach((row) => {
    const cells = [...row.children];
    const key = cells.length > 1 ? cells[0].textContent.trim().toLowerCase() : '';
    if (OPTION_ROWS.includes(key)) {
      const value = lengths(cells[1].textContent);
      if (value && key === 'padding') block.style.padding = value;
      if (value && key === 'radius') block.style.borderRadius = value;
      return;
    }
    // rich text: every cell of every other row contributes its content
    // (aem.js has already wrapped bare cell text in <p>)
    cells.forEach((cell) => content.append(...cell.childNodes));
  });

  const inner = document.createElement('div');
  inner.className = 'callout-content';
  const iconClass = [...block.classList].find((c) => c.startsWith('icon-') && ICONS[c.slice(5)]);
  if (iconClass) {
    block.classList.add('has-icon');
    const icon = document.createElement('span');
    icon.className = 'callout-icon';
    icon.append(iconSvg(iconClass.slice(5)));
    inner.append(icon);
  }
  inner.append(content);
  block.replaceChildren(inner);
}
