/* Capture rendered reference for each page of the configured Frontify document:
 * - desktop (1440) + mobile (390) full-page screenshots
 * - GraphQL responses (colors, list styles, design settings, theme)
 * - rendered <main> HTML + computed style samples
 * Usage: node capture.mjs <rawDir> <outDir> [pageId,...]
 * One page open at a time. Stops on auth redirect. */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import CFG from './config.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);

const [rawDir, outDir, only] = process.argv.slice(2);
const nav = JSON.parse(await readFile(path.join(rawDir, 'navigation.json'))).data;
const order = [];
(function walk(nodes, cat) {
  for (const n of nodes) {
    const tr = n.translations.default;
    if (n.type === 'page') order.push({ id: n.id, cat, slug: tr.slug });
    if (n.children) walk(n.children, n.type === 'page_category' ? tr.slug : cat);
  }
}(nav, null));
const wanted = only ? order.filter((o) => only.split(',').includes(String(o.id))) : order;
const exists = (f) => access(f).then(() => true, () => false);

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
// Trust only the workspace proxy CA (by SPKI pin) so auth-injected traffic validates.
const launchArgs = process.env.PROXY_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.PROXY_SPKI}`] : [];
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const browser = await chromium.launch({ args: launchArgs, proxy });
const failures = [];

// Frontify scrolls inside an inner viewport element, not the window.
const FIND_SCROLLER = `(() => { let best = document.scrollingElement; let max = best.scrollHeight - best.clientHeight;
  for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowY) && e.clientHeight > 200 && e.scrollHeight - e.clientHeight > max) { max = e.scrollHeight - e.clientHeight; best = e; } }
  return best; })()`;

async function autoscroll(page) {
  await page.evaluate(async (finder) => {
    // eslint-disable-next-line no-eval
    const sc = (0, eval)(finder);
    const step = 500;
    for (let y = 0; y < sc.scrollHeight; y += step) {
      sc.scrollTop = y;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 150); });
    }
    sc.scrollTop = 0;
  }, FIND_SCROLLER);
}

// Grow the window until the inner scroller no longer scrolls, so the
// screenshot shows the page exactly as laid out, at full length.
async function expandViewport(page, width) {
  for (let i = 0; i < 4; i += 1) {
    const need = await page.evaluate((finder) => {
      // eslint-disable-next-line no-eval
      const sc = (0, eval)(finder);
      const extra = sc.scrollHeight - sc.clientHeight;
      return extra > 2 ? window.innerHeight + extra : 0;
    }, FIND_SCROLLER);
    if (!need) break;
    await page.setViewportSize({ width, height: Math.min(need, 60000) });
    await page.waitForTimeout(800);
  }
}

for (const o of wanted) {
  const dir = path.join(outDir, String(o.id));
  await mkdir(dir, { recursive: true });
  if (await exists(path.join(dir, 'mobile.png')) && await exists(path.join(dir, 'styles.json'))) {
    const prev = JSON.parse(await readFile(path.join(dir, 'styles.json')));
    if (prev.title && prev.title.includes('TUI Master Brand Home')) continue; // already valid
  }
  if (process.env.PAGE_DELAY_MS) await new Promise((r) => { setTimeout(r, Number(process.env.PAGE_DELAY_MS)); });
  const hash = o.cat ? `#/${o.cat}/${o.slug}` : `#/-/${o.slug}`;
  const url = `${CFG.host}/document/${CFG.documentId}${hash}`;
  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    const gql = [];
    page.on('response', async (res) => {
      const u = res.url();
      if (u.includes('/graphql-internal')) {
        const op = new URL(u).searchParams.get('operationName');
        if (['RecordOperationMeasurement', 'CurrentUser', 'Account', 'Flags', 'PortalFlags'].includes(op)) return;
        try { gql.push({ op, variables: JSON.parse(res.request().postData() || '{}').variables, data: await res.json() }); } catch (e) { /* ignore */ }
      }
    });
    try {
      await page.goto(url, { timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
      const blockedTitle = await page.title().catch(() => '');
      if (page.url().includes('/auth') || /human verification/i.test(blockedTitle)) {
        failures.push({ id: o.id, url, reason: page.url().includes('/auth') ? 'auth redirect' : 'bot check (Human Verification)' });
        console.error('BLOCKED - stopping', url, blockedTitle);
        await ctx.close();
        await browser.close();
        await writeFile(path.join(outDir, 'capture-failures.json'), JSON.stringify(failures, null, 2));
        process.exit(3);
      }
      await page.waitForSelector('main h1', { timeout: 30000 }).catch(() => {});
      // hide chat widget so it doesn't pollute reference screenshots
      await page.addStyleTag({ content: '#intercom-container, .intercom-lightweight-app, iframe[name^="intercom"] { display:none !important; }' });
      await autoscroll(page);
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await expandViewport(page, size.width);
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(dir, `${vp}.png`), fullPage: true, timeout: 90000 });
      if (vp === 'desktop') {
        const info = await page.evaluate(() => {
          const main = document.querySelector('main');
          const pick = (el) => {
            const cs = getComputedStyle(el);
            return ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'margin-top', 'margin-bottom', 'padding', 'border', 'border-radius', 'text-transform', 'max-width', 'width'].reduce((a, k) => { a[k] = cs.getPropertyValue(k); return a; }, {});
          };
          const samples = {};
          ['main h1', 'main h2', 'main h3', 'main h4', 'main p', 'main a', 'main li', 'main blockquote', 'main figcaption', 'header', 'nav', 'body', 'main'].forEach((s) => {
            const el = document.querySelector(s);
            if (el) samples[s] = pick(el);
          });
          return { title: document.title, html: main ? main.outerHTML : '', samples, height: document.body.scrollHeight };
        });
        await writeFile(path.join(dir, 'rendered.html'), info.html);
        await writeFile(path.join(dir, 'styles.json'), JSON.stringify({ title: info.title, height: info.height, samples: info.samples }, null, 2));
        await writeFile(path.join(dir, 'graphql.json'), JSON.stringify(gql, null, 2));
      }
    } catch (e) {
      failures.push({ id: o.id, url, vp, reason: e.message.split('\n')[0] });
      console.error('FAIL', o.id, vp, e.message.split('\n')[0]);
    }
    await ctx.close();
  }
  console.log('captured', o.id, hash);
}
await browser.close();
await writeFile(path.join(outDir, only ? 'capture-failures-partial.json' : 'capture-failures.json'), JSON.stringify(failures, null, 2));
console.log('done', wanted.length, 'failures', failures.length);
