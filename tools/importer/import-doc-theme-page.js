/* global WebImporter */
/* Import script for pages of multi-page Frontify documents in the new document theme (colour
 * schemes, 24-column sections, sidebar), first used for The Mora portal 292 documents Brand,
 * Hotels, Support and Libraries Overview. Source = offline snapshots from
 * tools/frontify-export/build-doc-theme-sources.mjs (links resolved, images under
 * /assets/<route>/<doc>/<page>/); nothing is fetched from Frontify at import time.
 * Output per page: <pagePath>. With the first page of each document also: <prefix>/sidebar
 * (categories, pages, headings - read by scripts/guideline.js) and <prefix> (redirect to the first
 * page; old "#/<cat>/<page>" routes resolve under Redirect Base).
 * Page layout: template "guideline" + Layout "doc-sections" (scripts/doc-cover.js builds the
 * section grid, scripts/guideline.js the sidebar, pagination and "Last modified"). The portal
 * header (/<route>/nav) and footer come from the cover page import (import-doc-cover-page.js). */
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
  const meta = {
    Title: data.tabTitle,
    Template: 'guideline',
    Layout: 'doc-sections',
    Theme: data.route,
    Scheme: data.pageScheme,
    Nav: `/${data.route}/nav`,
    Footer: `/${data.route}/footer`,
    Sidebar: data.sidebarPath,
    'Header Image': 'none',
    Category: data.page.catTitle || '',
    'Last Modified': data.lastModified || '',
    'Frontify Document': `${data.doc.id} (${data.doc.title})`,
    'Frontify Page Id': String(data.page.id),
    'Original Url': data.originalUrl,
  };
  if (data.pagination === 'hide') meta.Pagination = 'hide';
  if (data.permanentLink) meta['Original Permalink'] = data.permanentLink;
  main.append(WebImporter.Blocks.getMetadataBlock(document, meta));
  return { main, counts, ctx };
}

/* Sidebar document, same format as the doc 396 /sidebar (scripts/guideline.js parseSidebar):
 * <li><strong>Category</strong><ul><li><a>Page</a><ul><li><a href="page#slug">Heading</a>... */
function buildSidebar(document, data) {
  const div = document.createElement('div');
  const ul = document.createElement('ul');
  const a = (href, text) => { const x = document.createElement('a'); x.href = href; x.textContent = text; return x; };
  const pageLi = (p) => {
    const li = document.createElement('li');
    li.append(a(p.path, p.title));
    if (p.headings.length) {
      const hs = document.createElement('ul');
      p.headings.forEach((h) => { const hl = document.createElement('li'); hl.append(a(`${p.path}#${h.slug}`, h.title)); hs.append(hl); });
      li.append(hs);
    }
    return li;
  };
  data.chrome.categories.forEach((cat) => {
    const pages = cat.pages.filter((p) => p.published && !p.hidden);
    if (!pages.length) return;
    if (cat.uncategorized) { pages.forEach((p) => ul.append(pageLi(p))); return; }
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = cat.title;
    const sub = document.createElement('ul');
    pages.forEach((p) => sub.append(pageLi(p)));
    li.append(strong, sub);
    ul.append(li);
  });
  div.append(ul);
  return div;
}

function buildRedirect(document, data) {
  const div = document.createElement('div');
  const { first } = data.chrome;
  div.innerHTML = `<p><a href="${first.path}">${first.title}</a></p>`;
  div.append(WebImporter.Blocks.getMetadataBlock(document, {
    Title: `${data.doc.title} - ${data.tabTitle.split(' - ').pop()}`,
    Template: 'redirect',
    Redirect: first.path,
    'Redirect Base': data.doc.prefix,
    Robots: 'noindex',
  }));
  return div;
}

export default {
  onLoad: ({ document }) => { payload = null; readPayload(document); },
  transform: ({ document }) => {
    const data = readPayload(document);
    const notes = [];
    const { main, counts, ctx } = buildPage(document, data, notes);
    const results = [{
      element: main,
      path: data.pagePath,
      report: {
        frontifyPageId: data.page.id,
        originalUrl: data.originalUrl,
        blocks: JSON.stringify(counts),
        notes: JSON.stringify(notes),
        missing: JSON.stringify(ctx.missing),
      },
    }];
    if (data.chrome) {
      if (data.sidebarPath !== 'none') results.push({ element: buildSidebar(document, data), path: data.sidebarPath });
      results.push({ element: buildRedirect(document, data), path: data.doc.prefix });
    }
    return results;
  },
};
