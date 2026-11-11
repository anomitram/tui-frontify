/* Export a Frontify document (default: TUI Brand Hub document 396, see frontify.config.json) as raw JSON.
 * Usage: node tools/frontify-export/export.mjs <outDir>
 * Stops on any auth redirect / 401 / 403. Never logs credentials. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import CFG from './config.mjs';

const HOST = CFG.host;
const DOC = CFG.documentId;
const PORTAL = CFG.portalId;
const LANG = CFG.language;
const out = process.argv[2];
if (!out) throw new Error('outDir required');

class AuthError extends Error {}

async function get(url) {
  const r = await fetch(HOST + url, { redirect: 'manual', headers: { accept: 'application/json' } });
  const loc = r.headers.get('location') || '';
  if (r.status === 401 || r.status === 403 || r.status === 405 || (r.status >= 300 && r.status < 400 && loc.includes('/auth'))) {
    throw new AuthError(`AUTH FAILURE ${r.status} at ${url}`);
  }
  if (!r.ok) return { status: r.status, error: true, url };
  return r.json();
}

async function save(name, data) {
  const f = path.join(out, name);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(data, null, 2));
}

const endpoints = {
  'document.json': `/api/document/${DOC}`,
  'navigation.json': `/api/document-navigation/${DOC}`,
  'pages.json': `/api/document-page?document_id=${DOC}&language=${LANG}`,
  'stylesheet.json': `/api/guideline-stylesheets/document/${DOC}?language=${LANG}`,
  'portal-appearance.json': `/api/portal/${PORTAL}/appearance`,
  'font-families.json': `/api/portal/${PORTAL}/font-families`,
  'font-styles.json': `/api/portal/${PORTAL}/font-styles`,
  'portal-navigation.json': `/api/portal-navigation/${PORTAL}`,
  'portal.json': `/api/portal/${PORTAL}?language=${LANG}`,
  'portal-footer.json': `/api/portal/${PORTAL}/footer`,
};

try {
  for (const [name, url] of Object.entries(endpoints)) {
    const d = await get(url);
    await save(name, d);
    console.log('saved', name, d.error ? `ERROR ${d.status}` : '');
  }
  const pagesList = (await import(path.resolve(out, 'pages.json'), { with: { type: 'json' } })).default;
  const pages = pagesList.data || pagesList;
  const failures = [];
  for (const p of pages) {
    const d = await get(`/api/document/page/-/${p.id}`);
    // one request at a time with a pause: bursts trigger the site's bot check (HTTP 405)
    await new Promise((r) => { setTimeout(r, Number(process.env.EXPORT_PAUSE_MS || 1000)); });
    if (d.error) failures.push(d);
    await save(`pages/${p.id}.json`, d);
  }
  await save('page-failures.json', failures);
  console.log('pages', pages.length, 'failures', failures.length);
} catch (e) {
  if (e instanceof AuthError) { console.error(e.message); process.exit(3); }
  throw e;
}
