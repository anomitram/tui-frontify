/* Capture the rendered reference of a Frontify hub (portal home) page at several widths:
 * full-length screenshot, rendered body HTML, computed styles of key elements, and (desktop)
 * hover states of links/buttons/tiles. One page load per width, paused; stops on bot check/auth.
 * Usage: PW_PATH=... PROXY_SPKI=... node capture-hub.mjs <url> <outDir> [widths=1440,768,375] */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, outDir, widthsArg] = process.argv.slice(2);
const widths = (widthsArg || '1440,768,375').split(',').map(Number);
const PAUSE = Number(process.env.PAGE_DELAY_MS || 20000);

const FIND_SCROLLER = `(() => { let best = document.scrollingElement; let max = best.scrollHeight - best.clientHeight;
  for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowY) && e.clientHeight > 200 && e.scrollHeight - e.clientHeight > max) { max = e.scrollHeight - e.clientHeight; best = e; } }
  return best; })()`;

const browser = await chromium.launch({
  args: process.env.PROXY_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.PROXY_SPKI}`] : [],
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
});
await mkdir(outDir, { recursive: true });
for (const [i, width] of widths.entries()) {
  if (i > 0) await new Promise((r) => { setTimeout(r, PAUSE); });
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(url, { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  const title = await page.title();
  if (page.url().includes('/auth') || /human verification|something went wrong/i.test(title + await page.evaluate(() => document.body.innerText.slice(0, 300)))) {
    console.error('STOP: blocked or error page at', width, page.url(), title);
    await ctx.close(); break;
  }
  await page.addStyleTag({ content: '#intercom-container,.intercom-lightweight-app,iframe[name^="intercom"]{display:none!important}' });
  await page.evaluate(async (finder) => {
    // eslint-disable-next-line no-eval
    const sc = (0, eval)(finder);
    for (let y = 0; y < sc.scrollHeight; y += 500) { sc.scrollTop = y; await new Promise((r) => { setTimeout(r, 150); }); }
    sc.scrollTop = 0;
  }, FIND_SCROLLER);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  for (let k = 0; k < 4; k += 1) {
    const need = await page.evaluate((finder) => {
      // eslint-disable-next-line no-eval
      const sc = (0, eval)(finder); const extra = sc.scrollHeight - sc.clientHeight; return extra > 2 ? window.innerHeight + extra : 0;
    }, FIND_SCROLLER);
    if (!need) break;
    await page.setViewportSize({ width, height: Math.min(need, 60000) });
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, `${width}.png`), fullPage: true, timeout: 90000 });
  const info = await page.evaluate(() => {
    const P = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'background-image', 'margin', 'padding', 'border', 'border-radius', 'text-transform', 'text-decoration', 'width', 'height', 'box-shadow', 'opacity', 'transition', 'text-align'];
    const st = (el) => { const c = getComputedStyle(el); const r = el.getBoundingClientRect(); const o = { rect: [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)] }; P.forEach((p) => { o[p] = c.getPropertyValue(p); }); return o; };
    const sel = (s) => [...document.querySelectorAll(s)];
    const els = {};
    ['header', 'nav', 'h1', 'h2', 'h3', 'h4', 'p', 'a', '.btn', 'button', 'img', 'footer', 'hr'].forEach((s) => { els[s] = sel(s).slice(0, 40).map((e) => ({ text: (e.innerText || e.getAttribute('alt') || '').trim().slice(0, 60), cls: String(e.className).slice(0, 80), href: e.getAttribute('href'), src: (e.currentSrc || e.getAttribute('src') || '').split('?')[0].slice(-60), ...st(e) })); });
    return { title: document.title, html: document.body.outerHTML, els, docW: document.documentElement.scrollWidth };
  });
  await writeFile(path.join(outDir, `${width}.html`), info.html);
  await writeFile(path.join(outDir, `${width}.styles.json`), JSON.stringify({ title: info.title, docW: info.docW, els: info.els }, null, 1));
  if (width >= 1200) {
    // hover states: links, buttons and tiles inside the main area
    const targets = await page.evaluate(() => [...document.querySelectorAll('main a, main button, main .btn')].map((e, i) => { e.dataset.hoverIdx = String(i); const r = e.getBoundingClientRect(); return { i, text: (e.innerText || '').trim().slice(0, 50), href: e.getAttribute('href'), w: r.width, h: r.height }; }).filter((t) => t.w > 0 && t.h > 0));
    const hovers = [];
    for (const t of targets.slice(0, 40)) {
      const loc = page.locator(`[data-hover-idx="${t.i}"]`);
      const before = await loc.evaluate((e) => { const c = getComputedStyle(e); const img = e.querySelector('img'); return { color: c.color, bg: c.backgroundColor, td: c.textDecorationLine, op: c.opacity, shadow: c.boxShadow, border: c.borderColor, transform: c.transform, imgTransform: img ? getComputedStyle(img).transform : null, imgOpacity: img ? getComputedStyle(img).opacity : null }; });
      await loc.hover({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(450);
      const after = await loc.evaluate((e) => { const c = getComputedStyle(e); const img = e.querySelector('img'); return { color: c.color, bg: c.backgroundColor, td: c.textDecorationLine, op: c.opacity, shadow: c.boxShadow, border: c.borderColor, transform: c.transform, imgTransform: img ? getComputedStyle(img).transform : null, imgOpacity: img ? getComputedStyle(img).opacity : null }; });
      const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
      if (changed.length) {
        const box = await loc.boundingBox();
        if (box) await page.screenshot({ path: path.join(outDir, `hover-${t.i}.png`), clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: Math.min(box.width + 20, width), height: box.height + 20 } }).catch(() => {});
      }
      hovers.push({ ...t, before, after, changed });
    }
    await page.mouse.move(1, 1);
    await writeFile(path.join(outDir, 'hover-states.json'), JSON.stringify(hovers, null, 1));
  }
  console.log('captured', width, title);
  await ctx.close();
}
await browser.close();
