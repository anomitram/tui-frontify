/* Upload local pages (content/<path>.plain.html, wrapped as DA expects) and their /assets/ media
 * to Document Authoring, one request at a time, then read each back to confirm. Only run when the
 * user asks for an upload. Auth is injected by the workspace; never pass tokens.
 * Usage: node upload-to-da.mjs <org> <repo> <page path> [<page path> ...]   (paths without .html) */
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [org, repo, ...pages] = process.argv.slice(2);
const DA = `https://admin.da.live/source/${org}/${repo}`;
const TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
};
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const tmp = await mkdtemp(path.join(tmpdir(), 'da-upload-'));
const results = [];

async function upload(daPath, buf, type, fileName) {
  const form = new FormData();
  form.append('data', new Blob([buf], { type }), fileName);
  const r = await fetch(`${DA}${daPath}`, { method: 'POST', body: form });
  const text = await r.text();
  return { status: r.status, body: text.slice(0, 200) };
}

const media = new Set();
for (const p of pages) {
  const html = await readFile(path.join('content', `${p}.plain.html`), 'utf8');
  for (const m of html.matchAll(/src="(\/assets\/[^"]+)"/g)) media.add(m[1]);
}
// 1. media (same paths as locally, so the page's relative /assets/ references resolve in DA)
for (const src of media) {
  const buf = await readFile(path.join('content', decodeURIComponent(src)));
  const ext = src.split('.').pop().toLowerCase();
  const res = await upload(src, buf, TYPES[ext] || 'application/octet-stream', path.basename(src));
  await sleep(800);
  const back = await fetch(`${DA}${src}`);
  const backBuf = Buffer.from(await back.arrayBuffer());
  const rec = {
    kind: 'media', path: src, upload: res.status, readback: back.status, match: back.ok && sha(backBuf) === sha(buf), bytes: buf.length,
  };
  results.push(rec);
  console.log('media', rec.upload, rec.readback, rec.match ? 'MATCH' : 'DIFFERENT', src);
  if (!String(res.status).startsWith('2')) { console.log('  ', res.body); break; }
  await sleep(800);
}
// 2. pages (footer/nav before the page that uses them)
const failed = results.some((r) => !String(r.upload).startsWith('2'));
for (const p of failed ? [] : pages) {
  const main = await readFile(path.join('content', `${p}.plain.html`), 'utf8');
  const wrapped = `<body><header></header><main>${main}</main><footer></footer></body>`;
  const file = path.join(tmp, `${p.replace(/\//g, '_')}.html`);
  await writeFile(file, wrapped);
  const res = await upload(`/${p}.html`, Buffer.from(wrapped), 'text/html', path.basename(file));
  await sleep(800);
  const back = await fetch(`${DA}/${p}.html`);
  const backHtml = await back.text();
  const norm = (h) => h.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  const backMain = (/<main>([\s\S]*)<\/main>/.exec(backHtml) || [])[1] || '';
  const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const rec = {
    kind: 'page',
    path: `/${p}`,
    upload: res.status,
    readback: back.status,
    exact: norm(backMain) === norm(main),
    text_match: text(backMain) === text(main),
    imgs_local: (main.match(/<img/g) || []).length,
    imgs_da: (backMain.match(/<img/g) || []).length,
  };
  results.push(rec);
  let verdict = 'DIFFERENT';
  if (rec.exact) verdict = 'EXACT';
  else if (rec.text_match) verdict = 'TEXT MATCH';
  console.log('page', rec.upload, rec.readback, verdict, `/${p}`, `imgs ${rec.imgs_local}/${rec.imgs_da}`);
  if (!String(res.status).startsWith('2')) { console.log('  ', res.body); break; }
  if (!rec.exact) await writeFile(path.join(tmp, `${p.replace(/\//g, '_')}.da-readback.html`), backHtml);
  await sleep(800);
}
const logName = `da-upload-${pages[pages.length - 1].replace(/\//g, '_')}.json`;
const log = { when: new Date().toISOString(), tmp, results };
await writeFile(path.join('migration-work', 'preview-publish', logName), JSON.stringify(log, null, 2));
console.log('readback copies (if any) in', tmp);
