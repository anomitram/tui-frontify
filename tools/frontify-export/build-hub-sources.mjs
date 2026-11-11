/* Build the offline import source for a Frontify hub (portal home) page. No requests to the source.
 * Writes <srcDir>/<route>.html (captured rendered text + embedded JSON payload), copies assets into
 * content/assets/<key>/<url-safe name>, and writes the link map.
 * Usage: node build-hub-sources.mjs <hubDir> <srcDir> <contentDir> <route> */
import {
  mkdir, readFile, writeFile, copyFile, access, stat,
} from 'node:fs/promises';
import path from 'node:path';
import CFG from './config.mjs';

const [hubDir, srcDir, contentDir, route] = process.argv.slice(2);
const exists = (f) => access(f).then(() => true, () => false);
const raw = async (f) => JSON.parse(await readFile(path.join(hubDir, 'raw', f), 'utf8'));
const safeName = (n) => n.normalize('NFC').replace(/\s+/g, '-').replace(/[^\w.-]+/g, '_');

const portal = (await raw('portal.json')).data;
const grid = (await raw('grid.json')).rows;
const docNav = await raw('document-navigation.json');
const portalNav = (await raw('portal-navigation.json')).data;
const permalinks = await raw('permalinks.json');
const manifest = JSON.parse(await readFile(path.join(hubDir, 'assets', 'manifest.json'), 'utf8'));

// rows in display order (by cell sort)
const rows = Object.values(grid).map((r) => ({
  id: r.id, settings: r.settings || {}, cells: Object.entries(r.data || {}).sort((a, b) => (a[1].column || 0) - (b[1].column || 0)).map(([k, c]) => ({ key: k, ...c })),
})).sort((a, b) => Math.min(...a.cells.map((c) => c.sort)) - Math.min(...b.cells.map((c) => c.sort)));

// assets
const assets = {};
const assetNames = {};
let copied = 0;
for (const m of manifest) {
  if (!m.file || m.kind === 'font') continue;
  const rel = `assets/${m.key}/${safeName(path.basename(m.file))}`;
  const dest = path.join(contentDir, rel);
  const src = path.join(hubDir, 'assets', m.file);
  if (!(await exists(dest)) || (await stat(dest)).size !== m.size) {
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(src, dest);
    copied += 1;
  }
  assets[m.key] = `/${rel}`;
  assetNames[m.key] = m.file_name;
}

// link map: every outgoing link with resolved target and status
const docTitles = Object.fromEntries(Object.values(docNav.items || {}).map((d) => [d.id, d.title]));
const navTitle = (kind, id) => {
  if (kind === 'document') return docTitles[id] || null;
  if (kind === 'hub' && id === portal.id) return portal.title;
  return null;
};
const linkMap = {};
const addLink = (url, where, label) => {
  if (!url) return;
  let rec = linkMap[url];
  if (!rec) {
    let target = url.startsWith('/') ? CFG.host + url : url;
    let kind = null;
    let id = null;
    const pl = permalinks.find((p) => p.link === url);
    if (pl) { target = pl.target; kind = pl.kind; id = pl.id; }
    const m = /\/(document|hub)\/(\d+)/.exec(target || '');
    if (m && !kind) { kind = m[1]; id = Number(m[2]); }
    rec = {
      source: url, target, kind, id, title: navTitle(kind, id), status: 'out of scope (not migrated)', used_in: [],
    };
    if (kind === 'hub' && id === portal.id) { rec.status = 'internal (this page)'; rec.migrated = `/${route}`; }
    linkMap[url] = rec;
  }
  rec.used_in.push({ where, label });
};
rows.forEach((r) => r.cells.forEach((c) => {
  const s = c.settings || {};
  const label = (s.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (s.link?.url) addLink(s.link.url, `row ${r.id} cell ${c.key} (sort ${c.sort}) link`, label);
  if (s.image_link?.url) addLink(s.image_link.url, `row ${r.id} cell ${c.key} (sort ${c.sort}) image link`, label);
  for (const m of (s.content || '').matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) addLink(m[1], `row ${r.id} cell ${c.key} (sort ${c.sort}) text`, m[2].replace(/<[^>]+>|﻿/g, '').trim());
}));
const navItems = [];
for (const n of portalNav) {
  const tr = n.translations?.default || {};
  const item = { type: n.type, id: n.id, title: tr.title || tr.name || '', url: n.url || null, children: [] };
  if (n.type === 'cover_page') item.href = `/${route}`;
  else if (n.type === 'document' || n.type === 'library_document') item.href = `${CFG.host}/document/${n.id}`;
  else if (n.url) item.href = n.url.startsWith('/') ? CFG.host + n.url : n.url;
  for (const c of n.children || []) {
    const ct = c.translations?.default || {};
    const href = c.type === 'link_document' ? (c.url?.startsWith('/') ? CFG.host + c.url : c.url) : `${CFG.host}/document/${c.id}`;
    item.children.push({ type: c.type, id: c.id, title: ct.title || ct.name || '', href });
    addLink(href, `header navigation › ${item.title}`, ct.title || '');
  }
  if (item.href && item.href !== `/${route}`) addLink(item.href, 'header navigation', item.title);
  if (!n.is_hidden_in_navigation) navItems.push(item);
}
const brandHub = portal.brandportal_settings || {};
if (brandHub.url) addLink(brandHub.url, 'header tools', brandHub.label);
addLink(`${CFG.host}/dashboard`, 'left rail', 'Back to dashboard');

// captured page text (for the import runner's completeness check)
let rendered = '';
let tabTitle = `Home - ${portal.title}`;
const cap = path.join(hubDir, 'capture', '1440.html');
if (await exists(cap)) {
  rendered = await readFile(cap, 'utf8');
  const st = JSON.parse(await readFile(path.join(hubDir, 'capture', '1440.styles.json'), 'utf8'));
  tabTitle = st.title || tabTitle;
  const mainM = /<main[\s\S]*?<\/main>/.exec(rendered);
  rendered = (mainM ? mainM[0] : '')
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<(img|video|source|iframe|link)\b[^>]*>/gi, '').replace(/\s(style|srcset|src)="[^"]*"/gi, '')
    // editor-only placeholders (hidden in view mode)
    .replace(/<div class="po-brandportal__blank-slate">[\s\S]*?<\/div><\/div>/, '');
}

const payload = {
  host: CFG.host, route, portal: { id: portal.id, title: portal.title, heading: portal.heading, modified: portal.modified, brandHub },
  tabTitle, rows, assets, assetNames, linkMap, navItems, logoKey: (manifest.find((m) => m.kind === 'theme-asset') || {}).key,
};
await mkdir(srcDir, { recursive: true });
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${tabTitle}</title></head><body>${rendered || '<main></main>'}<script id="frontify-hub-export" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script></body></html>`;
await writeFile(path.join(srcDir, `${route}.html`), html);
await writeFile(path.join(srcDir, 'urls.txt'), `http://localhost:8098/${route}.html\n`);
const lm = Object.values(linkMap);
await writeFile(path.join(hubDir, 'link-map.json'), JSON.stringify(lm, null, 2));
await writeFile(path.join(hubDir, 'link-map.csv'), `Old URL,Resolved target,Title,Status,Used in\n${lm.map((l) => [l.source, l.target, l.title || '', l.status, l.used_in.map((u) => u.where).join(' / ')].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')}\n`);
console.log('rows', rows.length, 'cells', rows.reduce((s, r) => s + r.cells.length, 0), 'assets copied', copied, 'links', lm.length);
