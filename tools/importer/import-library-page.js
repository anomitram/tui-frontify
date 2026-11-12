/* global WebImporter */
/* Import script for Frontify library documents (asset libraries), first used for The Mora
 * portal 292 libraries Logotypes (1891), Media (1892), Iconography (1894) and Documents (1908).
 * Source = offline pages from tools/frontify-export/build-library-sources.mjs (JSON payload,
 * local image paths); nothing is fetched from Frontify at import time.
 * Output per library: <pagePath> with template "library" (scripts/library.js) and three sections:
 * 1. Library Search: search box + the filters computable from local data (Type, Orientation)
 * 2. Library Collections (only libraries with curated collections, e.g. Media)
 * 3. Library (<kind>): settings rows (Title, Count, Sort, View All, Row Height, Details, Parts) and
 *    one row per asset: picture | title | type | dimensions | duration or pages | date | size | link
 * Edge Delivery allows 200 images per page: a library with more images (Media) is split; the
 * further assets go to <pagePath>/assets-2, -3 ... (Library block with asset rows only, Robots
 * noindex), listed in the first page's "Parts" row and loaded by the block on scroll. */

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

// Edge Delivery allows 200 images per page: a large library is split into parts of at most
// MAX_IMAGES images (the first page counts its collection collages too)
const MAX_IMAGES = 190;

function assetRow(document, data, x) {
  const pages = x.pageCount ? `${x.pageCount} page${x.pageCount === 1 ? '' : 's'}` : '';
  return [
    picture(document, x.path, x.title),
    x.title,
    x.ext.toUpperCase(),
    x.width && x.height ? `${x.width} × ${x.height} px` : '',
    x.isVideo ? duration(x.duration) : pages,
    (x.created || '').slice(0, 10),
    fileSize(x.fileSizeKb),
    // SVG originals: the file (the block downloads the tile's own image, which survives the
    // content upload); everything else opens the library on Frontify
    x.file ? link(document, x.path, `Download ${x.title}`) : link(document, data.originalUrl, `${x.title} on Frontify`),
  ];
}

/** Assets per page: [first page assets, part 2 assets, ...] */
function splitAssets(data, notes) {
  const assets = data.assets.filter((x) => {
    if (!x.path) notes.push(`no image for asset ${x.id}`);
    return !!x.path;
  });
  const collageImages = data.collections.reduce((n, c) => n + c.images.length, 0);
  const first = Math.max(0, MAX_IMAGES - collageImages);
  const chunks = [assets.slice(0, first)];
  for (let i = first; i < assets.length; i += MAX_IMAGES) chunks.push(assets.slice(i, i + MAX_IMAGES));
  return chunks;
}

const partPath = (data, n) => `${data.pagePath}/assets-${n}`;

function libraryBlock(document, data, assets, partCount) {
  const rows = [['Title', heading(document, data.heading)]];
  // the total when it differs from the cards on this page (document libraries show the first
  // cards of a collection with its total; split libraries); otherwise the block counts its rows
  if (data.totalCount !== assets.length) rows.push(['Count', `${data.totalCount} items`]);
  if (data.viewAll) rows.push(['View All', link(document, data.viewAll, 'View all')]);
  else rows.push(['Sort', data.sortLabel]);
  rows.push(['Row Height', `${data.layout.rowHeight}px`]);
  rows.push(['Details', data.layout.details]);
  if (partCount > 1) {
    const cell = document.createElement('div');
    for (let n = 2; n <= partCount; n += 1) {
      const p = document.createElement('p');
      p.append(link(document, partPath(data, n), partPath(data, n)));
      cell.append(p);
    }
    rows.push(['Parts', cell]);
  }
  assets.forEach((x) => rows.push(assetRow(document, data, x)));
  return block(document, `Library (${data.kind})`, rows);
}

/** A further part: the same Library block with only asset rows (read by the first page). */
function partPage(document, data, assets, n, total) {
  const div = document.createElement('div');
  const rows = [['Row Height', `${data.layout.rowHeight}px`], ['Details', data.layout.details]];
  assets.forEach((x) => rows.push(assetRow(document, data, x)));
  div.append(block(document, `Library (${data.kind})`, rows));
  div.append(WebImporter.Blocks.getMetadataBlock(document, {
    Title: `${data.tabTitle} (assets, part ${n} of ${total})`,
    Robots: 'noindex',
  }));
  return div;
}

export default {
  onLoad: ({ document }) => { payload = null; readPayload(document); },
  transform: ({ document }) => {
    const data = readPayload(document);
    const notes = [];
    const chunks = splitAssets(data, notes);
    const main = document.createElement('div');
    const hr = () => document.createElement('hr');
    main.append(searchBlock(document, data));
    if (data.collections.length) main.append(hr(), collectionsBlock(document, data));
    main.append(hr(), libraryBlock(document, data, chunks[0], chunks.length));
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
    if (chunks.length > 1) notes.push(`split into ${chunks.length} pages (${chunks.map((c) => c.length).join(' + ')} assets)`);
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
    }, ...chunks.slice(1).map((assets, i) => ({
      element: partPage(document, data, assets, i + 2, chunks.length),
      path: partPath(data, i + 2),
      report: { frontifyDocument: data.doc.id, assets: assets.length, notes: 'library part' },
    }))];
  },
};
