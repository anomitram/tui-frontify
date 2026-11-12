/* Download what a migrated Frontify library page shows: SVG assets as files (the site serves SVG;
 * also used as their download), every other asset as Frontify's 800px JPEG thumbnail (videos and
 * office files included - the CDN renders a preview image). Originals stay on Frontify.
 * Files: <contentDir>/assets/<route>/libraries/<lib>/<slug(title)>.<svg|jpg>; manifest
 * <libDir>/thumbs.json {assetId: {path, title, ext, width, height, file_size, created, kind}}.
 * One request at a time, paused (CDN host only; no brand hub API calls). Resumes.
 * Usage: [PAUSE_MS=600] node library-thumbs.mjs <libDir> <contentDir> <route> <libSlug> */
import {
  mkdir, readFile, writeFile, access,
} from 'node:fs/promises';
import path from 'node:path';

const [libDir, contentDir, route, lib] = process.argv.slice(2);
const PAUSE = Number(process.env.PAUSE_MS || 600);
const exists = (f) => access(f).then(() => true, () => false);
const slug = (t) => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 70)
  .replace(/-+$/, '');

let list = JSON.parse(await readFile(path.join(libDir, 'assets.json'), 'utf8'));
list = Array.isArray(list) ? list : list.data;
if (list[0]?.assets) list = list.flatMap((c) => c.assets); // collection-shaped export (Documents)
const manifestFile = path.join(libDir, 'thumbs.json');
const manifest = (await exists(manifestFile)) ? JSON.parse(await readFile(manifestFile, 'utf8')) : {};
const used = new Set(Object.values(manifest).map((m) => m.path));
const dir = path.join(contentDir, 'assets', route, 'libraries', lib);
await mkdir(dir, { recursive: true });
let n = 0;
let failed = 0;
for (const a of list) {
  if (manifest[a.id] && await exists(path.join(contentDir, manifest[a.id].path))) continue;
  const ext = String(a.ext || '').toLowerCase();
  const isSvg = ext === 'svg';
  const base = (a.generic_url || a.preview_url || '').split('?')[0];
  if (!base.startsWith('https://media.ffycdn.net/')) { console.log('skip (no CDN url)', a.id); failed += 1; continue; }
  const url = isSvg ? base : `${base}?width=800`;
  let name = slug(a.title) || `asset-${a.id}`;
  const outExt = isSvg ? 'svg' : 'jpg';
  if (used.has(`assets/${route}/libraries/${lib}/${name}.${outExt}`)) name = `${name}-${a.id}`;
  const rel = `assets/${route}/libraries/${lib}/${name}.${outExt}`;
  try {
    const r = await fetch(url);
    if (r.status === 401 || r.status === 403) { console.log('STOP', r.status, 'asset', a.id); process.exit(3); }
    if (!r.ok) { console.log('failed', r.status, a.id); failed += 1; continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(path.join(contentDir, rel), buf);
    used.add(rel);
    manifest[a.id] = {
      path: `/${rel}`.replace(/^\//, ''), title: a.title, ext, width: a.width, height: a.height, file_size: a.file_size,
      created: a.created, kind: isSvg ? 'file' : 'thumbnail', is_video: !!a.is_video, duration: a.duration ?? null,
      description: a.description || '', alt: a.computed_alternative_text || '',
    };
    n += 1;
    if (n % 25 === 0) { await writeFile(manifestFile, JSON.stringify(manifest, null, 1)); console.log('progress', n); }
  } catch (e) { console.log('error', a.id, e.message); failed += 1; }
  await new Promise((res) => { setTimeout(res, PAUSE); });
}
await writeFile(manifestFile, JSON.stringify(manifest, null, 1));
console.log(lib, 'downloaded', n, 'total', Object.keys(manifest).length, 'of', list.length, 'failed', failed);
