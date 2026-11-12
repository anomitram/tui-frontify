/* Export the asset list of a Frontify library document (assets search, paged), its curated
 * collections, and (logo libraries) the main logo assets. One request at a time with a pause;
 * stops (exit 3) on /auth, 401, 403 or 405. Signed URLs are stripped before saving.
 * Usage: [EXPORT_PAUSE_MS=2000] node export-library.mjs <outDir> <docId> */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import CFG from './config.mjs';

const [outDir, id] = process.argv.slice(2);
const PAUSE = Number(process.env.EXPORT_PAUSE_MS || 2000);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const strip = (t) => t.replace(/\?X-Amz-[^"\s]*/g, '').replace(/("(?:license_)?token"\s*:\s*)"[^"]*"/g, '$1"[removed]"');
async function get(u) {
  const r = await fetch(CFG.host + u, { redirect: 'manual', headers: { accept: 'application/json' } });
  const loc = r.headers.get('location') || '';
  if ([401, 403, 405].includes(r.status) || (r.status >= 300 && r.status < 400 && loc.includes('/auth'))) {
    console.error(`STOP ${r.status}${loc ? ` -> ${loc}` : ''} at ${u}`); process.exit(3);
  }
  const t = await r.text();
  await sleep(PAUSE);
  try { return JSON.parse(strip(t)); } catch (e) { return { status: r.status, error: true }; }
}
await mkdir(outDir, { recursive: true });
const assets = [];
for (let page = 1; page < 100; page += 1) {
  const d = await get(`/api/assets/search/${id}?limit=100&page=${page}&order=NEWEST`);
  assets.push(...(d.data || []));
  if (!d.hasMore || !(d.data || []).length) break;
}
const curated = await get(`/api/library-document-collection?collection_scope=CURATED&document_id=${id}&page=1&limit=100&sort_by=DEFAULT`);
const doc = await get(`/api/document/${id}`);
let mainLogos = null;
if (/logo/i.test(doc.data?.title || '')) mainLogos = await get(`/api/logo-library-page/${id}/main-logo-assets`);
await writeFile(path.join(outDir, 'assets.json'), JSON.stringify(assets, null, 1));
await writeFile(path.join(outDir, 'collections.json'), JSON.stringify(curated, null, 1));
await writeFile(path.join(outDir, 'document.json'), JSON.stringify(doc, null, 1));
if (mainLogos) await writeFile(path.join(outDir, 'main-logo-assets.json'), JSON.stringify(mainLogos, null, 1));
const bytes = assets.reduce((s, a) => s + (a.file_size || 0), 0);
const exts = {};
assets.forEach((a) => { exts[a.ext] = (exts[a.ext] || 0) + 1; });
console.log(`${id} "${doc.data?.title}" assets ${assets.length} size ${(bytes / 1024).toFixed(0)} MB(?) exts ${JSON.stringify(exts)} collections ${(curated.data || []).length}`);
