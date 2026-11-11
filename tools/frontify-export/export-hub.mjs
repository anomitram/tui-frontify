/* Export a Frontify portal home ("hub") page as raw JSON: route, portal, grid rows, footer,
 * appearance, fonts, stylesheet, navigation. Sequential with pauses; stops on /auth, 401/403, 405.
 * Usage: FRONTIFY_PORTAL_ID=162 HUB_ROUTE=tuimagiclife node export-hub.mjs <outDir> */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import CFG from './config.mjs';

const HOST = CFG.host;
const PORTAL = Number(process.env.FRONTIFY_PORTAL_ID || CFG.portalId);
const ROUTE = process.env.HUB_ROUTE || '';
const LANG = CFG.language;
const PAUSE = Number(process.env.EXPORT_PAUSE_MS || 1500);
const out = process.argv[2];
if (!out) throw new Error('outDir required');

class AuthError extends Error {}
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function get(url) {
  const r = await fetch(HOST + url, { redirect: 'manual', headers: { accept: 'application/json' } });
  const loc = r.headers.get('location') || '';
  if (r.status === 401 || r.status === 403 || r.status === 405 || (r.status >= 300 && r.status < 400 && loc.includes('/auth'))) {
    throw new AuthError(`STOP ${r.status} ${loc ? `-> ${loc}` : ''} at ${url}`);
  }
  const text = await r.text();
  if (!r.ok) return { status: r.status, error: true, url, body: text.slice(0, 300) };
  try { return JSON.parse(text); } catch (e) { return { status: r.status, error: true, url, nonJson: text.slice(0, 300) }; }
}

const endpoints = {
  ...(ROUTE ? { 'custom-route.json': `/api/custom-route/${ROUTE}` } : {}),
  'portal.json': `/api/portal/${PORTAL}?language=${LANG}`,
  'grid.json': `/api/hub/grid/${PORTAL}`,
  'footer.json': `/api/portal/${PORTAL}/footer`,
  'appearance.json': `/api/portal/${PORTAL}/appearance`,
  'font-families.json': `/api/portal/${PORTAL}/font-families`,
  'font-styles.json': `/api/portal/${PORTAL}/font-styles`,
  'theme-asset-cover.json': `/api/portal/${PORTAL}/theme-asset/cover`,
  'stylesheet.json': `/api/guideline-stylesheets/portal/${PORTAL}?language=${LANG}`,
  'document-navigation.json': `/api/document/navigation/${PORTAL}?language=${LANG}`,
  'portal-navigation.json': `/api/portal-navigation/${PORTAL}`,
};

try {
  await mkdir(out, { recursive: true });
  for (const [name, url] of Object.entries(endpoints)) {
    const d = await get(url);
    await writeFile(path.join(out, name), JSON.stringify(d, null, 2));
    console.log('saved', name, d.error ? `ERROR ${d.status}` : 'ok');
    await sleep(PAUSE);
  }
} catch (e) {
  if (e instanceof AuthError) { console.error(e.message); process.exit(3); }
  throw e;
}
