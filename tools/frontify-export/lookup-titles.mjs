/* Look up the titles of Frontify link targets (documents via /api/document/<id>, hubs via
 * /api/portal/<id>), one request at a time with a pause. Used for link-map titles and for
 * descriptive image names / alt texts of image-only hub cells. Results are merged into <out.json>
 * so a re-run only asks for missing ids. Stops (exit 3) on /auth, 401, 403 or 405 and reports the URL.
 * Usage: node lookup-titles.mjs <out.json> document:114 hub:177 ... */
import { readFile, writeFile } from 'node:fs/promises';
import CFG from './config.mjs';

const [out, ...targets] = process.argv.slice(2);
const PAUSE = Number(process.env.EXPORT_PAUSE_MS || 2000);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
let titles = {};
try { titles = JSON.parse(await readFile(out, 'utf8')); } catch { titles = {}; }

for (const t of targets) {
  if (titles[t]) continue;
  const [kind, id] = t.split(':');
  const url = `${CFG.host}/api/${kind === 'hub' ? 'portal' : 'document'}/${id}`;
  const r = await fetch(url, { redirect: 'manual', headers: { accept: 'application/json' } });
  const loc = r.headers.get('location') || '';
  if ([401, 403, 405].includes(r.status) || (r.status >= 300 && r.status < 400 && loc.includes('/auth'))) {
    await writeFile(out, JSON.stringify(titles, null, 1));
    console.error(`STOP ${r.status}${loc ? ` -> ${loc}` : ''} at ${url}`);
    process.exit(3);
  }
  if (r.ok) {
    const d = (await r.json()).data || {};
    titles[t] = { title: d.title || d.name || null, heading: d.heading || null };
  } else {
    titles[t] = { title: null, status: r.status };
  }
  console.log(t, r.status, titles[t].title);
  await writeFile(out, JSON.stringify(titles, null, 1));
  await sleep(PAUSE);
}
