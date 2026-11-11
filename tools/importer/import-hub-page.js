/* global WebImporter */
/* Import script for a Frontify hub (portal home) page, first used for the TUI MAGIC LIFE portal
 * (portal 162, route "tuimagiclife"). Source = offline snapshot built by
 * tools/frontify-export/build-hub-sources.mjs; nothing is fetched from Frontify at import time.
 * Output: /<route> (page), /<route>/nav (portal header), /<route>/footer (portal footer). */
import hubCell from './parsers/hub-cell.js';
import hubDivider from './parsers/hub-divider.js';

let payload = null;
function readPayload(document) {
  if (payload) return payload;
  const el = document.getElementById('frontify-hub-export');
  if (!el) throw new Error('No #frontify-hub-export payload in source page');
  payload = JSON.parse(el.textContent);
  return payload;
}

const len = (x) => {
  if (x == null || x === '') return null;
  return typeof x === 'number' ? `${x}px` : String(x);
};

function buildPage(document, data, notes) {
  const main = document.createElement('div');
  const counts = { rows: 0, cells: 0 };
  data.rows.forEach((row, i) => {
    if (i > 0) main.append(document.createElement('hr'));
    counts.rows += 1;
    const ctx = {
      document, WebImporter, assets: data.assets, linkMap: data.linkMap, host: data.host, notes, rowId: row.id,
    };
    let visible = 0;
    row.cells.forEach((cell) => {
      counts.cells += 1;
      if (cell.block_type === 'TEXTIMAGE') {
        main.append(hubCell(cell, ctx));
        visible += 1;
      } else if (cell.block_type === 'DIVIDER') {
        main.append(hubDivider(cell, ctx));
        visible += 1;
      } else {
        notes.push(`row ${row.id}: ${cell.block_type} cell ${cell.teaser} has no content (editor placeholder) - kept as empty row`);
      }
    });
    const s = row.settings || {};
    const meta = { Style: visible ? 'hub-row' : 'hub-row, empty', Row: String(row.id) };
    if (s.width) meta.Width = len(s.width);
    if (s.content_width) meta['Content Width'] = len(s.content_width);
    if (s.margin) meta.Gutter = len(s.margin);
    if (s.margin_top) meta['Margin Top'] = len(s.margin_top);
    if (s.margin_bottom) meta['Margin Bottom'] = len(s.margin_bottom);
    if (s.background) meta.Background = s.background;
    main.append(WebImporter.Blocks.createBlock(document, { name: 'Section Metadata', cells: meta }));
  });
  main.append(WebImporter.Blocks.getMetadataBlock(document, {
    Title: data.tabTitle,
    Template: 'hub',
    Theme: data.route,
    Nav: `/${data.route}/nav`,
    Footer: `/${data.route}/footer`,
    'Frontify Portal': `${data.portal.id} (${data.portal.title})`,
    'Original Url': `${data.host}/${data.route}`,
  }));
  return { main, counts };
}

function buildNav(document, data) {
  const div = document.createElement('div');
  const logo = data.assets[data.logoKey];
  div.innerHTML = `<p><a href="/${data.route}"><img src="${logo}" alt="Go to ${data.portal.title}"></a></p><p><a href="${data.host}/dashboard">Back to dashboard</a></p>`;
  div.append(document.createElement('hr'));
  const ul = document.createElement('ul');
  data.navItems.forEach((n) => {
    const li = document.createElement('li');
    if (n.children.length) {
      li.append(document.createTextNode(n.title));
      const sub = document.createElement('ul');
      n.children.forEach((c) => { const s = document.createElement('li'); s.innerHTML = `<a href="${c.href}"></a>`; s.firstChild.textContent = c.title; sub.append(s); });
      li.append(sub);
    } else {
      li.innerHTML = `<a href="${n.href}"></a>`;
      li.firstChild.textContent = n.type === 'cover_page' ? 'Home' : n.title;
    }
    ul.append(li);
  });
  div.append(ul, document.createElement('hr'));
  // Search and the AI brand assistant are excluded from this migration (not reproduced).
  if (data.portal.brandHub?.url) div.insertAdjacentHTML('beforeend', `<ul><li><a href="${data.portal.brandHub.url}">:brand-hub: ${data.portal.brandHub.label || 'Brand Hub'}</a></li></ul>`);
  return div;
}

export default {
  onLoad: ({ document }) => { payload = null; readPayload(document); },
  transform: ({ document }) => {
    const data = readPayload(document);
    const notes = [];
    const { main, counts } = buildPage(document, data, notes);
    const footer = document.createElement('div');
    footer.innerHTML = '<p></p>'; // the portal footer content is empty in Frontify
    return [
      {
        element: main,
        path: `/${data.route}`,
        report: {
          rows: counts.rows, cells: counts.cells, notes: JSON.stringify(notes), links: Object.keys(data.linkMap).length,
        },
      },
      { element: buildNav(document, data), path: `/${data.route}/nav` },
      { element: footer, path: `/${data.route}/footer` },
    ];
  },
};
