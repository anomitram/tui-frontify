/* Download every asset of a Frontify hub (portal home) page with a manifest.
 * Cell images: original via settings.image.image (cdn-assets-eu S3 proxy) without width param.
 * Logo: theme-asset/cover logoAsset (S3 original, real file name). Fonts: @font-face sources in the
 * portal stylesheet for the given project ids. Sequential with pauses; stops on /auth, 401/403, 405.
 * Usage: HUB_FONT_PROJECTS=1516,1650 node assets-hub.mjs <rawDir> <assetsDir> */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import CFG from './config.mjs';

const [rawDir, outDir] = process.argv.slice(2);
const PAUSE = Number(process.env.EXPORT_PAUSE_MS || 1500);
const FONT_PROJECTS = (process.env.HUB_FONT_PROJECTS || '').split(',').filter(Boolean);
const raw = async (f) => JSON.parse(await readFile(path.join(rawDir, f), 'utf8'));
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const strip = (u) => (u ? u.split('?')[0] : u);
const tokenName = (u) => {
  // cdn-assets-eu/s3/<bucket>/<base64 {"path":...}>:<sig> -> original stored file name
  try { const t = u.split('/').pop().split(':')[0]; return path.basename(JSON.parse(Buffer.from(t, 'base64').toString()).path); } catch (e) { return null; }
};

const items = [];
const grid = (await raw('grid.json')).rows;
for (const row of Object.values(grid)) {
  for (const [cellKey, c] of Object.entries(row.data || {})) {
    const img = c.settings?.image;
    if (img && typeof img === 'object' && img.image && !String(img.image).includes('placeholder')) {
      const name = tokenName(img.image) || path.basename(strip(c.file_url || img.image));
      items.push({
        key: `cell-${c.sort}-${cellKey}`, kind: 'cell-image', row_id: row.id, cell: cellKey, sort: c.sort, teaser: c.teaser,
        file_id: img.file_id, file_name: name, src: img.image.replace(/\?width=\{width\}$/, '').replace('?width={width}', ''),
        source_url: strip(img.image), cdn_url: strip(c.file_url),
      });
    } else if (c.file_url) {
      // Some cells only carry the CDN rendition URL (no S3 origin link in the hub data).
      items.push({
        key: `cell-${c.sort}-${cellKey}`, kind: 'cell-image', row_id: row.id, cell: cellKey, sort: c.sort, teaser: c.teaser,
        file_id: img && img.file_id, file_name: path.basename(strip(c.file_url)), src: strip(c.file_url),
        source_url: strip(c.file_url), fetched_via: 'cdn (no origin link in hub data)',
      });
    } else if (img && img.file_id) {
      items.push({ key: `cell-${c.sort}-${cellKey}`, kind: 'cell-image', row_id: row.id, cell: cellKey, sort: c.sort, file_id: img.file_id, note: 'image id without file URL in hub data; not rendered by Frontify' });
    }
  }
}
for (const a of (await raw('theme-asset-cover.json')).data || []) {
  const x = a.asset || {};
  items.push({
    key: `theme-${a.setting_id}-${x.id}`, kind: 'theme-asset', setting: a.setting_id, asset_id: x.id, file_id: x.file_id,
    file_name: x.file_name, src: x.file_origin_url || strip(x.generic_url), source_url: strip(x.file_origin_url || x.generic_url),
    declared_size_kb: x.file_size, width: x.width, height: x.height,
  });
}
const sheet = (await raw('stylesheet.json')).data.hub || '';
const faces = [];
for (const m of sheet.matchAll(/@font-face\{([^}]*)\}/g)) {
  const b = m[1];
  const srcs = [...b.matchAll(/\/api\/font-file\/(\d+)\?format=(\w+)&project_id=(\d+)/g)];
  if (!srcs.length || !FONT_PROJECTS.includes(srcs[0][3])) continue;
  const family = (/font-family:"?([^";]+)"?/.exec(b) || [])[1];
  const weight = (/font-weight:([^;]+)/.exec(b) || [])[1] || 'normal';
  const style = (/font-style:([^;]+)/.exec(b) || [])[1] || 'normal';
  faces.push({ family, weight, style, project: srcs[0][3], srcs: srcs.map((s) => ({ id: s[1], format: s[2] })) });
  for (const s of srcs) {
    items.push({
      key: `font-${s[1]}`, kind: 'font', family, weight, style, project_id: s[3], format: s[2],
      file_name: `${family.replace(/[^\w-]+/g, '_')}-${weight}-${style}.${s[2]}`, src: `${CFG.host}/api/font-file/${s[1]}?format=${s[2]}&project_id=${s[3]}`,
      source_url: `${CFG.host}/api/font-file/${s[1]}?format=${s[2]}&project_id=${s[3]}`,
    });
  }
}

let prev = new Map();
try { prev = new Map(JSON.parse(await readFile(path.join(outDir, 'manifest.json'))).filter((m) => m.sha256).map((m) => [m.key, m])); } catch (e) { /* first run */ }
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'font-faces.json'), JSON.stringify(faces, null, 2));
const manifest = [];
let stopped = null;
for (const it of items) {
  if (prev.has(it.key)) { manifest.push({ ...prev.get(it.key) }); continue; }
  if (!it.src) { manifest.push({ ...it }); continue; }
  if (stopped) { manifest.push({ ...it, src: undefined, error: 'not attempted (stopped)' }); continue; }
  let u = it.src;
  let res = null;
  for (let hop = 0; hop < 6; hop += 1) {
    const r = await fetch(u, { redirect: 'manual' });
    const loc = r.headers.get('location');
    const onHost = new URL(u).hostname === CFG.hostname;
    if (onHost && (r.status === 401 || r.status === 403 || r.status === 405 || (loc && loc.includes('/auth')))) { stopped = `STOP ${r.status} at ${strip(u)}`; break; }
    if (r.status >= 300 && r.status < 400 && loc) { u = new URL(loc, u).href; continue; }
    res = r; break;
  }
  if (stopped) { console.error(stopped); manifest.push({ ...it, src: undefined, error: stopped }); continue; }
  if (!res || !res.ok) { manifest.push({ ...it, src: undefined, error: `HTTP ${res ? res.status : 'none'}` }); console.log('FAIL', it.key, res && res.status); await sleep(PAUSE); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = path.join(outDir, it.key);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, it.file_name), buf);
  const etag = (res.headers.get('etag') || '').replace(/"/g, '') || null;
  const md5 = createHash('md5').update(buf).digest('hex');
  const cl = Number(res.headers.get('content-length')) || null;
  let checksum = null;
  if (etag && /^[0-9a-f]{32}$/.test(etag)) checksum = etag === md5;
  else if (etag && /^[0-9a-f]{32}-1$/.test(etag)) checksum = `${createHash('md5').update(Buffer.from(md5, 'hex')).digest('hex')}-1` === etag;
  manifest.push({
    ...it, src: undefined, file: `${it.key}/${it.file_name}`, size: buf.length, sha256: createHash('sha256').update(buf).digest('hex'), md5,
    content_type: res.headers.get('content-type'), source_etag: etag, source_content_length: cl,
    checksum_verified: checksum, size_verified: cl ? cl === buf.length : null,
  });
  console.log('ok', it.key, buf.length, checksum === true ? 'etag-md5 ok' : (cl ? `size ${cl === buf.length ? 'ok' : 'MISMATCH'}` : 'no checksum'));
  await sleep(PAUSE);
}
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
const ok = manifest.filter((m) => m.sha256);
console.log('downloaded', ok.length, 'of', manifest.length, 'bytes', ok.reduce((s, m) => s + m.size, 0), stopped || '');
if (stopped) process.exit(3);
