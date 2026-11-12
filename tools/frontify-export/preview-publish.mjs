/* Preview (and optionally publish) a list of paths on Edge Delivery through the admin API, one at a
 * time, then fetch each from the preview host to confirm it is served. Writes
 * migration-work/preview-publish/pp-<time>.json. Only run when the user asks for preview/publish.
 * Auth is injected by the workspace; never pass tokens. Stops on 401/403.
 * Usage: [PUBLISH=1] node preview-publish.mjs <org> <site> <ref> <pathsFile|path> [...]  (paths as served, e.g. /a/b or /assets/x.pdf) */
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const [org, site, ref, ...args] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const paths = [];
for (const a of args) {
  if (await access(a).then(() => true, () => false)) paths.push(...(await readFile(a, 'utf8')).split('\n').map((x) => x.trim()).filter(Boolean));
  else paths.push(a);
}
const ADMIN = 'https://admin.hlx.page';
const HOST = `https://${ref}--${site}--${org}.aem.page`;
const results = [];
let stop = null;
async function op(kind, p) {
  const r = await fetch(`${ADMIN}/${kind}/${org}/${site}/${ref}${p}`, { method: 'POST' });
  return { status: r.status, error: r.headers.get('x-error') || '' };
}
for (const p of paths) {
  const rec = { path: p };
  rec.preview = await op('preview', p);
  await sleep(600);
  if (rec.preview.status === 401 || rec.preview.status === 403) { stop = `preview ${p}: ${rec.preview.status} ${rec.preview.error}`; results.push(rec); break; }
  if (process.env.PUBLISH && rec.preview.status === 200) {
    rec.live = await op('live', p);
    await sleep(600);
    if (rec.live.status === 401 || rec.live.status === 403) { stop = `live ${p}: ${rec.live.status} ${rec.live.error}`; results.push(rec); break; }
  }
  const served = await fetch(`${HOST}${p}`, { method: 'GET' });
  rec.served = { status: served.status, type: served.headers.get('content-type') };
  await served.arrayBuffer().catch(() => {});
  results.push(rec);
  console.log(rec.preview.status, rec.live ? rec.live.status : '-', rec.served.status, rec.served.type, p, rec.preview.error || rec.live?.error || '');
  await sleep(400);
}
await writeFile(path.join('migration-work', 'preview-publish', `pp-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
  JSON.stringify({ when: new Date().toISOString(), ref, publish: !!process.env.PUBLISH, stop, results }, null, 2));
const failed = results.filter((r) => r.preview.status !== 200 || (r.live && r.live.status !== 200) || r.served.status !== 200);
console.log('done', results.length, 'failed', failed.length);
if (stop) { console.error('STOPPED:', stop); process.exit(3); }
