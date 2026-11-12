/* eslint-env browser */
/* eslint-disable max-len, object-property-newline -- page.evaluate callbacks run in the browser */
/* Compare migrated Frontify document pages (new document theme) with their reference captures:
 * per section the grid rect (x, y, width, height) of the local page vs <capture>/<w>.layout.json
 * (sections[].grid), plus the page height. One page at a time; the window grows to the page height
 * like the reference capture. Local pages only (offline render server).
 * Usage: PW_PATH=... node doc-compare-sections.js <build-report.json> <base> <out.json> [host=http://localhost:3001] [widths=1440,768,375] [pathFilter] */
const fs = require('fs');
// eslint-disable-next-line import/no-dynamic-require
const { chromium } = require(process.env.PW_PATH);

const [report, base, out, host = 'http://localhost:3001', widthsArg = '1440,768,375', filter = ''] = process.argv.slice(2);
const widths = widthsArg.split(',').map(Number);
const pages = JSON.parse(fs.readFileSync(report, 'utf8')).filter((r) => !filter || r.path.includes(filter));

(async () => {
  // remote hosts (aem.page) go through the workspace proxy, which injects the site's auth header
  const remote = /^https:/.test(host);
  const browser = await chromium.launch({
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: remote && process.env.PROXY_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.PROXY_SPKI}`] : [],
    proxy: remote && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
  });
  // CODE_LOCAL=1: serve /scripts, /styles, /blocks, /fonts, /icons from this repo (code not yet merged)
  const REPO = require('path').resolve(__dirname, '..', '..');
  const TYPES = {
    '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.woff': 'font/woff',
  };
  const results = [];
  for (const r of pages) {
    for (const w of widths) {
      const capFile = `${base}/${r.doc}/capture/${r.page}/${w}.layout.json`;
      if (!fs.existsSync(capFile)) continue;
      const cap = JSON.parse(fs.readFileSync(capFile, 'utf8'));
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      if (remote && process.env.CODE_LOCAL) {
        await ctx.route(/^https:\/\/[^/]+\/(scripts|styles|blocks|fonts|icons)\//, async (route) => {
          const file = require('path').join(REPO, new URL(route.request().url()).pathname);
          if (!fs.existsSync(file)) { await route.fulfill({ status: 404, body: 'not found' }); return; }
          await route.fulfill({ status: 200, contentType: TYPES[require('path').extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        });
      }
      const p = await ctx.newPage();
      p.setDefaultTimeout(30000);
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
      try {
        await p.goto(remote ? `${host}${r.path}` : `${host}/content${r.path}.html`, { waitUntil: 'networkidle', timeout: 60000 });
        await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((res) => { setTimeout(res, 60); }); } window.scrollTo(0, 0); });
        await p.waitForTimeout(1200);
        for (let i = 0; i < 4; i += 1) {
          const h = await p.evaluate(() => document.documentElement.scrollHeight);
          if (Math.abs(h - p.viewportSize().height) < 2) break;
          await p.setViewportSize({ width: w, height: h });
          await p.waitForTimeout(600);
        }
        const local = await p.evaluate(() => ({
          docH: document.documentElement.scrollHeight,
          grids: [...document.querySelectorAll('main .section.doc-row:not([hidden]) .doc-grid')].map((g) => {
            const b = g.getBoundingClientRect();
            return [Math.round(b.x), Math.round(b.y + window.scrollY), Math.round(b.width), Math.round(b.height)];
          }),
        }));
        const ref = (cap.sections || []).map((s) => s.grid?.rect).filter(Boolean);
        const diffs = ref.map((rr, i) => {
          const l = local.grids[i];
          if (!l) return { i, missing: true };
          return {
            i, dx: l[0] - rr[0], dy: l[1] - rr[1], dw: l[2] - rr[2], dh: l[3] - rr[3],
          };
        });
        // first section whose height differs by more than 2px (shift source)
        const firstBad = diffs.find((d) => d.missing || Math.abs(d.dh) > 2 || Math.abs(d.dw) > 2 || Math.abs(d.dx) > 2);
        results.push({
          path: r.path, w, docH: local.docH, refH: cap.docH, dH: local.docH - cap.docH, sections: ref.length, local: local.grids.length,
          maxDy: Math.max(0, ...diffs.filter((d) => !d.missing).map((d) => Math.abs(d.dy))),
          maxDh: Math.max(0, ...diffs.filter((d) => !d.missing).map((d) => Math.abs(d.dh))),
          firstBad: firstBad || null, sectionDiffs: diffs, bad: diffs.filter((d) => d.missing || Math.abs(d.dh) > 2 || Math.abs(d.dw) > 2 || Math.abs(d.dx) > 2).length, errs,
        });
        console.log(r.path, w, 'dH', local.docH - cap.docH, 'sections', ref.length, local.grids.length, 'bad', results[results.length - 1].bad, firstBad ? JSON.stringify(firstBad) : '');
      } catch (e) {
        results.push({ path: r.path, w, error: e.message.slice(0, 200) });
        console.log(r.path, w, 'ERROR', e.message.slice(0, 120));
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  await browser.close();
})();
