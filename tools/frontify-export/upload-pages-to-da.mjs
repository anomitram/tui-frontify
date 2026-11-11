/* Upload local pages to Document Authoring the way DA stores authored images: every /assets/ image of a
 * page goes into the page's own media folder (".<page>" next to it, e.g. ".index/", "brandhub/.nav/")
 * as <local file name>-<8-char content hash>.<ext>, and the uploaded page references it by its
 * content.da.live URL. This is the same convention the platform's Sync uses, so the names stay
 * descriptive when the local file names are. The local content/<page>.plain.html is not changed
 * (it keeps /assets/ paths); the uploaded copy differs from it only in those image URLs.
 * One request at a time; each upload is read back and compared. Only run when the user asks.
 * Auth is injected by the workspace; never pass tokens.
 * Usage: node upload-pages-to-da.mjs <org> <repo> <page path> [<page path> ...]   (paths without .html) */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [org, repo, ...pages] = process.argv.slice(2);
const DA = `https://admin.da.live/source/${org}/${repo}`;
const CONTENT = `https://content.da.live/${org}/${repo}`;
const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif', webp: 'image/webp',
};
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const results = [];

async function upload(daPath, buf, type, fileName) {
  const form = new FormData();
  form.append('data', new Blob([buf], { type }), fileName);
  const r = await fetch(`${DA}${daPath}`, { method: 'POST', body: form });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}
const ok = (s) => String(s).startsWith('2');
const mediaFolder = (p) => {
  const dir = path.posix.dirname(p);
  return `${dir === '.' ? '' : `${dir}/`}.${path.posix.basename(p)}`;
};

let stop = null;
for (const p of pages) {
  if (stop) break;
  const local = await readFile(path.join('content', `${p}.plain.html`), 'utf8');
  const folder = mediaFolder(p);
  const map = {};
  for (const m of local.matchAll(/src="(\/assets\/[^"]+)"/g)) {
    const src = m[1];
    if (map[src]) continue;
    const buf = await readFile(path.join('content', decodeURIComponent(src)));
    const ext = path.extname(src).slice(1).toLowerCase();
    const name = `${path.basename(src, path.extname(src)).toLowerCase()}-${sha(buf).slice(0, 8)}.${ext}`;
    const daPath = `/${folder}/${name}`;
    const res = await upload(daPath, buf, TYPES[ext] || 'application/octet-stream', name);
    await sleep(700);
    const back = await fetch(`${DA}${daPath}`);
    const match = back.ok && sha(Buffer.from(await back.arrayBuffer())) === sha(buf);
    results.push({
      kind: 'media', page: `/${p}`, local: src, da: daPath, upload: res.status, readback: back.status, match,
    });
    console.log('media', res.status, back.status, match ? 'MATCH' : 'DIFFERENT', daPath);
    if (!ok(res.status) || !match) { stop = `media ${daPath}: ${res.status} ${res.body}`; break; }
    map[src] = `${CONTENT}${daPath}`;
    await sleep(700);
  }
  if (stop) break;
  const main = local.replace(/src="(\/assets\/[^"]+)"/g, (all, src) => `src="${map[src]}"`);
  const wrapped = `<body><header></header><main>${main}</main><footer></footer></body>`;
  const res = await upload(`/${p}.html`, Buffer.from(wrapped), 'text/html', `${path.basename(p)}.html`);
  await sleep(700);
  const back = await fetch(`${DA}/${p}.html`);
  const backMain = (/<main>([\s\S]*)<\/main>/.exec(await back.text()) || [])[1] || '';
  const norm = (h) => h.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const rec = {
    kind: 'page',
    path: `/${p}`,
    upload: res.status,
    readback: back.status,
    exact: norm(backMain) === norm(main),
    text_match: text(backMain) === text(main),
    imgs: (main.match(/<img/g) || []).length,
    imgs_da: (backMain.match(/<img/g) || []).length,
    images_in_page_folder: (backMain.match(new RegExp(`${CONTENT}/${folder.replace(/\./g, '\\.')}/`, 'g')) || []).length,
  };
  results.push(rec);
  console.log('page', res.status, back.status, rec.exact ? 'EXACT' : (rec.text_match ? 'TEXT MATCH' : 'DIFFERENT'), `/${p}`, `imgs ${rec.imgs}/${rec.imgs_da}`);
  if (!ok(res.status)) stop = `page /${p}: ${res.status} ${res.body}`;
  await sleep(700);
}
await writeFile(path.join('migration-work', 'preview-publish', `da-upload-pages-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
  JSON.stringify({ when: new Date().toISOString(), pages, stop, results }, null, 2));
if (stop) { console.error('STOPPED:', stop); process.exit(3); }
