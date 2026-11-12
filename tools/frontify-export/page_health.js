/* eslint-env browser */
/* eslint-disable max-len, object-curly-newline -- page.evaluate callbacks run in the browser */
/* Functional check of a published page (preview/live) against the local page: every image loaded,
 * links (href list) and image alt texts equal to the local page, header/footer links, console errors,
 * failed requests, and runtime requests to Frontify hosts. Goes through the workspace proxy (auth).
 * Usage: PW_PATH=... PROXY_SPKI=... HTTPS_PROXY=... node page_health.js <remoteUrl> <localUrl> [width]
 * Prints JSON; "ok" is true when nothing differs. */
const { chromium } = require(process.env.PW_PATH);

async function grab(b, url, width, remote) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(20000);
  const errors = []; const failed = []; const frontify = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  p.on('pageerror', (e) => errors.push(`pageerror ${e.message.slice(0, 160)}`));
  p.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 140)}`));
  p.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('request', (r) => { if (/(^|\.)(frontify\.com|ffycdn\.net|tui-brandhub\.com)$/.test(new URL(r.url()).hostname)) frontify.push(r.url().slice(0, 140)); });
  const res = await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  // scroll through so lazy images load
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => { setTimeout(r, 120); }); } window.scrollTo(0, 0); });
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const data = await p.evaluate((isRemote) => {
    const norm = (h) => {
      if (!h) return h;
      const u = new URL(h, window.location.href);
      if (u.origin === window.location.origin) return (u.pathname.replace(/^\/content(?=\/)/, '') || '/') + u.hash;
      return u.href;
    };
    const imgs = [...document.querySelectorAll('main img, header img, footer img')];
    return {
      status: document.title,
      title: document.title,
      images: imgs.length,
      // only images that are displayed (icons in closed menus are never loaded)
      broken: imgs.filter((i) => i.getClientRects().length && getComputedStyle(i).visibility !== 'hidden' && !(i.complete && i.naturalWidth > 0)).map((i) => (i.currentSrc || i.src).split('/').pop().slice(0, 60)),
      alts: imgs.filter((i) => i.closest('main')).map((i) => i.alt),
      links: [...document.querySelectorAll('main a[href]')].map((a) => norm(a.getAttribute('href'))),
      header: [...document.querySelectorAll('header a[href]')].map((a) => `${(a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 20)} -> ${norm(a.getAttribute('href'))}`),
      footer: [...document.querySelectorAll('footer a[href]')].map((a) => `${a.textContent.trim()} -> ${norm(a.getAttribute('href'))}`),
      cells: document.querySelectorAll('.hub-cell').length,
      height: document.documentElement.scrollHeight,
      remote: isRemote,
    };
  }, remote);
  await ctx.close();
  return { http: res.status(), ...data, errors, failed: [...new Set(failed)], frontify: [...new Set(frontify)] };
}

(async () => {
  const [remote, local, w] = process.argv.slice(2);
  const width = Number(w || 1440);
  const b = await chromium.launch({
    args: process.env.PROXY_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.PROXY_SPKI}`] : [],
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
  });
  const r = await grab(b, remote, width, true);
  const l = await grab(b, local, width, false);
  await b.close();
  const diff = (a, c) => a.filter((x, i) => x !== c[i]).length + Math.abs(a.length - c.length);
  const out = {
    url: remote,
    width,
    http: r.http,
    title_same: r.title === l.title,
    cells: [r.cells, l.cells],
    images: [r.images, l.images],
    broken_remote: r.broken,
    alt_diffs: diff(r.alts, l.alts),
    link_diffs: diff(r.links, l.links),
    link_examples: r.links.map((x, i) => (x !== l.links[i] ? `${x} != ${l.links[i]}` : null)).filter(Boolean).slice(0, 5),
    header_same: JSON.stringify(r.header) === JSON.stringify(l.header),
    header: r.header,
    header_local: l.header,
    broken_local: l.broken,
    footer_same: JSON.stringify(r.footer) === JSON.stringify(l.footer),
    height: [r.height, l.height],
    console_errors: r.errors,
    failed_requests: r.failed,
    frontify_runtime_requests: r.frontify,
  };
  out.ok = out.http === 200 && out.title_same && r.cells === l.cells && r.images === l.images && !r.broken.length
    && !out.alt_diffs && !out.link_diffs && out.header_same && out.footer_same && !r.errors.length && !r.failed.length
    && !r.frontify.length;
  console.log(JSON.stringify(out, null, 1));
})();
