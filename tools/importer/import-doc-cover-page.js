/* global WebImporter */
/* Import script for a single-page Frontify document shown as a cover page (new document theme with
 * colour schemes and column sections), first used for The Mora brand home (document 1896).
 * Source = offline snapshot from tools/frontify-export/build-doc-cover-sources.mjs (links already
 * resolved, images under /assets/<route>/); nothing is fetched from Frontify at import time.
 * Output: <pagePath> (page), /<route>/nav (header), /<route>/footer (empty: the page hides it).
 * Structure: one EDS section per Frontify section ("doc-row" + scheme + columns metadata); each
 * section element (block) is one grid cell, in source order: Text -> "Text (cell)" block with a
 * Styles row (Frontify text style per element), Image, Divider, Cards Grid and Slider blocks. */
import { buildSections, makeCtx } from './utils/doc-sections.js';

let payload = null;
function readPayload(document) {
  if (payload) return payload;
  const el = document.getElementById('frontify-export');
  if (!el) throw new Error('No #frontify-export payload in source page');
  payload = JSON.parse(el.textContent);
  return payload;
}

function buildPage(document, data, notes) {
  const ctx = makeCtx(document, data, notes);
  const { main, counts } = buildSections(data, ctx);
  main.append(WebImporter.Blocks.getMetadataBlock(document, {
    Title: data.tabTitle,
    Template: 'doc-cover',
    Theme: data.route,
    Scheme: data.pageScheme,
    Nav: `/${data.route}/nav`,
    Footer: `/${data.route}/footer`,
    'Frontify Document': `${data.doc.id} (${data.doc.title})`,
    'Frontify Page Id': String(data.page.id),
    'Original Url': data.originalUrl,
  }));
  return { main, counts, ctx };
}

/* Header document: brand (logo link, rail link, background picture) | links | tools */
function buildNav(document, data) {
  const div = document.createElement('div');
  const { nav, assets, alts } = data;
  const logo = nav.logoKey ? `<p><a href="${nav.logoHref}"><img src="${assets[nav.logoKey]}" alt="${(alts[nav.logoKey] || data.portal.title).replace(/"/g, '&quot;')}"></a></p>` : '';
  const bg = nav.headerKey ? `<p><img src="${assets[nav.headerKey]}" alt=""></p>` : '';
  div.innerHTML = `${logo}<p><a href="${nav.railHref}">Back to dashboard</a></p>${bg}`;
  div.append(document.createElement('hr'));
  const ul = document.createElement('ul');
  nav.items.forEach((n) => {
    const li = document.createElement('li');
    if (n.children) {
      li.append(document.createTextNode(n.title));
      const sub = document.createElement('ul');
      n.children.forEach((c) => { const s = document.createElement('li'); const a = document.createElement('a'); a.href = c.href; a.textContent = c.title; s.append(a); sub.append(s); });
      li.append(sub);
    } else {
      const a = document.createElement('a');
      a.href = n.href;
      a.textContent = n.title;
      li.append(a);
    }
    ul.append(li);
  });
  div.append(ul, document.createElement('hr'));
  // Search and the Brand Assistant (AI) are excluded from the migration.
  if (nav.brandHub) div.insertAdjacentHTML('beforeend', `<ul><li><a href="${nav.brandHub.href}">:brand-hub: ${nav.brandHub.label}</a></li></ul>`);
  return div;
}

export default {
  onLoad: ({ document }) => { payload = null; readPayload(document); },
  transform: ({ document }) => {
    const data = readPayload(document);
    const notes = [];
    const { main, counts, ctx } = buildPage(document, data, notes);
    const footer = document.createElement('div');
    footer.innerHTML = '<p></p>'; // footerVisibility: hide in the Frontify page theme
    return [
      {
        element: main,
        path: data.pagePath,
        report: {
          blocks: JSON.stringify(counts), notes: JSON.stringify(notes), links: ctx.links.length, missing: JSON.stringify(ctx.missing),
        },
      },
      { element: buildNav(document, data), path: `/${data.route}/nav` },
      { element: footer, path: `/${data.route}/footer` },
    ];
  },
};
