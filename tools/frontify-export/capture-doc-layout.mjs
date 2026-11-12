/* Capture the rendered layout of a Frontify document page (new document theme): per section the
 * grid (columns, gaps, padding, background) and per block its rect and the computed styles of its
 * parts (images, text, links, card/slider elements). One page load per width, paused; stops on
 * /auth, 401/403 and the bot check. Nothing but layout data is stored.
 * Usage: PW_PATH=... PROXY_SPKI=... HTTPS_PROXY=... node capture-doc-layout.mjs <url> <outDir> [widths] */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [url, outDir, widthsArg] = process.argv.slice(2);
const widths = (widthsArg || '1440,768,375').split(',').map(Number);
const PAUSE = Number(process.env.PAGE_DELAY_MS || 20000);

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
  if (page.url().includes('/auth') || /human verification/i.test(title)) { console.error('STOP', page.url(), title); await ctx.close(); break; }
  // grow the window to the content height (Frontify scrolls an inner element), like capture-hub.mjs
  for (let k = 0; k < 4; k += 1) {
    const need = await page.evaluate(() => {
      let best = document.scrollingElement; let max = best.scrollHeight - best.clientHeight;
      for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowY) && e.clientHeight > 200 && e.scrollHeight - e.clientHeight > max) { max = e.scrollHeight - e.clientHeight; best = e; } }
      return max > 2 ? window.innerHeight + max : 0;
    });
    if (!need) break;
    await page.setViewportSize({ width, height: Math.min(need, 60000) });
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    const R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + window.scrollY), Math.round(r.width), Math.round(r.height)]; };
    const P = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'text-align', 'color', 'background-color', 'background-image', 'margin', 'padding', 'border', 'border-radius', 'object-fit', 'object-position', 'aspect-ratio', 'gap', 'display', 'position', 'opacity', 'box-shadow', 'text-decoration-line', 'justify-content', 'align-items', 'overflow', 'transform'];
    const S = (e) => { const c = getComputedStyle(e); const o = { tag: e.tagName.toLowerCase(), rect: R(e) }; P.forEach((p) => { o[p] = c.getPropertyValue(p); }); return o; };
    const sections = [...document.querySelectorAll('[data-test-id="section-grid-container"]')].map((g) => {
      const content = g.closest('[data-test-id="section-content"]');
      const region = g.closest('[data-test-id="section-region"]');
      const bg = region && region.parentElement;
      const items = [...g.querySelectorAll(':scope > [data-test-id="section-grid-container-item"]')].map((it) => {
        const blockEl = it.querySelector('[data-block]');
        const parts = blockEl ? [...blockEl.querySelectorAll('img, p, h1, h2, h3, h4, a, button, li, hr, [role="separator"], .splide__arrow, .splide__pagination__page, [class*="card"], [class*="divider"]')].slice(0, 60).map((e) => ({ cls: String(e.className).slice(0, 80), text: (e.innerText || e.getAttribute('alt') || '').trim().slice(0, 40), ...S(e) })) : [];
        return { block: blockEl && blockEl.getAttribute('data-block'), item: S(it), block_el: blockEl ? S(blockEl) : null, parts };
      });
      return {
        grid: { ...S(g), cols: getComputedStyle(g).gridTemplateColumns, rowGap: getComputedStyle(g).rowGap, colGap: getComputedStyle(g).columnGap },
        content: content ? S(content) : null, region: region ? S(region) : null, bg: bg ? S(bg) : null, items,
      };
    });
    const header = document.querySelector('header');
    const headerParts = header ? [...header.querySelectorAll('a, button, img, nav, ul, li, svg')].slice(0, 60).map((e) => ({ cls: String(e.className?.baseVal ?? e.className).slice(0, 80), text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), href: e.getAttribute('href'), ...S(e) })) : [];
    return { title: document.title, docH: document.documentElement.scrollHeight, header: header ? S(header) : null, headerParts, sections };
  });
  await writeFile(path.join(outDir, `${width}.layout.json`), JSON.stringify(data, null, 1));
  console.log('captured layout', width, data.title, data.sections.length, 'sections');
  await ctx.close();
}
await browser.close();
