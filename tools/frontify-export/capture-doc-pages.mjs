/* Capture every page of a Frontify document (new document theme) with ONE full page load: further
 * pages are opened through the app's own hash routing. Per page and width (resized in place):
 * full-length screenshot, element styles (like capture-hub.mjs), section layout (like
 * capture-doc-layout.mjs), the body HTML at 1440 (colour schemes) and the app's own responses for
 * getColorBlockColors, GetDocumentPageThemeSettings and the page template asset. Pauses between
 * pages; stops on /auth, 401/403 and the bot check. Skips pages already captured.
 * Usage: PW_PATH=... PROXY_SPKI=... HTTPS_PROXY=... [PAGE_DELAY_MS=12000]
 *        node capture-doc-pages.mjs <docId> <rawDir> <outDir> [pageId,...] */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import CFG from './config.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [docId, rawDir, outDir, only] = process.argv.slice(2);
const PAUSE = Number(process.env.PAGE_DELAY_MS || 12000);
const WIDTHS = [1440, 768, 375];
const exists = (f) => access(f).then(() => true, () => false);

const nav = JSON.parse(await readFile(path.join(rawDir, 'navigation.json'), 'utf8')).data;
const pages = [];
nav.forEach((n) => {
  const t = n.translations.default;
  if (n.type === 'page_category') (n.children || []).filter((c) => c.type === 'page').forEach((c) => pages.push({ id: c.id, hash: `#/${t.slug}/${c.translations.default.slug}` }));
  else if (n.type === 'page') pages.push({ id: n.id, hash: `#/-/${t.slug}` });
});
const todo = [];
for (const p of pages) {
  if (only && !only.split(',').includes(String(p.id))) continue;
  if (await exists(path.join(outDir, String(p.id), '375.layout.json'))) continue;
  todo.push(p);
}
console.log('pages to capture', todo.length, 'of', pages.length);
if (!todo.length) process.exit(0);

const browser = await chromium.launch({
  args: process.env.PROXY_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.PROXY_SPKI}`] : [],
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
let stop = null;
let captured = {};
page.on('response', async (res) => {
  const u = new URL(res.url());
  if ([401, 403, 405].includes(res.status()) && u.hostname === CFG.hostname) stop = stop || `${res.status()} ${u.pathname}`;
  const req = res.request();
  let op = null;
  if (u.pathname.includes('graphql')) { op = u.searchParams.get('operationName'); if (!op) { try { op = req.postDataJSON()?.operationName; } catch (e) { op = null; } } }
  const keep = (op && /^(getColorBlockColors|GetDocumentPageThemeSettings)$/.test(op)) || /\/api\/document-page\/\d+\/template-asset$/.test(u.pathname);
  if (!keep || res.status() !== 200) return;
  try {
    const body = await res.json();
    const key = op || 'template-asset';
    (captured[key] = captured[key] || []).push({ path: u.pathname, body });
  } catch (e) { /* ignore */ }
});

const FIND_SCROLLER = `(() => { let best = document.scrollingElement; let max = best.scrollHeight - best.clientHeight;
  for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowY) && e.clientHeight > 200 && e.scrollHeight - e.clientHeight > max) { max = e.scrollHeight - e.clientHeight; best = e; } }
  return best; })()`;

async function growAndSettle(width) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(900);
  // scroll through so lazy content loads, then grow the window to the content height
  await page.evaluate(async (finder) => {
    // eslint-disable-next-line no-eval
    const sc = (0, eval)(finder);
    for (let y = 0; y < sc.scrollHeight; y += 600) { sc.scrollTop = y; await new Promise((r) => { setTimeout(r, 90); }); }
    sc.scrollTop = 0;
  }, FIND_SCROLLER);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  for (let k = 0; k < 5; k += 1) {
    const need = await page.evaluate((finder) => {
      // eslint-disable-next-line no-eval
      const sc = (0, eval)(finder); const extra = sc.scrollHeight - sc.clientHeight; return extra > 2 ? window.innerHeight + extra : 0;
    }, FIND_SCROLLER);
    if (!need) break;
    await page.setViewportSize({ width, height: Math.min(need, 60000) });
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(800);
}

const STYLES_FN = () => {
  const P = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'background-image', 'margin', 'padding', 'border', 'border-radius', 'text-transform', 'text-decoration', 'width', 'height', 'box-shadow', 'opacity', 'text-align', 'object-fit', 'display', 'position', 'gap', 'justify-content', 'align-items', 'aspect-ratio', 'overflow'];
  const R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + window.scrollY), Math.round(r.width), Math.round(r.height)]; };
  const S = (e) => { const c = getComputedStyle(e); const o = { tag: e.tagName.toLowerCase(), rect: R(e) }; P.forEach((p) => { o[p] = c.getPropertyValue(p); }); return o; };
  const els = {};
  ['header', 'nav', 'aside', 'h1', 'h2', 'h3', 'h4', 'p', 'a', '.btn', 'button', 'img', 'footer', 'hr', 'li', 'table'].forEach((s) => {
    els[s] = [...document.querySelectorAll(s)].slice(0, 400).map((e) => ({ text: (e.innerText || e.getAttribute('alt') || '').trim().slice(0, 60), cls: String(e.className?.baseVal ?? e.className).slice(0, 80), href: e.getAttribute('href'), src: (e.currentSrc || e.getAttribute('src') || '').split('?')[0].slice(-60), ...S(e) }));
  });
  const sections = [...document.querySelectorAll('[data-test-id="section-grid-container"]')].map((g) => {
    const content = g.closest('[data-test-id="section-content"]');
    const region = g.closest('[data-test-id="section-region"]');
    const items = [...g.querySelectorAll(':scope > [data-test-id="section-grid-container-item"]')].map((it) => {
      const blockEl = it.querySelector('[data-block]');
      const parts = blockEl ? [...blockEl.querySelectorAll('img, p, h1, h2, h3, h4, h5, h6, a, button, li, hr, table, td, th, video, iframe, [class*="card"], [class*="callout"]')].slice(0, 80).map((e) => ({ cls: String(e.className?.baseVal ?? e.className).slice(0, 80), text: (e.innerText || e.getAttribute('alt') || '').trim().slice(0, 40), ...S(e) })) : [];
      return { block: blockEl && blockEl.getAttribute('data-block'), item: S(it), parts };
    });
    return { grid: { ...S(g), cols: getComputedStyle(g).gridTemplateColumns, rowGap: getComputedStyle(g).rowGap, colGap: getComputedStyle(g).columnGap }, content: content ? S(content) : null, region: region ? S(region) : null, bg: region?.parentElement ? S(region.parentElement) : null, items };
  });
  const aside = document.querySelector('aside, [data-test-id*="sidebar"]');
  const sidebar = aside ? [...aside.querySelectorAll('a, button, li, h2, h3, p, span')].slice(0, 300).map((e) => ({ text: (e.innerText || '').trim().slice(0, 50), href: e.getAttribute('href'), cls: String(e.className?.baseVal ?? e.className).slice(0, 60), ...S(e) })) : [];
  const headerParts = [...(document.querySelector('header')?.querySelectorAll('a, button, img, nav, ul, li') || [])].slice(0, 60).map((e) => ({ text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), href: e.getAttribute('href'), cls: String(e.className?.baseVal ?? e.className).slice(0, 60), ...S(e) }));
  return { title: document.title, docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth, els, sections, sidebar: { box: aside ? S(aside) : null, items: sidebar }, headerParts };
};

let first = true;
for (const p of todo) {
  if (stop) break;
  captured = {};
  const target = `${CFG.host}/document/${docId}${p.hash}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  if (first) { await page.goto(target, { timeout: 60000 }); first = false; } else {
    await page.evaluate((h) => { window.location.hash = h; }, p.hash);
  }
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const title = await page.title();
  const text = await page.evaluate(() => document.body.innerText.slice(0, 300));
  if (page.url().includes('/auth') || /human verification/i.test(title + text)) { stop = `blocked at ${page.url()} (${title})`; break; }
  const dir = path.join(outDir, String(p.id));
  await mkdir(dir, { recursive: true });
  for (const w of WIDTHS) {
    await growAndSettle(w);
    await page.screenshot({ path: path.join(dir, `${w}.png`), fullPage: true, timeout: 120000 });
    const data = await page.evaluate(STYLES_FN);
    await writeFile(path.join(dir, `${w}.layout.json`), JSON.stringify(data));
    if (w === 1440) await writeFile(path.join(dir, '1440.html'), await page.evaluate(() => document.body.outerHTML));
  }
  await writeFile(path.join(dir, 'captured-api.json'), JSON.stringify(captured));
  const t = JSON.parse(await readFile(path.join(dir, '1440.layout.json'), 'utf8')).title;
  console.log('captured', p.id, p.hash, '|', t);
  await page.setViewportSize({ width: 1440, height: 900 });
  await new Promise((r) => { setTimeout(r, PAUSE); });
}
await browser.close();
if (stop) { console.error('STOP', stop); process.exit(3); }
