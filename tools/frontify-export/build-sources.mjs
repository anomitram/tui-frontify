/* Build offline import sources for document 396 (no requests to the brand hub).
 * For every page: <srcDir>/<cat>/<slug>.html containing
 *   - the captured rendered <main> text (for the import runner's completeness check; media stripped)
 *   - <script id="frontify-export" type="application/json"> with page JSON, nav, colours,
 *     local asset paths and display metadata.
 * Also copies downloaded assets into content/assets/<key>/<file> and writes the URL list
 * plus the redirect map.
 * Usage: node build-sources.mjs <frontifyDir> <srcDir> <contentDir> */
import { mkdir, readFile, writeFile, copyFile, access, stat, rename } from 'node:fs/promises';
import path from 'node:path';

const [fdir, srcDir, contentDir] = process.argv.slice(2);
const raw = (f) => readFile(path.join(fdir, 'raw', f), 'utf8').then(JSON.parse);
const exists = (f) => access(f).then(() => true, () => false);
const HOST = 'https://tui-brandhub.com';

const nav = (await raw('navigation.json')).data;
const doc = (await raw('document.json')).data;
const pagesList = (await raw('pages.json')).data;
const pageMeta = new Map(pagesList.map((p) => [p.id, p]));
const portalNav = (await raw('portal-navigation_112.json')).data;
const manifest = JSON.parse(await readFile(path.join(fdir, 'assets', 'manifest.json')));

// ---- navigation order + new paths ----
const order = [];
const categories = [];
for (const n of nav) {
  const tr = n.translations.default;
  if (n.type === 'page_category') {
    const cat = { id: n.id, title: tr.title, slug: tr.slug, pages: [] };
    categories.push(cat);
    for (const c of n.children || []) {
      if (c.type !== 'page') continue;
      const ct = c.translations.default;
      const pg = {
        id: c.id, title: ct.title, slug: ct.slug, cat: tr.slug, catTitle: tr.title, path: `/${tr.slug}/${ct.slug}`,
        hidden: !!c.is_hidden_in_navigation, published: c.is_published !== false,
        headings: (c.children || []).filter((h) => h.type === 'page_heading').map((h) => ({ id: h.id, title: h.translations.default.title, slug: h.translations.default.slug })),
      };
      cat.pages.push(pg); order.push(pg);
    }
  } else if (n.type === 'page') {
    const pg = {
      id: n.id, title: tr.title, slug: tr.slug, cat: null, catTitle: null, path: `/${tr.slug}`, uncategorized: true,
      hidden: !!n.is_hidden_in_navigation, published: n.is_published !== false,
      headings: (n.children || []).filter((h) => h.type === 'page_heading').map((h) => ({ id: h.id, title: h.translations.default.title, slug: h.translations.default.slug })),
    };
    categories.push({ id: null, title: tr.title, slug: null, pages: [pg], uncategorized: true });
    order.push(pg);
  }
}

// ---- assets: copy into content and build key -> public path map ----
const assetPaths = {};
const assetNames = {};
let copied = 0;
// The local preview cannot serve names with spaces/special characters, so files are published
// under a URL-safe name; the original name is kept as the download name (and in the manifest).
const safeName = (n) => n.normalize('NFC').replace(/\s+/g, '-').replace(/[^\w.\-]+/g, '_');
for (const m of manifest) {
  if (!m.file) continue;
  let fileName = path.basename(m.file);
  if (m.key.startsWith('theme-')) {
    // Frontify CDN names are base64 tokens of the storage path; recover the original file name.
    try {
      const token = m.source_url.split('/').pop().split(':')[0];
      const p = JSON.parse(Buffer.from(token, 'base64').toString()).path;
      fileName = path.basename(p);
      m.file_name = fileName;
    } catch (e) { /* keep */ }
  }
  const rel = `assets/${m.key}/${safeName(fileName)}`;
  const dest = path.join(contentDir, rel);
  const legacy = path.join(contentDir, `assets/${m.key}/${fileName}`);
  if (legacy !== dest && await exists(legacy) && !(await exists(dest))) await rename(legacy, dest);
  if (!m.key.startsWith('font-') && !m.key.startsWith('bfont-')) {
    const srcFile = path.join(fdir, 'assets', m.file);
    if (!(await exists(dest)) || (await stat(dest)).size !== m.size) {
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(srcFile, dest);
      copied += 1;
    }
    assetPaths[m.key] = `/${rel}`;
    assetNames[m.key] = m.file_name || fileName;
  }
}

// ---- permanent links + redirect map ----
const pathById = new Map(order.map((p) => [p.id, p.path]));
const redirects = [];
redirects.push({ from: `${HOST}/document/396`, to: order[0].path, type: 'document root' });
if (doc.permanent_link) redirects.push({ from: HOST + doc.permanent_link, to: order[0].path, type: 'document permanent link' });
const headingPerma = new Map();

// ---- first pass: permanent links of pages + headings ----
const permalinks = {};
if (doc.permanent_link) permalinks[doc.permanent_link] = order[0].path;
for (const pg of order) {
  const pm = pageMeta.get(pg.id) || {};
  if (pm.permanent_link) permalinks[pm.permanent_link] = pg.path;
  const { page } = JSON.parse(await readFile(path.join(fdir, 'raw', 'pages', `${pg.id}.json`), 'utf8'));
  for (const s of page.sections) {
    for (const b of s.content) if (!b.display_name && b.slug && b.permanent_link) permalinks[b.permanent_link] = `${pg.path}#${b.slug}`;
  }
}
// The header shows the CDN rendition of the document logo (same image as the S3 original).
const logo = manifest.find((m) => m.key.startsWith('theme-') && m.source_url.includes('media.ffycdn.net'));
const logoKey = (logo || manifest.find((m) => m.key.startsWith('theme-'))).key;
const portalTitle = (await raw('portal_112_language_en.json')).data?.title || 'TUI MASTER BRAND NEW';

// ---- per-page sources ----
const urls = [];
for (const pg of order) {
  const { page } = JSON.parse(await readFile(path.join(fdir, 'raw', 'pages', `${pg.id}.json`), 'utf8'));
  let tabTitle = null;
  const capDir = path.join(fdir, 'capture', String(pg.id));
  let rendered = '';
  let colors = {};
  let lastModified = null;
  let captured = false;
  if (await exists(path.join(capDir, 'styles.json'))) {
    const st = JSON.parse(await readFile(path.join(capDir, 'styles.json')));
    if (st.title && st.title.includes('TUI Master Brand Home')) {
      captured = true;
      tabTitle = st.title;
      rendered = await readFile(path.join(capDir, 'rendered.html'), 'utf8');
      const lm = /Last modified on ([^<]+)/.exec(rendered);
      lastModified = lm ? lm[1].trim() : null;
      const gql = JSON.parse(await readFile(path.join(capDir, 'graphql.json')));
      for (const g of gql.filter((x) => x.op === 'getColorBlockColors')) {
        const blocks = g.data?.data?.brandEssentialsColorBlocksByIds?.brandEssentialsColorBlocks || [];
        for (const b of blocks) {
          const id = JSON.parse(Buffer.from(b.id, 'base64').toString()).identifier;
          colors[id] = b.colors;
        }
      }
    }
  }
  // Fallbacks when the capture lacks them (verified identical on the 83 pages that have both).
  const hist = page.history?.last_modified_localized;
  if (!lastModified && hist) {
    const m = /^\w+, (\d+)\. (\w+) (\d{4}) (\d{2}):(\d{2})$/.exec(hist);
    const MONTHS = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };
    if (m) {
      const h = Number(m[4]);
      lastModified = `${MONTHS[m[2]]} ${Number(m[1])}, ${m[3]} at ${h % 12 || 12}:${m[5]} ${h < 12 ? 'AM' : 'PM'}`;
    }
  }
  if (!tabTitle || (page.title && !tabTitle.startsWith(page.title.trim()))) {
    tabTitle = page.title ? `${page.title.trim()} - ${doc.title} - ${portalTitle}` : `${doc.title} - ${portalTitle}`;
  }
  const pm = pageMeta.get(pg.id) || {};
  const frontifyUrl = `${HOST}/document/396#${pg.cat ? `/${pg.cat}` : '/-'}/${pg.slug}`;
  redirects.push({ from: frontifyUrl, to: pg.path, type: 'page (hash route)', page_id: pg.id });
  if (pm.permanent_link) redirects.push({ from: HOST + pm.permanent_link, to: pg.path, type: 'page permanent link', page_id: pg.id });
  for (const s of page.sections) {
    for (const b of s.content) {
      if (!b.display_name && b.slug) {
        if (b.permanent_link) {
          redirects.push({ from: HOST + b.permanent_link, to: `${pg.path}#${b.slug}`, type: 'heading permanent link', page_id: pg.id });
          headingPerma.set(b.permanent_link, `${pg.path}#${b.slug}`);
        }
        redirects.push({ from: `${frontifyUrl}#${b.slug}`, to: `${pg.path}#${b.slug}`, type: 'heading anchor', page_id: pg.id });
      }
    }
  }
  const idx = order.indexOf(pg);
  const payload = {
    page, nav: { order: order.map(({ headings, ...o }) => o), categories }, doc: { id: doc.id, title: doc.title, heading: doc.heading },
    colors, assets: assetPaths, assetNames, pathById: Object.fromEntries(pathById), lastModified, captured,
    prev: order[idx - 1] ? { path: order[idx - 1].path, title: order[idx - 1].title, cat: order[idx - 1].catTitle } : null,
    next: order[idx + 1] ? { path: order[idx + 1].path, title: order[idx + 1].title, cat: order[idx + 1].catTitle } : null,
    self: pg, frontifyUrl, permanentLink: pm.permanent_link ? HOST + pm.permanent_link : null, portalNav,
    emitChrome: idx === 0, permalinks, tabTitle, logoKey, portalTitle,
  };
  // Strip media + scripts from rendered markup: only its text is needed, and nothing may load remotely.
  const mainText = rendered
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<(img|video|source|iframe|audio|link)\b[^>]*>/gi, '')
    .replace(/\s(style|srcset|src|poster)="[^"]*"/gi, '');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${pg.title} - ${doc.title}</title></head><body>${mainText || `<main><h1>${pg.title}</h1></main>`}<script id="frontify-export" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script></body></html>`;
  const out = path.join(srcDir, `${pg.path}.html`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, html);
  urls.push(`http://localhost:8099${pg.path}.html`);
}

await writeFile(path.join(srcDir, 'urls.txt'), `${urls.join('\n')}\n`);
await writeFile(path.join(fdir, 'redirect-map.json'), JSON.stringify(redirects, null, 2));
await writeFile(path.join(fdir, 'redirect-map.csv'), `Source,Destination,Type\n${redirects.map((r) => `${r.from},${r.to},${r.type}`).join('\n')}\n`);
await writeFile(path.join(fdir, 'heading-permalinks.json'), JSON.stringify(Object.fromEntries(headingPerma), null, 2));
console.log('pages', order.length, 'assets copied', copied, 'redirects', redirects.length, 'captured', urls.length);
