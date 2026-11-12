/* Build the offline import sources for Frontify library documents (asset libraries: logos,
 * media, icons, documents), first used for The Mora portal 292 libraries Logotypes (1891),
 * Media (1892), Iconography (1894) and Documents (1908). No requests to the source.
 * Input per library <base>/<id>/:
 *   library/assets.json      asset list in Frontify order ("Date added", newest first);
 *                            document libraries: [{ name, assets, assetsTotalCount }] (collection)
 *   library/thumbs.json      asset id -> local file (SVG original or 800px JPEG thumbnail) under
 *                            <contentDir>/assets/<route>/libraries/<lib>/ (library-thumbs.mjs)
 *   library/document.json    the library document (title, mode, permanent link, facets)
 *   library/collections.json + collages.json  curated collections and their local collage images
 *   capture/1440.html        reference capture: tab title, counts, sort label, library settings
 *                            (row height, spacing, details visibility)
 * Writes <srcDir>/<slug>.html (rendered text of the capture + JSON payload in
 * <script id="frontify-export">) and tools/importer/urls-library-<route>.txt.
 * Usage: [SOURCE_PORT=8094] node build-library-sources.mjs <base> <srcDir> <route> <urlFile>
 *          <docId>=<pagePath> [...]
 *   e.g. ... migration-work/frontify-mora migration-work/frontify-mora/library-source-pages
 *          the-mora tools/importer/urls-library-the-mora.txt
 *          1891=/the-mora/libraries/logotypes 1892=/the-mora/libraries/media
 *          1894=/the-mora/libraries/iconography 1908=/the-mora/libraries/documents */
import {
  mkdir, readFile, writeFile, access,
} from 'node:fs/promises';
import path from 'node:path';
import CFG from './config.mjs'; // eslint-disable-line import/extensions

const [base, srcDir, route, urlFile, ...libArgs] = process.argv.slice(2);
const PORT = process.env.SOURCE_PORT || 8094;
const HOST = CFG.host;
const exists = (f) => access(f).then(() => true, () => false);
const readJson = async (f, dflt) => {
  if (!(await exists(f))) { if (dflt !== undefined) return dflt; throw new Error(`missing ${f}`); }
  return JSON.parse(await readFile(f, 'utf8'));
};
const unescape = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');
const KIND = {
  LOGOLIBRARY: 'logos', ICONLIBRARY: 'icons', MEDIALIBRARY: 'media', DOCUMENTLIBRARY: 'documents',
};
// facets Frontify shows that can be computed from the exported asset data
const COMPUTABLE = new Set(['filetypes', 'orientations']);

const sources = [];
const report = [];
for (const arg of libArgs) {
  const [id, pagePath] = arg.split('=');
  const dir = path.join(base, id);
  const lib = path.join(dir, 'library');
  const doc = (await readJson(path.join(lib, 'document.json'))).data;
  const kind = KIND[doc.mode] || 'media';
  const rawAssets = await readJson(path.join(lib, 'assets.json'));
  const thumbs = await readJson(path.join(lib, 'thumbs.json'));
  // document libraries list one collection ("Documents": first assets + total count)
  const group = kind === 'documents' && rawAssets[0]?.assets ? rawAssets[0] : null;
  const list = group ? group.assets : rawAssets;

  // ---- capture: title, counts, labels, settings ----
  const cap = await readFile(path.join(dir, 'capture', '1440.html'), 'utf8');
  const tabTitle = unescape((/<title>([^<]*)<\/title>/.exec(cap) || [])[1] || `${doc.title} - The Mora brand home`).trim();
  const settingsM = /data-library-document-settings="([^"]*)"/.exec(cap);
  const settings = settingsM ? JSON.parse(unescape(settingsM[1])) : {};
  const a = settings.assets || {};
  const px = (v, d) => (Number.parseFloat(v) || d);
  const headings = [...cap.matchAll(/<h2[^>]*>([^<]+)<\/h2><span data-test-id="list-header-badge"[^>]*>([^<]+)<\/span>/g)]
    .map((m) => ({ title: unescape(m[1]).trim(), count: unescape(m[2]).trim() }));
  const sortLabels = [...cap.matchAll(/data-test-id="sort-input-trigger-label">([^<]+)</g)].map((m) => unescape(m[1]).trim());
  const assetsHeading = headings.find((h) => h.title !== 'Collections') || { title: 'Assets', count: '' };
  const facets = (doc.settings?.facettes || []).slice().sort((x, y) => (x.column - y.column) || (x.order - y.order));
  // Frontify's pill order is the order of the facet pills in the capture
  const pillOrder = [...cap.matchAll(/data-test-id="facets-pills-groups" data-key="([^"]+)"/g)].map((m) => m[1]);
  facets.sort((x, y) => pillOrder.indexOf(x.key) - pillOrder.indexOf(y.key));

  // ---- assets ----
  const missing = [];
  const assets = list.map((x) => {
    const t = thumbs[String(x.id)];
    if (!t) missing.push(x.id);
    return {
      id: x.id,
      title: x.title,
      ext: String(x.ext || '').toLowerCase(),
      width: x.width,
      height: x.height,
      fileSizeKb: x.file_size,
      created: x.created,
      isVideo: !!x.is_video,
      duration: x.duration ?? x.video_duration ?? null,
      pageCount: x.page_count ?? null,
      description: x.description || '',
      path: t ? `/${t.path.replace(/^\/+/, '')}` : null,
      file: t?.kind === 'file', // the file itself (SVG), not a thumbnail
    };
  });

  // ---- collections (media) ----
  const cols = (await readJson(path.join(lib, 'collections.json'), { data: { collections: [] } })).data?.collections || [];
  const collages = await readJson(path.join(lib, 'collages.json'), {});
  const collections = cols.map((c) => ({
    id: c.id,
    name: c.name,
    count: c.asset_count,
    pinned: !!c.pinned,
    images: (collages[String(c.id)]?.images || []).map((p) => (p.startsWith('/') ? p : `/${p}`)),
  }));

  // ---- rendered text of the capture (no attributes: tokens and signed URLs stay out) ----
  const mainM = /<main[\s\S]*?<\/main>/.exec(cap);
  const rendered = (mainM ? mainM[0] : '<main></main>').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<(img|video|source|iframe|link|audio|input)\b[^>]*>/gi, '')
    .replace(/<([a-z][\w-]*)\s[^>]*>/gi, '<$1>');

  const originalUrl = `${HOST}/document/${doc.id}`;
  const payload = {
    host: HOST,
    route,
    pagePath,
    originalUrl,
    permanentLink: doc.permanent_link ? HOST + doc.permanent_link : null,
    doc: {
      id: doc.id, title: doc.title, mode: doc.mode, background: doc.appearance?.background?.color || null,
    },
    kind,
    tabTitle,
    layout: {
      rowHeight: px(a.assetMaximumCardHeight, 220),
      spacing: px(a.assetSpacing, 8),
      details: a.assetDetailsVisibility || 'hover',
      fit: a.assetFit || 'contain',
    },
    heading: assetsHeading.title,
    // Frontify's own count (document libraries: the collection total, more than the cards shown)
    frontifyCount: assetsHeading.count,
    totalCount: group ? group.assetsTotalCount : assets.length,
    sortLabel: sortLabels[sortLabels.length - 1] || 'Date added',
    collectionsHeading: headings.find((h) => h.title === 'Collections') || null,
    collectionsSortLabel: sortLabels.length > 1 ? sortLabels[0] : null,
    // "View all" of a document library opens Frontify's full collection view (not migrated)
    viewAll: group ? originalUrl : null,
    search: true,
    filters: facets.filter((f) => COMPUTABLE.has(f.type)).map((f) => ({ title: f.title, type: f.type })),
    notMigratedFilters: facets.filter((f) => !COMPUTABLE.has(f.type)).map((f) => f.title),
    downloadAll: /data-test-id="[^"]*download-all[^"]*"|>Download all</.test(cap),
    assets,
    collections,
  };
  const file = `${pagePath.split('/').pop()}.html`;
  await mkdir(srcDir, { recursive: true });
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const title = tabTitle.replace(/</g, '&lt;');
  await writeFile(path.join(srcDir, file), `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>`
    + `<body>${rendered}<script id="frontify-export" type="application/json">${json}</script></body></html>`);
  sources.push(`http://localhost:${PORT}/${file}`);
  report.push({
    doc: doc.id,
    path: pagePath,
    kind,
    assets: assets.length,
    frontifyCount: assetsHeading.count,
    collections: collections.length,
    missingThumbs: missing.length,
    filters: payload.filters.map((f) => f.title).join('/'),
    notMigratedFilters: payload.notMigratedFilters.join('/'),
  });
}
await writeFile(urlFile, `${sources.join('\n')}\n`);
console.table(report);
