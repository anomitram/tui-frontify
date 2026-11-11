/* global WebImporter */
/* Import script for Frontify guideline pages (first used for TUI Brand Hub document 396).
 * Source pages are offline snapshots (built by tools/frontify-export/build-sources.mjs) that
 * embed the exported Frontify page JSON; nothing is fetched from the brand hub at import time. */
import { rewriteLink } from './utils/frontify.js';
import textParser from './parsers/text.js';
import headingParser from './parsers/heading.js';
import calloutParser from './parsers/callout.js';
import imageParser from './parsers/image.js';
import videoParser from './parsers/video.js';
import annotationsParser from './parsers/annotations.js';
import imageGridParser from './parsers/image-grid.js';
import dividerParser from './parsers/divider.js';
import attachmentsParser from './parsers/attachments.js';
import colorsParser from './parsers/colors.js';
import assetKitParser from './parsers/asset-kit.js';
import audioParser from './parsers/audio.js';

let HOST = 'https://tui-brandhub.com'; // replaced by the payload's host in makeCtx()
// The Frontify dashboard ("Brand Hub", "Back to dashboard") is the migrated homepage "/" (portal 161).
const HOME = '/';

const PARSERS = {
  Text: textParser,
  Heading: headingParser,
  Callout: calloutParser,
  Image: imageParser,
  Video: videoParser,
  Annotations: annotationsParser,
  'Image grid': imageGridParser,
  Divider: dividerParser,
  Attachments: attachmentsParser,
  Colors: colorsParser,
  'Asset Kit': assetKitParser,
  Audio: audioParser,
};

// html2md strips <script> elements before transform(), so onLoad() stashes the payload first.
let payload = null;
function readPayload(document) {
  if (payload) return payload;
  const el = document.getElementById('frontify-export');
  if (!el) throw new Error('No #frontify-export payload in source page');
  payload = JSON.parse(el.textContent);
  return payload;
}

function makeCtx(document, data) {
  HOST = data.host || HOST;
  return {
    host: HOST,
    docId: data.doc.id,
    document,
    WebImporter,
    assets: data.assets,
    colors: data.colors || {},
    order: data.nav.order,
    firstPath: data.nav.order[0].path,
    permalinks: data.permalinks || {},
    links: [],
    missing: [],
    notes: [],
  };
}

const hr = (document) => document.createElement('hr');

function metadataBlock(document, data, ctx) {
  const { page, self } = data;
  const rows = {
    Title: data.tabTitle || `${page.title} - ${data.doc.title}`,
    Template: 'guideline',
    Category: self.catTitle || '',
    'Category Slug': self.cat || '',
    'Frontify Page Id': String(page.id),
    'Last Modified': data.lastModified || '',
    'Original Url': data.frontifyUrl,
  };
  if (data.permanentLink) rows['Original Permalink'] = data.permanentLink;
  if (!page.title) rows.Robots = 'noindex';
  return ctx.WebImporter.Blocks.getMetadataBlock(document, rows);
}

function buildPage(document, data, ctx) {
  const main = document.createElement('div');
  const { page } = data;
  const counts = {};

  // Page title (Frontify shows the page title as H1 above the first section).
  const h1 = document.createElement('h1');
  // Untitled pages keep an empty title line in Frontify; a zero-width space keeps the h1.
  h1.textContent = page.title || '\u200B';
  main.append(h1);

  const sections = [...page.sections].sort((a, b) => a.sort - b.sort);
  sections.forEach((s) => {
    main.append(hr(document));
    if (!s.content || !s.content.length) {
      // Frontify still renders empty sections (16px top/bottom padding), so keep them.
      main.append(WebImporter.Blocks.createBlock(document, { name: 'Section Metadata', cells: { Style: 'empty' } }));
      ctx.notes.push(`Empty section ${s.id} kept as spacer`);
      return;
    }
    let prevType = null;
    s.content.forEach((b) => {
      const type = b.display_name || (b.slug !== undefined ? 'Heading' : 'Unknown');
      counts[type] = (counts[type] || 0) + 1;
      const parser = PARSERS[type];
      if (!parser) { ctx.notes.push(`Unknown block type ${type} (${b.id})`); return; }
      const nodes = parser(b, ctx, { prevType });
      nodes.forEach((n) => main.append(n));
      prevType = type;
    });
    const nonDefault = s.alignment || s.max_width || s.vertical_padding || s.horizontal_padding
      || s.vertical_gutter || s.horizontal_gutter || s.has_border || s.color_scheme_id;
    if (nonDefault) {
      const rows = { Style: 'frontify-section' };
      if (s.vertical_gutter) rows['Vertical Gutter'] = s.vertical_gutter;
      if (s.horizontal_gutter) rows['Horizontal Gutter'] = s.horizontal_gutter;
      if (s.vertical_padding) rows['Vertical Padding'] = s.vertical_padding;
      if (s.horizontal_padding) rows['Horizontal Padding'] = s.horizontal_padding;
      if (s.max_width) rows['Max Width'] = s.max_width;
      if (s.alignment) rows.Alignment = s.alignment;
      main.append(WebImporter.Blocks.createBlock(document, { name: 'Section Metadata', cells: rows }));
    }
  });

  // Pagination + last modified are rendered by the guideline template from metadata/sidebar.
  main.append(metadataBlock(document, data, ctx));
  return { main, counts };
}

/* ---------- shared chrome documents (nav, sidebar, footer) ---------- */

function libraryHref(item) {
  if (item.type === 'link_document') {
    const u = item.url || '';
    return u.startsWith('/') ? HOST + u : u;
  }
  return `${HOST}/document/${item.id}`;
}

function buildNav(document, data) {
  const div = document.createElement('div');
  const logo = data.assets[data.logoKey];
  // section 1: brand (logo + back to dashboard rail)
  div.innerHTML = `<p><a href="${data.nav.order[0].path}"><img src="${logo}" alt="${data.portalTitle} logo"></a></p>
    <p><a href="${HOME}">Back to dashboard</a></p>`;
  div.append(hr(document));
  // section 2: portal navigation
  const ul = document.createElement('ul');
  data.portalNav.filter((n) => !n.is_hidden_in_navigation).forEach((n) => {
    const tr = n.translations?.default || {};
    const li = document.createElement('li');
    if (n.type === 'document_group') {
      li.append(document.createTextNode(tr.name || ''));
      const sub = document.createElement('ul');
      (n.children || n.items || []).forEach((c) => {
        const ct = c.translations?.default || {};
        const sli = document.createElement('li');
        const a = document.createElement('a');
        a.href = libraryHref(c);
        a.textContent = ct.title || ct.name || '';
        sli.append(a);
        sub.append(sli);
      });
      li.append(sub);
    } else {
      const a = document.createElement('a');
      a.href = n.id === data.doc.id ? data.nav.order[0].path : libraryHref(n);
      a.textContent = tr.title || '';
      li.append(a);
    }
    ul.append(li);
  });
  div.append(ul);
  div.append(hr(document));
  // section 3: tools
  div.insertAdjacentHTML('beforeend', `<ul>
    <li><a href="${HOME}">:brand-hub: Brand Hub</a></li>
    <li>:search: Search</li>
    <li><a href="${HOST}/document/${data.doc.id}">:brand-assistant: Brand Assistant</a></li>
  </ul>`);
  return div;
}

function buildSidebar(document, data) {
  const div = document.createElement('div');
  const ul = document.createElement('ul');
  data.nav.categories.forEach((cat) => {
    const visiblePages = cat.pages.filter((p) => !p.hidden && p.published);
    if (!visiblePages.length) return;
    if (cat.uncategorized) {
      visiblePages.forEach((p) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = p.path;
        if (p.title) a.textContent = p.title;
        else {
          // Frontify hides untitled pages in the sidebar; pagination labels them with the
          // document title. Italic link text = "hidden in sidebar, label only".
          const em = document.createElement('em');
          em.textContent = data.doc.title;
          a.append(em);
        }
        li.append(a);
        ul.append(li);
      });
      return;
    }
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = cat.title;
    li.append(strong);
    const pages = document.createElement('ul');
    visiblePages.forEach((p) => {
      const pli = document.createElement('li');
      const a = document.createElement('a');
      a.href = p.path;
      a.textContent = p.title;
      pli.append(a);
      if (p.headings.length) {
        const hs = document.createElement('ul');
        p.headings.forEach((h) => {
          const hli = document.createElement('li');
          const ha = document.createElement('a');
          ha.href = `${p.path}#${h.slug}`;
          ha.textContent = h.title;
          hli.append(ha);
          hs.append(hli);
        });
        pli.append(hs);
      }
      pages.append(pli);
    });
    li.append(pages);
    ul.append(li);
  });
  div.append(ul);
  return div;
}

/* Redirect documents: "/" and the old Frontify document URL ("/document/396", whose
 * "#/category/page/heading" hash routes are resolved in the browser by the redirect template). */
function buildRedirect(document, data, title) {
  const div = document.createElement('div');
  const first = data.nav.order[0];
  div.innerHTML = `<p><a href="${first.path}">${first.title}</a></p>`;
  div.append(WebImporter.Blocks.getMetadataBlock(document, {
    Title: title,
    Template: 'redirect',
    Redirect: first.path,
    Robots: 'noindex',
  }));
  return div;
}

function buildFooter(document) {
  const div = document.createElement('div');
  // The portal footer is empty in Frontify; keep an (empty) footer document.
  div.innerHTML = '<p></p>';
  return div;
}

export default {
  onLoad: ({ document }) => { payload = null; readPayload(document); },
  transform: ({ document }) => {
    const data = readPayload(document);
    const ctx = makeCtx(document, data);
    const { main, counts } = buildPage(document, data, ctx);
    const links = ctx.links.filter((l) => l.kind !== 'internal' || l.source !== l.href);
    const report = {
      frontifyPageId: data.page.id,
      originalUrl: data.frontifyUrl,
      blockCounts: JSON.stringify(counts),
      outOfScopeLinks: JSON.stringify(links.filter((l) => l.kind === 'out-of-scope').map((l) => l.href)),
      rewrittenLinks: JSON.stringify(links.filter((l) => l.kind === 'internal').map((l) => `${l.source} -> ${l.href}`)),
      fixedLinks: JSON.stringify(links.filter((l) => l.kind === 'email').map((l) => `${l.source} -> ${l.href}`)),
      missing: JSON.stringify(ctx.missing),
      notes: JSON.stringify(ctx.notes),
    };
    const results = [{ element: main, path: data.self.path, report }];
    if (data.emitChrome) {
      results.push({ element: buildNav(document, data), path: '/nav' });
      results.push({ element: buildSidebar(document, data), path: '/sidebar' });
      results.push({ element: buildFooter(document), path: '/footer' });
      // "/" (index) is the migrated TUI Brand Hub homepage (portal 161, import-hub-page.js) since
      // 2026-11-11, so the guideline chrome no longer writes it; only the old document URL redirects.
      results.push({ element: buildRedirect(document, data, data.doc.title), path: `/document/${data.doc.id}` });
    }
    return results;
  },
};

export { rewriteLink };
