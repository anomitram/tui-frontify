/* Verify every downloaded asset against its source:
 * re-requests 1 byte from the source to read its ETag + total size, then checks the
 * local file's size and MD5 / S3 multipart ETag. Usage: node verify-assets.mjs <rawDir> <assetsDir> */
import { readFile, writeFile, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import CFG from './config.mjs';

const [rawDir, outDir] = process.argv.slice(2);
const HOST = CFG.host;
const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json')));

// Rebuild fresh source URLs (signed URLs are not stored in the manifest).
const srcByKey = new Map();
for (const f of (await import('node:fs')).readdirSync(path.join(rawDir, 'pages'))) {
  const txt = await readFile(path.join(rawDir, 'pages', f), 'utf8');
  const { page } = JSON.parse(txt);
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (o.file_name && o.file_origin_url && o.id) srcByKey.set(`asset-${o.id}`, o.file_origin_url);
    if (o.filename && o.download_url && o.id && !srcByKey.has(`asset-${o.id}`)) srcByKey.set(`asset-${o.id}`, o.download_url);
    if (o.attachment && o.token && o.block_id) srcByKey.set(`attachment-${o.attachment}`, `${HOST}/api/attachment/download/${o.token}`);
    Object.values(o).forEach(walk);
  }(page));
}

async function probe(url) {
  let u = url;
  for (let i = 0; i < 6; i += 1) {
    const r = await fetch(u, { redirect: 'manual', headers: { Range: 'bytes=0-0' } });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) {
      const next = new URL(loc, u).href;
      if (next.includes(`${CFG.hostname}/auth`)) throw new Error('AUTH redirect');
      u = next; continue;
    }
    if (r.status === 401 || r.status === 403) throw new Error(`AUTH ${r.status}`);
    if (r.status === 405 && new URL(u).host === CFG.hostname) throw new Error('AUTH bot check (405)');
    const cr = r.headers.get('content-range');
    await r.body?.cancel();
    return { status: r.status, etag: (r.headers.get('etag') || '').replace(/"/g, '') || null, total: cr ? Number(cr.split('/')[1]) : Number(r.headers.get('content-length')) || null };
  }
  return { status: 'redirects' };
}

async function multipartEtag(file, partSize) {
  const fh = await open(file);
  const buf = Buffer.alloc(partSize);
  const parts = [];
  for (;;) {
    const { bytesRead } = await fh.read(buf, 0, partSize, null);
    if (!bytesRead) break;
    parts.push(createHash('md5').update(buf.subarray(0, bytesRead)).digest());
    if (bytesRead < partSize) break;
  }
  await fh.close();
  return `${createHash('md5').update(Buffer.concat(parts)).digest('hex')}-${parts.length}`;
}

const MiB = 1024 * 1024;
const PART_SIZES = [5, 8, 10, 15, 16, 20, 25, 32, 50, 64, 100, 128].map((x) => x * MiB);
let n = 0;
// VERIFY_HOSTS=s3 limits probing to file storage (keeps load off the brand hub).
const onlyS3 = process.env.VERIFY_HOSTS === 's3';
const onlyHub = process.env.VERIFY_HOSTS === 'hub';
const isS3 = (m) => (srcByKey.get(m.key) || m.source_url || '').includes('amazonaws.com');
const queue = manifest.filter((m) => m.file && !m.derived
  && (!onlyS3 || isS3(m)) && (!onlyHub || (!isS3(m) && m.checksum_verified !== true)));
console.log('to verify', queue.length);
const CONC = Number(process.env.VERIFY_CONCURRENCY || 6);
const PAUSE = Number(process.env.VERIFY_PAUSE_MS || 0);
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) {
    const m = queue.shift();
    const file = path.join(outDir, m.file);
    const src = srcByKey.get(m.key) || m.source_url;
    try {
      // eslint-disable-next-line no-await-in-loop
      const p = await probe(src);
      m.verify = { status: p.status, source_size: p.total, source_etag: p.etag };
      m.size_verified = p.total ? p.total === m.size : null;
      let ok = null;
      if (p.etag && /^[0-9a-f]{32}$/.test(p.etag)) ok = p.etag === m.md5;
      else if (p.etag && /^[0-9a-f]{32}-\d+$/.test(p.etag)) {
        const nParts = Number(p.etag.split('-')[1]);
        if (nParts === 1) ok = `${createHash('md5').update(Buffer.from(m.md5, 'hex')).digest('hex')}-1` === p.etag;
        else {
          ok = false;
          for (const ps of PART_SIZES.filter((s) => Math.ceil(m.size / s) === nParts)) {
            // eslint-disable-next-line no-await-in-loop
            if (await multipartEtag(file, ps) === p.etag) { ok = true; m.verify.part_size = ps; break; }
          }
        }
      }
      m.checksum_verified = ok;
      m.verify.method = ok === null ? (m.size_verified ? 'size-only (source sends no content hash)' : 'unverifiable') : 'etag-md5';
    } catch (e) {
      m.verify = { error: e.message };
      if (e.message.startsWith('AUTH')) { console.error('AUTH FAILURE verifying', m.source_url); queue.length = 0; }
    }
    n += 1;
    if (n % 25 === 0) console.log('verified', n);
    // eslint-disable-next-line no-await-in-loop
    if (PAUSE) await new Promise((r) => { setTimeout(r, PAUSE); });
  }
}));
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
const done = manifest.filter((m) => m.file);
const tally = (f) => done.reduce((acc, m) => { const k = String(f(m)); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
console.log('checksum', tally((m) => m.checksum_verified), 'size', tally((m) => m.size_verified), 'method', tally((m) => m.verify?.method || m.verify?.error));
