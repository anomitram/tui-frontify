/* Build the offline import source for a Frontify hub (portal home) page. No requests to the source.
 * Writes <srcDir>/<route>.html (captured rendered text + embedded JSON payload), copies images into
 * content/assets/<route>/<descriptive-name>.<ext>, and writes the link map and image names.
 * Image names (Frontify hub images only have random file ids): <hubDir>/image-names.json overrides,
 * then the cell's alt text or heading, the link target's title (raw/titles.json, migrated page
 * titles), the link's hash route, and finally <route>-image-<n>. The name doubles as alt text.
 * Links to migrated targets (migrated-targets.mjs) become local paths; all others stay absolute.
 * Usage: [PAGE_PATH=/index] [ORIGINAL_URL=https://host/] node build-hub-sources.mjs <hubDir> <srcDir> <contentDir> <route>
 *   route = source file name, theme and chrome prefix (/<route>/nav, /<route>/footer);
 *   PAGE_PATH = page path (default /<route>), e.g. /index for the site root. */
import {
  mkdir, readFile, writeFile, copyFile, access, stat,
} from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import CFG from './config.mjs';
import { migratedPath, migratedTitle, normalise } from './migrated-targets.mjs';

const [hubDir, srcDir, contentDir, route] = process.argv.slice(2);
const exists = (f) => access(f).then(() => true, () => false);
const raw = async (f) => JSON.parse(await readFile(path.join(hubDir, 'raw', f), 'utf8'));
const rawOpt = async (f, dflt) => ((await exists(path.join(hubDir, 'raw', f))) ? raw(f) : dflt);
const PAGE_PATH = process.env.PAGE_PATH || `/${route}`;
const ORIGINAL_URL = process.env.ORIGINAL_URL || `${CFG.host}/${route}`;
const SELF = PAGE_PATH === '/index' ? '/' : PAGE_PATH;
const safeName = (n) => n.normalize('NFC').replace(/\s+/g, '-').replace(/[^\w.-]+/g, '_');

const portal = (await raw('portal.json')).data;
const grid = (await raw('grid.json')).rows;
const docNav = await raw('document-navigation.json');
const portalNav = (await raw('portal-navigation.json')).data;
const permalinks = await rawOpt('permalinks.json', []);
const titles = await rawOpt('titles.json', {});
const overridesFile = path.join(hubDir, 'image-names.json');
const overrides = (await exists(overridesFile)) ? JSON.parse(await readFile(overridesFile, 'utf8')) : {};
const manifest = JSON.parse(await readFile(path.join(hubDir, 'assets', 'manifest.json'), 'utf8'));

// rows in display order (by cell sort)
const rows = Object.values(grid).map((r) => ({
  id: r.id, settings: r.settings || {}, cells: Object.entries(r.data || {}).sort((a, b) => (a[1].column || 0) - (b[1].column || 0)).map(([k, c]) => ({ key: k, ...c })),
})).sort((a, b) => Math.min(...a.cells.map((c) => c.sort)) - Math.min(...b.cells.map((c) => c.sort)));

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
    const local = migratedPath(target);
    if (kind === 'hub' && id === portal.id) { rec.status = 'internal (this page)'; rec.migrated = SELF; } else if (local) { rec.status = 'migrated'; rec.migrated = local; }
    if (!rec.title) rec.title = migratedTitle(target) || (kind && titles[`${kind}:${id}`]?.title) || null;
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
  if (n.type === 'cover_page') item.href = SELF;
  else if (n.type === 'document' || n.type === 'library_document') item.href = `${CFG.host}/document/${n.id}`;
  else if (n.url) item.href = n.url.startsWith('/') ? CFG.host + n.url : n.url;
  for (const c of n.children || []) {
    const ct = c.translations?.default || {};
    const href = c.type === 'link_document' ? (c.url?.startsWith('/') ? CFG.host + c.url : c.url) : `${CFG.host}/document/${c.id}`;
    item.children.push({ type: c.type, id: c.id, title: ct.title || ct.name || '', href });
    addLink(href, `header navigation › ${item.title}`, ct.title || '');
  }
  if (item.href && !item.href.startsWith('/')) addLink(item.href, 'header navigation', item.title);
  if (!n.is_hidden_in_navigation) navItems.push(item);
}
const brandHub = portal.brandportal_settings || {};
if (brandHub.url) addLink(brandHub.url.startsWith('/') ? CFG.host + brandHub.url : brandHub.url, 'header tools', brandHub.label);
addLink(`${CFG.host}/dashboard`, 'left rail', 'Back to dashboard');

// custom page footer (portal setting "footer": {markup_, style}; portal 161 has one, 162 doesn't)
let customFooter = null;
try {
  const f = typeof portal.footer === 'string' ? JSON.parse(portal.footer) : portal.footer;
  if (f && f.markup_) {
    customFooter = { markup: f.markup_, style: f.style || '' };
    for (const m of f.markup_.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) addLink(m[1].replace(/\\\//g, '/'), 'page footer', m[2]);
  }
} catch (e) { /* no custom footer */ }

// images: descriptive names (Frontify hub images only carry random file ids)
const slug = (t) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
const GENERIC = /^(home|brand guidelines?|guidelines?|document library|overview|introduction|cover( page)?|about|start now|find out more|go to guidelines|here|find it here|learn more)$/i;
const cleanTitle = (t) => (t || '').replace(/\s+/g, ' ').trim()
  .replace(/\s+(brand\s+)?guidelines?$/i, '').replace(/\s+brand home$/i, '').trim();
const textOf = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|﻿|​/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const headingOf = (html) => {
  const m = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/i.exec(html || '');
  return m ? textOf(m[2]) : '';
};
const hashName = (url) => {
  const m = /#\/([^/?#]+)(?:\/([^/?#]+))?/.exec(normalise(url) || '');
  if (!m) return '';
  const part = (x) => (x || '').replace(/-[cp]?\d+$/, '').replace(/-\d+$/, '').replace(/^-$/, '');
  const a = part(m[1]); const b = part(m[2]);
  if (b && !GENERIC.test(b.replace(/-/g, ' '))) return b.replace(/-/g, ' ');
  return a && !GENERIC.test(a.replace(/-/g, ' ')) ? a.replace(/-/g, ' ') : '';
};
const cellByKey = {};
rows.forEach((r) => r.cells.forEach((c) => { cellByKey[`cell-${c.sort}-${c.key}`] = c; }));
const targetTitle = (url) => {
  if (!url) return '';
  const rec = linkMap[url] || {};
  const t = cleanTitle(rec.title || migratedTitle(url) || '');
  if (t && !GENERIC.test(t)) return t;
  if (rec.migrated === `/${route}` || /\/tuimagiclife$/.test(url)) return 'TUI MAGIC LIFE';
  return hashName(url);
};
const assets = {};
const assetNames = {};
const assetAlts = {};
const imageNames = {};
const used = new Set();
let copied = 0;
let n = 0;
for (const m of manifest) {
  if (!m.file || m.kind === 'font') continue;
  n += 1;
  const ext = path.extname(m.file).toLowerCase();
  const c = cellByKey[m.key];
  const s = c?.settings || {};
  const o = overrides[m.key] || {};
  let label = o.name || s.image_alt || '';
  let source = o.name ? 'checked by hand' : (s.image_alt ? 'alt text' : '');
  if (!label && c) { label = headingOf(s.content) || ''; if (label) source = 'cell heading'; }
  if (!label && c) { label = targetTitle(s.image_link?.url) || targetTitle(s.link?.url); if (label) source = 'link target'; }
  if (!label && m.kind === 'theme-asset') { label = `${portal.title} logo`; source = 'portal logo'; }
  if (!label) { label = `${route} image ${n}`; source = 'fallback (no name in the source)'; }
  let base = slug(label) || `${route}-image-${n}`;
  if (used.has(base)) { let k = 2; while (used.has(`${base}-${k}`)) k += 1; base = `${base}-${k}`; }
  used.add(base);
  const rel = `assets/${route}/${base}${ext}`;
  const dest = path.join(contentDir, rel);
  const src = path.join(hubDir, 'assets', m.file);
  // Frontify shows some cell images cropped: file_url "rect=x,y,w,h&reference_width=R" (in units of
  // the image scaled to width R). Apply the same crop to the published copy (ImageMagick).
  const rectM = /rect=([\d.]+),([\d.]+),([\d.]+),([\d.]+)&reference_width=([\d.]+)/.exec(c?.file_url || '');
  let crop = null;
  if (rectM && m.kind === 'cell-image') {
    const [x, y, w, h, ref] = rectM.slice(1).map(Number);
    const [W, H] = execFileSync('identify', ['-format', '%w %h', `${src}[0]`]).toString().split(' ').map(Number);
    const s = W / ref;
    const full = x < 0.5 && y < 0.5 && Math.abs(x + w - ref) < 0.5 && Math.abs((y + h) * s - H) < 1.5;
    if (!full) crop = [Math.round(w * s), Math.min(H, Math.round(h * s)), Math.round(x * s), Math.round(y * s)];
  }
  if (crop) {
    await mkdir(path.dirname(dest), { recursive: true });
    execFileSync('convert', [src, '-crop', `${crop[0]}x${crop[1]}+${crop[2]}+${crop[3]}`, '+repage', dest]);
    copied += 1;
  } else if (!(await exists(dest)) || (await stat(dest)).size !== m.size) {
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(src, dest);
    copied += 1;
  }
  assets[m.key] = `/${rel}`;
  assetNames[m.key] = m.file_name;
  assetAlts[m.key] = 'alt' in o ? o.alt : label; // "" = decorative
  imageNames[m.key] = {
    path: `/${rel}`, alt: assetAlts[m.key], source, frontify_file: m.file_name, link: s.image_link?.url || s.link?.url || null, crop: crop ? crop.join(",") : null,
  };
}
await writeFile(path.join(hubDir, 'image-names.generated.json'), JSON.stringify(imageNames, null, 1));
const resolveRail = () => migratedPath(`${CFG.host}/dashboard`) || `${CFG.host}/dashboard`;

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
  host: CFG.host, route, pagePath: PAGE_PATH, originalUrl: ORIGINAL_URL, portal: { id: portal.id, title: portal.title, heading: portal.heading, modified: portal.modified, brandHub },
  tabTitle, rows, assets, assetNames, assetAlts, linkMap, navItems, railHref: resolveRail(), customFooter, logoKey: (manifest.find((m) => m.kind === 'theme-asset') || {}).key,
};
await mkdir(srcDir, { recursive: true });
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${tabTitle}</title></head><body>${rendered || '<main></main>'}<script id="frontify-hub-export" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script></body></html>`;
await writeFile(path.join(srcDir, `${route}.html`), html);
await writeFile(path.join(srcDir, 'urls.txt'), `http://localhost:${process.env.SOURCE_PORT || 8098}/${route}.html\n`);
const lm = Object.values(linkMap);
await writeFile(path.join(hubDir, 'link-map.json'), JSON.stringify(lm, null, 2));
await writeFile(path.join(hubDir, 'link-map.csv'), `Old URL,Resolved target,Title,Status,Used in\n${lm.map((l) => [l.source, l.target, l.title || '', l.status, l.used_in.map((u) => u.where).join(' / ')].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')}\n`);
console.log('rows', rows.length, 'cells', rows.reduce((s, r) => s + r.cells.length, 0), 'assets copied', copied, 'links', lm.length);
