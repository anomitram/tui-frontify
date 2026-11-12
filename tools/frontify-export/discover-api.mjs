/* Load one Frontify URL once in a browser and record which same-origin JSON APIs the app calls
 * (method, path, status) and save each JSON response body, so the content model of an unknown view
 * (dashboard, hub, document) can be read from the API instead of the DOM. No headers or cookies are
 * recorded, and only content APIs are saved (never session, user or token responses). Stops on /auth, 401/403 and the bot check.
 * Usage: PW_PATH=... PROXY_SPKI=... HTTPS_PROXY=... node discover-api.mjs <url> <outDir> */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, outDir] = process.argv.slice(2);
const origin = new URL(url).origin;

const browser = await chromium.launch({
  args: process.env.PROXY_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.PROXY_SPKI}`] : [],
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
});
await mkdir(path.join(outDir, 'api'), { recursive: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
const calls = [];
let stop = null;
page.on('response', async (res) => {
  const u = new URL(res.url());
  const req = res.request();
  if (u.origin !== origin && !/graphql/.test(u.pathname)) return;
  if (!['xhr', 'fetch', 'document'].includes(req.resourceType())) return;
  const status = res.status();
  if ([401, 403, 405].includes(status) || u.pathname.startsWith('/auth')) stop = stop || `${status} ${u.pathname}`;
  let op = null;
  if (req.method() === 'POST') {
    try { op = req.postDataJSON()?.operationName || null; } catch { op = null; } // form posts aren't JSON
  }
  const entry = {
    method: req.method(), path: u.pathname, query: u.search, status, type: req.resourceType(), op,
  };
  calls.push(entry);
  // Save bodies of content APIs only. Session, CSRF, user, account, context, realtime-auth and tracking
  // responses carry tokens or personal data and must never be stored (hard rule).
  const CONTENT = /^\/api\/(dashboard\/|portal\/|portal-navigation\/|document\/navigation\/|hub\/|guideline-stylesheets\/|custom-route\/|permanent-link\/|library|document-library|collection|asset|document\/\d+$|document-page|theme-context)/;
  const CONTENT_OPS = /^(getGuidelineDesignSettings|getListStyles|GetCoverPageThemeSettings|GetDocumentPageThemeSettings|getColorBlockColors)$/;
  const save = CONTENT.test(u.pathname) || (/graphql/.test(u.pathname) && CONTENT_OPS.test(op || u.searchParams.get('operationName') || ''));
  if (save && /json/.test(res.headers()['content-type'] || '') && status === 200) {
    try {
      const body = await res.text();
      const name = `${String(calls.length).padStart(3, '0')}${(u.pathname + (entry.op ? `-${entry.op}` : '')).replace(/[^a-z0-9]+/gi, '_')}.json`.slice(0, 140);
      entry.file = name;
      await writeFile(path.join(outDir, 'api', name), body);
    } catch { /* body unavailable (redirect or aborted) */ }
  }
});
await page.goto(url, { timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(3000);
const title = await page.title();
const text = await page.evaluate(() => document.body.innerText.slice(0, 400));
if (page.url().includes('/auth') || /human verification/i.test(title + text)) stop = stop || `blocked at ${page.url()}`;
await writeFile(path.join(outDir, 'calls.json'), JSON.stringify({ url, finalUrl: page.url(), title, stop, calls }, null, 1));
console.log(JSON.stringify({ finalUrl: page.url(), title, stop, n: calls.length }));
await browser.close();
if (stop) process.exit(3);
