/* Survey Frontify documents before migrating them: document, navigation and page list per id, one
 * request at a time with a pause. Writes <outDir>/<id>/{document,navigation,pages}.json and prints
 * title, type, page count and navigation tree. Stops (exit 3) on /auth, 401, 403 or 405.
 * Usage: [EXPORT_PAUSE_MS=2000] node survey-documents.mjs <outDir> <docId> [<docId> ...] */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import CFG from './config.mjs';

const [outDir, ...ids] = process.argv.slice(2);
const PAUSE = Number(process.env.EXPORT_PAUSE_MS || 2000);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
async function get(u) {
  const r = await fetch(CFG.host + u, { redirect: 'manual', headers: { accept: 'application/json' } });
  const loc = r.headers.get('location') || '';
  if ([401, 403, 405].includes(r.status) || (r.status >= 300 && r.status < 400 && loc.includes('/auth'))) {
    console.error(`STOP ${r.status}${loc ? ` -> ${loc}` : ''} at ${u}`); process.exit(3);
  }
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return { status: r.status, nonJson: t.slice(0, 200) }; }
}
for (const id of ids) {
  const dir = path.join(outDir, String(id));
  await mkdir(dir, { recursive: true });
  const doc = await get(`/api/document/${id}`); await sleep(PAUSE);
  const nav = await get(`/api/document-navigation/${id}`); await sleep(PAUSE);
  const pages = await get(`/api/document-page?document_id=${id}&language=${CFG.language}`); await sleep(PAUSE);
  await writeFile(path.join(dir, 'document.json'), JSON.stringify(doc, null, 1));
  await writeFile(path.join(dir, 'navigation.json'), JSON.stringify(nav, null, 1));
  await writeFile(path.join(dir, 'pages.json'), JSON.stringify(pages, null, 1));
  const d = doc.data || {};
  console.log(`== ${id} "${d.title}" type=${d.type ?? d.document_type ?? '-'} portal=${d.portal_id} pages=${(pages.data || []).length} layout=${d.layout ?? '-'}`);
  const walk = (items, dep) => (items || []).forEach((n) => {
    const t = n.translations?.default || {};
    console.log(`${'  '.repeat(dep)}${n.type} ${n.id} ${t.title || t.name || ''} [${t.slug || ''}]`);
    if (n.type !== 'page') walk(n.children, dep + 1);
  });
  walk(nav.data, 1);
}
