/* Download the collage thumbnails of a Frontify library's collections (collections.json from
 * export-library.mjs): up to 4 per collection, 200px wide JPEG renditions from the CDN.
 * Files: <contentDir>/assets/<route>/libraries/<lib>/collections/<slug(name)>-<n>.jpg; manifest
 * <libDir>/collages.json {collectionId: {name, asset_count, pinned, images: [path, ...]}}.
 * One request at a time, paused. Usage: node library-collages.mjs <libDir> <contentDir> <route> <lib> */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [libDir, contentDir, route, lib] = process.argv.slice(2);
const slug = (t) => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, 60);
const data = JSON.parse(await readFile(path.join(libDir, 'collections.json'), 'utf8')).data || {};
const out = {};
const dir = path.join(contentDir, 'assets', route, 'libraries', lib, 'collections');
await mkdir(dir, { recursive: true });
for (const c of data.collections || []) {
  const images = [];
  for (const [i, x] of (c.collage || []).slice(0, 4).entries()) {
    const base = (x.preview_url || '').split('?')[0];
    if (!base.startsWith('https://media.ffycdn.net/')) continue;
    const r = await fetch(`${base}?width=200`);
    if (r.status === 401 || r.status === 403) { console.log('STOP', r.status); process.exit(3); }
    if (r.ok) {
      const rel = `assets/${route}/libraries/${lib}/collections/${slug(c.name)}-${i + 1}.jpg`;
      await writeFile(path.join(contentDir, rel), Buffer.from(await r.arrayBuffer()));
      images.push(`/${rel}`);
    }
    await new Promise((res) => { setTimeout(res, 600); });
  }
  out[c.id] = {
    name: c.name, asset_count: c.asset_count, pinned: !!c.pinned, images,
  };
}
await writeFile(path.join(libDir, 'collages.json'), JSON.stringify(out, null, 1));
console.log(lib, 'collections', Object.keys(out).length, 'images', Object.values(out).reduce((n, c) => n + c.images.length, 0));
