/*
 * Colors block (Frontify "Colors", card view).
 *
 * Markup: optional `Title | text` and `Description | text` rows, a header row
 * `Name | Usage | RGBA | HEX | ...` naming the value columns, then one row per
 * colour. Block classes `show-<key>` select which representations are shown.
 */

const LABEL_KEYS = {
  rgba: 'rgba',
  hex: 'hex',
  hsl: 'hsl',
  lab: 'lab',
  ral: 'ral',
  pms: 'pantone',
  'pms coated': 'pantoneCoated',
  'pms uncoated': 'pantoneUncoated',
  'pms cp': 'pantoneCp',
  'pms plastics': 'pantonePlastics',
  'pms textile': 'pantoneTextile',
  cmyk: 'cmyk',
  'cmyk coated': 'cmykCoated',
  'cmyk uncoated': 'cmykUncoated',
  'cmyk newspaper': 'cmykNewspaper',
  ncs: 'ncs',
  hks: 'hks',
  '3m': 'threeM',
  oracal: 'oracal',
  'css variable': 'cssVariable',
};

const META_ROWS = ['title', 'description'];

const COPY_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M17 17.5v-6.444a2 2 0 00-.582-1.41l-.145-.147H18.5V16a1.5 1.5 0 01-1.5 1.5m-2.49-9.773v-3.89l3.845 3.866a.5.5 0 01.142.296h-3.715zm-1.5-1.509-.623-.628A2 2 0 0010.968 5H8.5A1.5 1.5 0 0110 3.5h3.01zM7 5a3 3 0 013-3h3.968a2 2 0 011.418.59l4.032 4.056A2 2 0 0120 8.056V16a3 3 0 01-3 3 3 3 0 01-3 3H7a3 3 0 01-3-3V8a3 3 0 013-3m0 15.5h7a1.5 1.5 0 001.5-1.5v-6.5h-5.49v-6H7A1.5 1.5 0 005.5 8v11A1.5 1.5 0 007 20.5m8.355-9.797a.5.5 0 01.142.296H11.51V6.837z"/></svg>';
const CHECK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
const cellText = (cell) => normalize(cell?.textContent);

function swatchColor(values) {
  const hex = values.hex && values.hex.trim();
  if (hex && /^#?[0-9a-f]{3,8}$/i.test(hex)) return hex.startsWith('#') ? hex : `#${hex}`;
  const rgba = values.rgba && values.rgba.match(/[\d.]+/g);
  if (rgba && rgba.length >= 3) {
    const [r, g, b, a = 1] = rgba;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return 'transparent';
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

function buildValueRow(label, value) {
  const row = document.createElement('div');
  row.className = 'colors-rep';

  const labelEl = document.createElement('div');
  labelEl.className = 'colors-rep-label';
  labelEl.textContent = label;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'colors-rep-value';
  button.setAttribute('aria-label', `${label} color representation value`);

  const text = document.createElement('span');
  text.className = 'colors-rep-text';
  text.textContent = value;

  const icon = document.createElement('span');
  icon.className = 'colors-rep-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = COPY_ICON;

  const status = document.createElement('span');
  status.className = 'colors-sr-only';
  status.setAttribute('aria-live', 'polite');

  let timer;
  button.addEventListener('click', async () => {
    const ok = await copyText(value);
    if (!ok) return;
    clearTimeout(timer);
    button.classList.add('is-copied');
    icon.innerHTML = CHECK_ICON;
    status.textContent = 'Copied';
    timer = setTimeout(() => {
      button.classList.remove('is-copied');
      icon.innerHTML = COPY_ICON;
      status.textContent = '';
    }, 2000);
  });

  button.append(text, icon, status);
  row.append(labelEl, button);
  return row;
}

export default function decorate(block) {
  const rows = [...block.children];
  const meta = {};
  let columns = null;
  const colorRows = [];

  rows.forEach((row) => {
    const cells = [...row.children];
    const first = cellText(cells[0]).toLowerCase();
    if (!columns && META_ROWS.includes(first) && cells.length <= 2) {
      meta[first] = cells[1] || null;
    } else if (!columns && first === 'name') {
      columns = cells.map((c) => {
        const label = cellText(c);
        return { label, key: LABEL_KEYS[label.toLowerCase()] || label.toLowerCase() };
      });
    } else if (cells.some((c) => cellText(c))) {
      colorRows.push(cells);
    }
  });

  const shown = [...block.classList]
    .filter((c) => c.startsWith('show-') && c !== 'show-description')
    .map((c) => c.slice(5).toLowerCase());

  // no header row: assume Name | Usage | <shown representations in order>
  if (!columns) {
    columns = [{ key: 'name' }, { key: 'usage' }, ...shown.map((k) => ({ key: k, label: k.toUpperCase() }))];
  }
  const colIndex = (key) => columns.findIndex((c) => c.key.toLowerCase() === key);
  const valueCols = columns.slice(2);
  const visible = shown.length
    ? shown
      .map((k) => valueCols.find((c) => c.key.toLowerCase() === k))
      .filter(Boolean)
    : valueCols.filter((c) => c.key !== 'cssVariable');

  const gapClass = [...block.classList].find((c) => /^gap-\d+(px)?$/.test(c));
  if (gapClass) block.style.setProperty('--colors-gap', `${parseInt(gapClass.slice(4), 10)}px`);

  const showUsage = block.classList.contains('show-description');

  // header (title / description)
  const header = document.createElement('div');
  header.className = 'colors-header';
  if (meta.title && cellText(meta.title)) {
    const title = document.createElement('div');
    title.className = 'colors-title';
    title.textContent = cellText(meta.title);
    header.append(title);
  }
  if (meta.description && cellText(meta.description)) {
    const desc = document.createElement('div');
    desc.className = 'colors-description';
    desc.append(...meta.description.childNodes);
    header.append(desc);
  }

  const grid = document.createElement('ul');
  grid.className = 'colors-grid';

  const nameIdx = Math.max(0, colIndex('name'));
  const usageIdx = colIndex('usage');
  colorRows.forEach((cells) => {
    const values = {};
    columns.forEach((c, i) => { values[c.key] = cellText(cells[i]); });

    const card = document.createElement('li');
    card.className = 'colors-card';

    const swatch = document.createElement('div');
    swatch.className = 'colors-swatch';
    swatch.style.backgroundColor = swatchColor(values);

    const body = document.createElement('div');
    body.className = 'colors-body';

    // inline-block inside a block box, like Frontify (adds the strut descent)
    const name = document.createElement('div');
    name.className = 'colors-name';
    const nameText = document.createElement('span');
    nameText.textContent = cellText(cells[nameIdx]);
    name.append(nameText);
    body.append(name);

    if (showUsage && usageIdx >= 0 && cellText(cells[usageIdx])) {
      const usage = document.createElement('div');
      usage.className = 'colors-usage';
      usage.append(...cells[usageIdx].childNodes);
      body.append(usage);
    }

    const reps = document.createElement('div');
    reps.className = 'colors-reps';
    visible.forEach((col) => {
      const value = values[col.key];
      if (value) reps.append(buildValueRow(col.label, value));
    });
    if (reps.children.length) body.append(reps);

    card.append(swatch, body);
    grid.append(card);
  });

  block.replaceChildren(header, grid);
}
