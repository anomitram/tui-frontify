/* Collect + download every asset referenced by the configured Frontify document.
 * Usage: node assets.mjs <rawDir> <assetsDir>
 * Writes <assetsDir>/manifest.json. Never logs signed URLs or tokens. */
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import CFG from './config.mjs';

const HOST = CFG.host;
const [rawDir, outDir] = process.argv.slice(2);
const strip = (u) => (u ? u.split('?')[0] : u);
const abs = (u) => (u && u.startsWith('/') ? HOST + u : u);

const assets = new Map(); // key -> record
function add(key, rec, ref) {
  let a = assets.get(key);
  if (!a) { a = { key, ...rec, refs: [] }; assets.set(key, a); }
  for (const [k, v] of Object.entries(rec)) if (v != null && a[k] == null) a[k] = v;
  if (ref && !a.refs.some((r) => r.page_id === ref.page_id && r.block_id === ref.block_id && r.field === ref.field)) a.refs.push(ref);
}

// ---- page content ----
const pageFiles = (await readdir(path.join(rawDir, 'pages'))).filter((f) => f.endsWith('.json'));
for (const f of pageFiles) {
  const { page } = JSON.parse(await readFile(path.join(rawDir, 'pages', f)));
  for (const s of page.sections) {
    for (const b of s.content) {
      const ref = (field) => ({ page_id: page.id, section_id: s.id, block_id: b.id, block_type: b.display_name || 'heading', field });
      (function walk(o, field) {
        if (Array.isArray(o)) { o.forEach((x) => walk(x, field)); return; }
        if (!o || typeof o !== 'object') return;
        // custom-block asset objects
        if (o.file_name && (o.file_origin_url || o.generic_url) && o.id) {
          add(`asset-${o.id}`, {
            asset_id: o.id, file_name: o.file_name, ext: o.ext, title: o.title, object_type: o.object_type,
            width: o.width, height: o.height, alt: o.alternative_text, declared_size: o.file_size,
            is_download_protected: o.is_download_protected,
            src: o.file_origin_url, src_alt: o.generic_url && o.generic_url.includes('ffycdn') ? o.generic_url.replace('width={width}&', '').replace('?width={width}', '') : null,
            source_url: strip(o.file_origin_url) || strip(o.generic_url),
          }, ref(field));
        }
        // legacy-block asset_data objects
        if (o.filename && o.download_url && o.id) {
          add(`asset-${o.id}`, {
            asset_id: o.id, file_name: o.filename, ext: o.ext, object_type: o.object_type, width: o.width, height: o.height,
            src_download: o.download_url,
            src_alt: o.generic_url && o.generic_url.includes('ffycdn') ? o.generic_url.replace('width={width}&', '').replace('?width={width}', '') : null,
            source_url: strip(o.generic_url),
          }, ref(field));
        }
        // attachments (downloads block)
        if (o.attachment && o.token && o.block_id) {
          add(`attachment-${o.attachment}`, {
            attachment_id: o.attachment, file_name: o.title, ext: o.ext, declared_size: o.size,
            src_download: `${HOST}/api/attachment/download/${o.token}`, source_url: `${HOST}/api/attachment/download/(attachment ${o.attachment})`,
          }, ref('downloads'));
        }
        for (const [k, v] of Object.entries(o)) walk(v, field || k);
      }(b, null));
      // file-type icons used as previews
      const txt = JSON.stringify(b);
      for (const m of txt.matchAll(/https:\/\/tui-brandhub\.com\/api\/file-icon\/([\w.-]+\.svg)/g)) {
        add(`icon-${m[1]}`, { file_name: m[1], ext: 'svg', src: m[0], source_url: m[0] }, ref('preview_url'));
      }
    }
  }
}

// ---- fonts ----
// Guideline (project 540) fonts: take exactly the @font-face sources the hub stylesheet
// declares for this document's project. Brand-essentials fonts come from font-styles.
const PROJECT = String(CFG.projectId);
const sheet = JSON.parse(await readFile(path.join(rawDir, 'stylesheet.json'))).data;
const fontFaces = [];
for (const css of Object.values(sheet)) {
  if (typeof css !== 'string') continue;
  for (const m of css.matchAll(/@font-face\{([^}]*)\}/g)) {
    const body = m[1];
    const family = (/font-family:"?([^";]+)"?/.exec(body) || [])[1];
    const weight = (/font-weight:([^;]+)/.exec(body) || [])[1];
    const style = (/font-style:([^;]+)/.exec(body) || [])[1];
    const srcs = [...body.matchAll(/url\("?(\/api\/font-file\/(\d+)\?format=(\w+)&project_id=(\d+))"?\)/g)];
    if (!srcs.length || srcs[0][4] !== PROJECT) continue;
    fontFaces.push({ family, weight, style, srcs: srcs.map((s) => ({ url: HOST + s[1], id: s[2], format: s[3] })) });
    for (const s of srcs) {
      add(`font-${s[2]}`, {
        font_file_id: s[2], family, weight, style, ext: s[3], file_name: `${family.replace(/[^\w-]+/g, '_')}-${weight}-${style}.${s[3]}`,
        src: HOST + s[1], source_url: HOST + s[1],
      }, { field: 'guideline-stylesheet' });
    }
  }
}
const fontStyles = JSON.parse(await readFile(path.join(rawDir, 'font-styles.json'))).data;
for (const fs of fontStyles) {
  for (const s of fs.sources || []) {
    if (!s.url.includes('/brand-essentials-font-file/')) continue; // others covered above
    const id = s.url.split('/').pop();
    add(`bfont-${id}`, {
      family: fs.font_family_name, weight: fs.font_weight, style: fs.font_style, ext: s.format,
      file_name: `${fs.font_family_name.replace(/[^\w-]+/g, '_')}-${fs.font_weight}-${fs.font_style}.${s.format === 'opentype' ? 'otf' : 'ttf'}`,
      src: abs(s.url), source_url: abs(s.url),
    }, { field: 'portal-font-styles' });
  }
}
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'font-faces.json'), JSON.stringify(fontFaces, null, 2));

// ---- theme images (logo, backgrounds) from document + portal appearance ----
for (const f of ['document.json', 'portal-appearance.json']) {
  const txt = await readFile(path.join(rawDir, f), 'utf8');
  for (const m of txt.matchAll(/https:\/\/(?:cdn-assets-eu\.frontify\.com|media\.ffycdn\.net)\/[^"\s\\]+/g)) {
    const u = m[0].replace(/\?.*$/, '');
    add(`theme-${createHash('md5').update(u).digest('hex').slice(0, 10)}`, { src: u, source_url: u, file_name: null }, { field: f });
  }
}

// ---- page/portal theme assets with real file names (document cover pages, e.g. The Mora):
// template-asset.json (page header background) and theme-asset-documentPage.json (logo, default
// header image). Saved from /api/document-page/<id>/template-asset and
// /api/portal/<id>/theme-asset/documentPage. Signed S3 originals (file_origin_url) when present.
for (const f of ['template-asset.json', 'theme-asset-documentPage.json']) {
  let list = [];
  try { list = JSON.parse(await readFile(path.join(rawDir, f), 'utf8')).data || []; } catch (e) { continue; }
  for (const t of list) {
    const x = t.asset || {};
    const src = x.file_origin_url || (x.generic_url || '').replace(/\?.*$/, '');
    if (!src) continue;
    add(`page-${t.setting_id}-${x.id}`, {
      asset_id: x.id, title: x.title, file_name: x.file_name, ext: x.ext, width: x.width, height: x.height, setting: t.setting_id,
      src, source_url: src.replace(/\?.*$/, ''),
    }, { field: f });
  }
}

// ---- download ----
class AuthError extends Error {}
async function fetchFile(url) {
  let u = url;
  for (let i = 0; i < 6; i += 1) {
    const r = await fetch(u, { redirect: 'manual' });
    const loc = r.headers.get('location');
    if (r.status === 401 || r.status === 403) {
      if (new URL(u).host === CFG.hostname) throw new AuthError(`${r.status}`);
      return { error: r.status };
    }
    if (r.status >= 300 && r.status < 400 && loc) {
      const next = new URL(loc, u).href;
      if (next.includes(`${CFG.hostname}/auth`)) throw new AuthError('redirect to /auth');
      u = next; continue;
    }
    if (!r.ok) return { error: r.status };
    return { res: r, finalHost: new URL(u).host };
  }
  return { error: 'too many redirects' };
}

function filenameFromDisposition(h) {
  if (!h) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(h);
  if (star) return decodeURIComponent(star[1]);
  const m = /filename="?([^";]+)"?/i.exec(h);
  return m ? m[1] : null;
}

const safe = (n) => n.replace(/[/\\\0]/g, '_');
const list = [...assets.values()];
console.log('assets to fetch', list.length);
let done = 0;
const failures = [];

// Resume: reuse files already downloaded by a previous run.
let previous = new Map();
try {
  previous = new Map(JSON.parse(await readFile(path.join(outDir, 'manifest.json'))).filter((m) => m.file).map((m) => [m.key, m]));
} catch (e) { /* first run */ }

// ASSETS_SKIP_EXT=zip,docx,...: file types the site cannot serve (Edge Delivery serves images, svg,
// pdf, mp4) are not downloaded; their blocks link to the Frontify original instead.
const SKIP_EXT = new Set((process.env.ASSETS_SKIP_EXT || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
const checkpoint = () => writeFile(path.join(outDir, 'manifest.partial.json'), JSON.stringify(list.filter((x) => x.file).map(({ src, src_download, src_alt, ...rest }) => rest)));

async function work(a) {
  const ext = String(a.ext || path.extname(a.file_name || '').slice(1)).toLowerCase();
  if (SKIP_EXT.has(ext)) { a.skipped = `type ${ext} not served by the site`; a.optional = true; return; }
  // a crashed run leaves manifest.partial.json (written after every file): resume from it too
  if (!previous.size) {
    try {
      previous = new Map(JSON.parse(await readFile(path.join(outDir, 'manifest.partial.json'))).map((m) => [m.key, m]));
    } catch (e) { previous = new Map([['', null]]); }
  }
  const prev = previous.get(a.key);
  if (prev) {
    try {
      const st = await stat(path.join(outDir, prev.file));
      if (st.size === prev.size) {
        const { refs, ...keep } = prev;
        Object.assign(a, keep, { refs: a.refs });
        return;
      }
    } catch (e) { /* re-download */ }
  }
  const dir = path.join(outDir, a.key);
  const order = [a.src, a.src_download, a.src_alt].filter(Boolean);
  for (const src of order) {
    let r;
    try { r = await fetchFile(src); } catch (e) {
      if (e instanceof AuthError) { a.error = `AUTH ${e.message}`; a.auth_failure = true; failures.push({ key: a.key, url: a.source_url, error: a.error }); return; }
      r = { error: `${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}${e.cause?.message ? `: ${String(e.cause.message).slice(0, 80)}` : ''}` };
    }
    if (r.error) { a.attempts = [...(a.attempts || []), { via: src === a.src ? 'src' : src === a.src_download ? 'download' : 'cdn', error: r.error }]; continue; }
    const cd = filenameFromDisposition(r.res.headers.get('content-disposition'));
    let name = a.file_name || cd;
    if (a.key.startsWith('font-') || a.key.startsWith('bfont-')) name = cd || `${a.key}.${a.ext}`;
    if (a.key.startsWith('theme-')) name = cd || decodeURIComponent(src.split('/').pop()).slice(0, 80).replace(/[^\w.-]/g, '_');
    if (!name) name = `${a.key}.${a.ext || 'bin'}`;
    name = safe(name);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, name);
    const sha = createHash('sha256'); const md5 = createHash('md5');
    const body = Readable.fromWeb(r.res.body);
    body.on('data', (c) => { sha.update(c); md5.update(c); });
    await pipeline(body, createWriteStream(file));
    const st = await stat(file);
    const etag = (r.res.headers.get('etag') || '').replace(/"/g, '');
    const cl = Number(r.res.headers.get('content-length')) || null;
    Object.assign(a, {
      file: path.relative(outDir, file), size: st.size, sha256: sha.digest('hex'), md5: md5.digest('hex'),
      content_type: r.res.headers.get('content-type'), served_filename: cd,
      fetched_via: src === a.src ? 'origin' : src === a.src_download ? 'download-endpoint' : 'cdn-rendition',
      source_etag: etag || null, source_content_length: cl,
    });
    a.checksum_verified = (etag && /^[0-9a-f]{32}$/.test(etag)) ? etag === a.md5 : null;
    a.size_verified = cl ? cl === st.size : null;
    return;
  }
  a.error = 'all sources failed';
  if (!a.optional) failures.push({ key: a.key, url: a.source_url, attempts: a.attempts });
}

const queue = [...list];
// ASSETS_CONCURRENCY=1 + ASSETS_PAUSE_MS for small, rate-safe runs (default 6 parallel, no pause)
const CONC = Number(process.env.ASSETS_CONCURRENCY || 6);
const PAUSE_MS = Number(process.env.ASSETS_PAUSE_MS || 0);
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) {
    const a = queue.shift();
    if (process.env.ASSETS_VERBOSE) console.log('fetch', a.key, a.ext || '', a.declared_size || '');
    // eslint-disable-next-line no-await-in-loop
    await work(a);
    // eslint-disable-next-line no-await-in-loop
    if (a.file && !previous.has(a.key)) await checkpoint();
    // eslint-disable-next-line no-await-in-loop
    if (PAUSE_MS) await new Promise((r) => { setTimeout(r, PAUSE_MS); });
    done += 1;
    if (done % 50 === 0) console.log('progress', done, '/', list.length);
    if (a.auth_failure) { console.error('AUTH FAILURE at', a.source_url); queue.length = 0; }
  }
}));

const manifest = list.map(({ src, src_download, src_alt, ...rest }) => rest);
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
await writeFile(path.join(outDir, 'failures.json'), JSON.stringify(failures, null, 2));
const ok = manifest.filter((m) => m.file);
console.log('downloaded', ok.length, 'of', manifest.length, 'bytes', ok.reduce((s, m) => s + m.size, 0), 'failures', failures.length);
if (failures.some((f) => String(f.error).startsWith('AUTH'))) process.exit(3);
