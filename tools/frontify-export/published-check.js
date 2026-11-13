/* eslint-disable max-len, object-curly-newline -- page.evaluate callbacks run in the browser */
/* eslint-env browser */
/* Functional check of published pages on an Edge Delivery host (aem.page / aem.live), as served:
 * per page: images (broken ones), failed requests (>= 400, same host), script errors, blocks that
 * did not load, sidebar / pagination presence; then every download, video, media and brand hub
 * link target found on the pages is requested (status must be 200 after redirects).
 * Extra checks: Media library (all tiles reachable, search across parts) and the in-content heading
 * links (anchor restored, click lands on the heading).
 * Goes through the workspace proxy (site auth is injected). One page at a time.
 * Usage: PW_PATH=... PROXY_SPKI=... HTTPS_PROXY=... node published-check.js <host> <pathsFile> <out.json> */
const fs = require('fs');
// eslint-disable-next-line import/no-dynamic-require
const { chromium } = require(process.env.PW_PATH);

const [host, pathsFile, out] = process.argv.slice(2);
const pages = fs.readFileSync(pathsFile, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);
const FILE_LINK = /tui-brandhub\.com\/document\/|\/assets\/|media_|\.(pdf|mp4|svg|png|jpe?g|zip)(\?|$)|content\.da\.live/i;

(async () => {
  const browser = await chromium.launch({
    args: process.env.PROXY_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.PROXY_SPKI}`] : [],
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
  });
  const report = { host, pages: [], targets: {}, media: null, anchors: [] };
  const targets = new Map();
  for (const pg of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    const failed = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
    p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(host) && !/favicon/.test(r.url())) failed.push(`${r.status()} ${r.url().replace(host, '').slice(0, 100)}`); });
    const rec = { path: pg };
    try {
      const res = await p.goto(`${host}${pg}`, { waitUntil: 'networkidle', timeout: 90000 });
      rec.status = res.status();
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => { setTimeout(r, 60); }); } });
      await p.waitForTimeout(1500);
      Object.assign(rec, await p.evaluate(() => ({
        imgs: document.querySelectorAll('main img').length,
        broken: [...document.querySelectorAll('main img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => (i.currentSrc || i.src).slice(-70)),
        videos: document.querySelectorAll('main video').length,
        sidebar: !!document.querySelector('.guideline-sidebar li'),
        pagination: !!document.querySelector('.guideline-pagination'),
        notLoaded: [...document.querySelectorAll('main .block')].filter((x) => x.dataset.blockStatus !== 'loaded').map((x) => x.classList[0]),
      })));
      const urls = await p.evaluate((re) => {
        const rx = new RegExp(re, 'i');
        const set = new Set();
        document.querySelectorAll('main a[href]').forEach((a) => { if (rx.test(a.href)) set.add(a.href.split('#')[0]); });
        document.querySelectorAll('main video').forEach((v) => { const s = v.currentSrc || v.src || v.querySelector('source')?.src; if (s) set.add(s); });
        return [...set];
      }, FILE_LINK.source);
      urls.forEach((u) => { if (!targets.has(u)) targets.set(u, pg); });
    } catch (e) { rec.error = e.message.slice(0, 120); }
    rec.errors = errs;
    rec.failed = [...new Set(failed)];
    rec.ok = !rec.error && rec.status === 200 && !rec.broken?.length && !errs.length && !failed.length && !rec.notLoaded?.length;
    report.pages.push(rec);
    console.log(rec.ok ? 'OK' : 'PROBLEM', pg, `imgs ${rec.imgs ?? '-'}`, rec.videos ? `videos ${rec.videos}` : '', rec.ok ? '' : JSON.stringify({ status: rec.status, broken: rec.broken?.slice(0, 2), failed: rec.failed.slice(0, 3), errors: errs.slice(0, 2), notLoaded: rec.notLoaded, error: rec.error }));
    await ctx.close();
  }
  // link targets
  const ctx = await browser.newContext();
  let bad = 0;
  for (const [u, pg] of targets) {
    // brand hub pages: one request at a time with a pause (its WAF blocks bursts); SKIP_HUB=1 skips them
    const hub = /^https:\/\/tui-brandhub\.com\//.test(u);
    if (hub && process.env.SKIP_HUB) continue;
    if (hub) await new Promise((res) => { setTimeout(res, 1500); });
    const r = await ctx.request.get(u, { maxRedirects: 3 }).catch(() => null);
    const st = r ? r.status() : 'ERR';
    report.targets[u] = { page: pg, status: st };
    if (st !== 200) { bad += 1; console.log('TARGET', st, u.replace(host, ''), 'on', pg); }
  }
  console.log('link targets', targets.size, 'not 200:', bad);
  await ctx.close();
  // Media library: every tile reachable, search covers the later parts
  if (pages.includes('/the-mora/libraries/media')) {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await c.newPage();
    await p.goto(`${host}/the-mora/libraries/media`, { waitUntil: 'networkidle', timeout: 90000 });
    for (let i = 0; i < 80; i += 1) { await p.mouse.wheel(0, 4000); await p.waitForTimeout(250); }
    await p.waitForTimeout(2000);
    const tiles = await p.evaluate(() => document.querySelectorAll('.library .library-grid > *, .library li').length);
    const input = await p.$('.library-search input, input[type="search"]');
    let search = null;
    if (input) { await input.fill('brand film'); await p.waitForTimeout(2500); search = await p.evaluate(() => (document.body.innerText.match(/\d+ items?/g) || []).join(', ')); }
    report.media = { tiles, search };
    console.log('MEDIA', JSON.stringify(report.media));
    await c.close();
  }
  // heading links restored from scripts/link-anchors.json
  for (const pg of ['/the-mora/hotels/hotel-expression/environments', '/the-mora/hotels/hotel-expression/sub-brands-framework']) {
    if (!pages.includes(pg)) continue;
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await c.newPage();
    await p.goto(`${host}${pg}`, { waitUntil: 'networkidle', timeout: 90000 });
    await p.waitForTimeout(1500);
    const links = await p.evaluate(() => [...document.querySelectorAll('.guideline-content a[href*="#"]')]
      .filter((a) => new URL(a.href).pathname === window.location.pathname).map((a) => [a.textContent.trim(), new URL(a.href).hash]));
    for (let i = 0; i < links.length; i += 1) {
      await p.evaluate(() => window.scrollTo(0, 0));
      const nth = links.slice(0, i).filter((l) => l[0] === links[i][0]).length;
      await p.locator('.guideline-content a[href*="#"]').filter({ hasText: links[i][0] }).nth(nth).click();
      await p.waitForTimeout(1200);
      const r = await p.evaluate((slug) => { const el = document.getElementById(slug); return { found: !!el, top: el ? Math.round(el.getBoundingClientRect().top) : null }; }, links[i][1].slice(1));
      report.anchors.push({ page: pg, text: links[i][0], hash: links[i][1], ...r });
      console.log('ANCHOR', pg, links[i][0], links[i][1], JSON.stringify(r));
    }
    await c.close();
  }
  fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log('pages', report.pages.length, 'ok', report.pages.filter((x) => x.ok).length);
  await browser.close();
})();
