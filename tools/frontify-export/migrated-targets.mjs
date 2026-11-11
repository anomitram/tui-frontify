/* Which Frontify targets already exist on the migrated site (frontify.config.json "migrated"):
 * migratedPath(url) returns the local path for a link to a migrated document page, hub or route,
 * or null when the target is not migrated (the link then stays absolute). migratedTitle(url) returns
 * the page title of a migrated document page (used for descriptive image names).
 * Offline: reads only the exported redirect maps and navigation files. */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CFG from './config.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const M = CFG.migrated || { documents: {}, hubs: {}, routes: {} };
const readJson = (f) => (existsSync(path.join(REPO, f)) ? JSON.parse(readFileSync(path.join(REPO, f), 'utf8')) : null);

const docRedirects = {};
const docTitles = {};
for (const [id, d] of Object.entries(M.documents || {})) {
  const map = new Map();
  (readJson(d.redirectMap) || []).forEach((r) => map.set(r.from, r.to));
  docRedirects[id] = map;
  const titles = new Map();
  ((readJson(d.navigation) || {}).data || []).forEach((c) => {
    const ct = c.translations?.default || {};
    const pages = c.type === 'page_category' ? (c.children || []).filter((k) => k.type === 'page') : [c];
    pages.forEach((p) => {
      const pt = p.translations?.default || {};
      const key = c.type === 'page_category' ? `${ct.slug}/${pt.slug}` : `-/${pt.slug}`;
      titles.set(key, { category: c.type === 'page_category' ? ct.title : null, title: pt.title });
    });
  });
  docTitles[id] = titles;
}

/** Normalise a Frontify URL: absolute on the host, no "?" before the hash, no trailing slash. */
export function normalise(url) {
  if (!url) return url;
  let u = url.trim();
  if (u.startsWith('/')) u = CFG.host + u;
  return u.replace(/\?#/, '#').replace(/\?$/, '').replace(/\/(#|$)/, '$1');
}

export function migratedPath(url) {
  const u = normalise(url);
  if (!u || !u.startsWith(CFG.host)) return null;
  const rest = u.slice(CFG.host.length);
  if (rest === '' || rest === '/') return M.root || '/';
  let m = /^\/document\/(\d+)(#.*)?$/.exec(rest);
  if (m && docRedirects[m[1]]) {
    const map = docRedirects[m[1]];
    if (map.has(u)) return map.get(u);
    // Frontify heading links are "#/<cat>/<page>/<heading>"; the map keys them as "#/<cat>/<page>#<heading>"
    const head = /^(#\/[^/]+\/[^/]+)\/([^/#?]+)$/.exec(m[2] || '');
    if (head && map.has(`${CFG.host}/document/${m[1]}${head[1]}#${head[2]}`)) return map.get(`${CFG.host}/document/${m[1]}${head[1]}#${head[2]}`);
    // unknown heading: fall back to its page, then to the document root
    const page = /^(#\/[^/]+\/[^/]+)/.exec(m[2] || '');
    if (page && map.has(`${CFG.host}/document/${m[1]}${page[1]}`)) return map.get(`${CFG.host}/document/${m[1]}${page[1]}`);
    return map.get(`${CFG.host}/document/${m[1]}`) || null;
  }
  m = /^\/hub\/(\d+)(\/[a-z]{2})?$/.exec(rest);
  if (m && M.hubs?.[m[1]]) return M.hubs[m[1]];
  m = /^\/([\w-]+)$/.exec(rest);
  if (m && M.routes?.[m[1]]) return M.routes[m[1]];
  return null;
}

/** Title of a migrated document page ("Category - Page"), or null. */
export function migratedTitle(url) {
  const u = normalise(url);
  const m = /\/document\/(\d+)#\/([^/]+)\/([^/]+)/.exec(u || '');
  if (!m || !docTitles[m[1]]) return null;
  const t = docTitles[m[1]].get(`${m[2]}/${m[3]}`);
  if (!t) return null;
  return t.category && t.category !== t.title ? `${t.category} - ${t.title}` : t.title;
}
