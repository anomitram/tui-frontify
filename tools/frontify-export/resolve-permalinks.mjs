/* Resolve Frontify /r/<token> permanent links to their targets via the app's own endpoint
 * GET /api/permanent-link/<token> -> { data: { url } }. (/r/<token> itself returns the SPA shell.)
 * Also records the target's title from /api/document/<id> or /api/portal/<id> unless SKIP_TITLES=1
 * (document 758 answers 403 to this login; titles can come from the portal navigation export instead).
 * One request at a time; stops on /auth, 401/403, 405.
 * Usage: node resolve-permalinks.mjs <out.json> /r/<token> [/r/<token> ...] */
import { writeFile } from 'node:fs/promises';
import CFG from './config.mjs';

const [out, ...links] = process.argv.slice(2);
const PAUSE = Number(process.env.EXPORT_PAUSE_MS || 2000);
const sleep = (ms) => new Promise((x) => { setTimeout(x, ms); });
const titles = new Map();

async function getJson(path) {
  const r = await fetch(CFG.host + path, { redirect: 'manual', headers: { accept: 'application/json' } });
  const loc = r.headers.get('location') || '';
  if (r.status === 401 || r.status === 403 || r.status === 405 || loc.includes('/auth')) {
    const e = new Error(`STOP ${r.status} ${loc} at ${path}`); e.stop = true; throw e;
  }
  return { status: r.status, json: r.ok ? await r.json().catch(() => null) : null };
}

const res = [];
try {
  for (const l of links) {
    const token = l.replace(/^\/r\//, '');
    const { status, json } = await getJson(`/api/permanent-link/${token}`);
    const url = json?.data?.url || null;
    const m = url && /^\/(document|hub)\/(\d+)/.exec(url);
    const rec = { link: l, status, target: url ? CFG.host + url : null, kind: m ? m[1] : null, id: m ? Number(m[2]) : null, hash: url && url.includes('#') ? url.slice(url.indexOf('#')) : null };
    await sleep(PAUSE);
    if (m && !process.env.SKIP_TITLES) {
      const key = `${m[1]}-${m[2]}`;
      if (!titles.has(key)) {
        const t = await getJson(m[1] === 'document' ? `/api/document/${m[2]}` : `/api/portal/${m[2]}`);
        titles.set(key, t.json?.data?.title || null);
        await sleep(PAUSE);
      }
      rec.title = titles.get(key);
    }
    res.push(rec);
    console.log(status, l.slice(0, 24), '->', url, rec.title ? `(${rec.title})` : '');
  }
} catch (e) {
  if (!e.stop) throw e;
  console.error(e.message);
  res.push({ stopped: e.message });
}
await writeFile(out, JSON.stringify(res, null, 2));
