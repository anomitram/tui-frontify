/* Upload linked files (videos, PDFs) to Document Authoring at the address the site links to, so
 * the restored file links (scripts/scripts.js fileHref) resolve after preview/publish.
 * Plan: [{local: "/assets/...", target: "/assets/...", size}] from file_upload_plan.py. Each file is
 * read back and compared (size + sha256). One request at a time. Only run when the user asks.
 * Auth is injected by the workspace; never pass tokens.
 * Usage: node upload-files-to-da.mjs <org> <repo> <plan.json> [contentDir=content] */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [org, repo, planFile, contentDir = 'content'] = process.argv.slice(2);
const DA = `https://admin.da.live/source/${org}/${repo}`;
const TYPES = {
  mp4: 'video/mp4', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml',
};
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const plan = JSON.parse(await readFile(planFile, 'utf8'));
const results = [];
let stop = null;
for (const f of plan) {
  const buf = await readFile(path.join(contentDir, decodeURIComponent(f.local)));
  const ext = path.extname(f.target).slice(1).toLowerCase();
  const form = new FormData();
  form.append('data', new Blob([buf], { type: TYPES[ext] || 'application/octet-stream' }), path.basename(f.target));
  const r = await fetch(`${DA}${f.target}`, { method: 'POST', body: form });
  const body = (await r.text()).slice(0, 160);
  await sleep(800);
  const back = r.ok ? await fetch(`${DA}${f.target}`) : null;
  const backBuf = back?.ok ? Buffer.from(await back.arrayBuffer()) : null;
  const match = !!backBuf && backBuf.length === buf.length && sha(backBuf) === sha(buf);
  results.push({ local: f.local, target: f.target, size: buf.length, upload: r.status, readback: back?.status ?? null, match });
  console.log(r.status, back?.status ?? '-', match ? 'MATCH' : 'DIFFERENT', f.target, `${(buf.length / 1e6).toFixed(1)} MB`);
  if (r.status === 401 || r.status === 403 || !r.ok || !match) { stop = `${f.target}: ${r.status} ${body}`; break; }
  await sleep(800);
}
await writeFile(path.join('migration-work', 'preview-publish', `da-upload-files-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
  JSON.stringify({ when: new Date().toISOString(), stop, results }, null, 2));
console.log('uploaded', results.filter((x) => x.match).length, 'of', plan.length);
if (stop) { console.error('STOPPED:', stop); process.exit(3); }
