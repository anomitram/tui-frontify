/* global WebImporter */
/* Import script for Frontify library documents (asset libraries), first used for The Mora
 * portal 292 libraries Logotypes (1891), Media (1892), Iconography (1894) and Documents (1908).
 * Source = offline pages from tools/frontify-export/build-library-sources.mjs (JSON payload,
 * local image paths); nothing is fetched from Frontify at import time.
 * Output per library: <pagePath> with template "library" (scripts/library.js) and three sections:
 * 1. Library Search: search box + the filters computable from local data (Type, Orientation)
 * 2. Library Collections (only libraries with curated collections, e.g. Media)
 * 3. Library (<kind>): settings rows (Title, Count, Sort, View All, Row Height, Details) and one
 *    row per asset: picture | title | type | dimensions | duration or pages | date | size | link */

let payload = null;
function readPayload(document) {
  if (payload) return payload;
  const el = document.getElementById('frontify-export');
  if (!el) throw new Error('No #frontify-export payload in source page');
  payload = JSON.parse(el.textContent);
  return payload;
}

const pad = (n) => String(n).padStart(2, '0');
/** Frontify: "00:01:30" */
const duration = (s) => (s == null ? '' : `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.round(s % 60))}`);
/** Frontify: file_size in KB; shows "9 KB", "21 MB" (rounded) */
function fileSize(kb) {
  if (kb == null) return '';
  if (kb < 1024) return `${Math.round(kb)} KB`;
  if (kb < 1024 * 1024) return `${Math.round(kb / 1024)} MB`;
  return `${Math.round(kb / 1024 / 1024)} GB`;
}

function picture(document, src, alt) {
  const pic = document.createElement('picture');
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  pic.append(img);
  return pic;
}
function link(document, href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  return a;
}
function heading(document, text) {
  const h = document.createElement('h2');
  h.textContent = text;
  return h;
}
const block = (document, name, cells) => WebImporter.Blocks.createBlock(document, { name, cells });

function searchBlock(document, data) {
  const rows = [['Search', 'Search']];
  data.filters.forEach((f) => {
    if (f.type === 'filetypes') rows.push([f.title, 'Image, Video']);
    if (f.type === 'orientations') rows.push([f.title, 'Landscape, Portrait, Square']);
  });
  return block(document, 'Library Search', rows);
}

function collectionsBlock(document, data) {
  const rows = [['Title', heading(document, data.collectionsHeading?.title || 'Collections')]];
  if (data.collectionsSortLabel) rows.push(['Sort', data.collectionsSortLabel]);
  data.collections.forEach((c) => {
    const pics = document.createElement('div');
    c.images.forEach((src) => pics.append(picture(document, src, '')));
    rows.push([
      pics,
      c.name,
      c.pinned ? 'Featured' : '',
      `${c.count} asset${c.count === 1 ? '' : 's'}`,
      // Frontify opens the collection in the library (no own URL): link the library on Frontify
      link(document, data.originalUrl, `${c.name} on Frontify`),
    ]);
  });
  return block(document, 'Library Collections', rows);
}

function libraryBlock(document, data, notes) {
  const rows = [['Title', heading(document, data.heading)]];
  // the count Frontify shows when it differs from the cards on the page (document libraries show
  // the first cards of a collection with its total); otherwise the block counts its rows
  if (data.totalCount !== data.assets.length) rows.push(['Count', `${data.totalCount} items`]);
  if (data.viewAll) rows.push(['View All', link(document, data.viewAll, 'View all')]);
  else rows.push(['Sort', data.sortLabel]);
  rows.push(['Row Height', `${data.layout.rowHeight}px`]);
  rows.push(['Details', data.layout.details]);
  data.assets.forEach((x) => {
    if (!x.path) { notes.push(`no image for asset ${x.id}`); return; }
    const pages = x.pageCount ? `${x.pageCount} page${x.pageCount === 1 ? '' : 's'}` : '';
    rows.push([
      picture(document, x.path, x.title),
      x.title,
      x.ext.toUpperCase(),
      x.width && x.height ? `${x.width} × ${x.height} px` : '',
      x.isVideo ? duration(x.duration) : pages,
      (x.created || '').slice(0, 10),
      fileSize(x.fileSizeKb),
      // SVG originals are local files (download); everything else opens the library on Frontify
      x.file ? link(document, x.path, `Download ${x.title}`) : link(document, data.originalUrl, `${x.title} on Frontify`),
    ]);
  });
  return block(document, `Library (${data.kind})`, rows);
}

export default {
  onLoad: ({ document }) => { payload = null; readPayload(document); },
  transform: ({ document }) => {
    const data = readPayload(document);
    const notes = [];
    const main = document.createElement('div');
    const hr = () => document.createElement('hr');
    main.append(searchBlock(document, data));
    if (data.collections.length) main.append(hr(), collectionsBlock(document, data));
    main.append(hr(), libraryBlock(document, data, notes));
    const meta = {
      Title: data.tabTitle,
      Template: 'library',
      Theme: data.route,
      Nav: `/${data.route}/nav`,
      Footer: `/${data.route}/footer`,
      // the portal nav's header image belongs to the cover page; library pages have a plain bar
      'Header Image': 'none',
      'Frontify Document': `${data.doc.id} (${data.doc.title})`,
      'Original Url': data.originalUrl,
    };
    if (data.permanentLink) meta['Original Permalink'] = data.permanentLink;
    main.append(WebImporter.Blocks.getMetadataBlock(document, meta));
    if (data.notMigratedFilters.length) notes.push(`filters not migrated: ${data.notMigratedFilters.join(', ')}`);
    if (data.downloadAll) notes.push('"Download all" not migrated');
    if (data.frontifyCount && data.frontifyCount !== `${data.totalCount} items`) {
      notes.push(`Frontify shows "${data.frontifyCount}", the export has ${data.totalCount}`);
    }
    return [{
      element: main,
      path: data.pagePath,
      report: {
        frontifyDocument: data.doc.id,
        originalUrl: data.originalUrl,
        assets: data.assets.length,
        collections: data.collections.length,
        notes: JSON.stringify(notes),
      },
    }];
  },
};
