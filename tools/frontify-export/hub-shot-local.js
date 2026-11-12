/* eslint-env browser */
/* eslint-disable max-len -- page.evaluate callbacks run in the browser */
const { chromium } = require(process.env.PW_PATH);
(async () => {
  const [url, out, w] = process.argv.slice(2);
  // remote (protected) pages: go through the workspace proxy, which injects the site's auth header
  const b = await chromium.launch({
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: process.env.PROXY_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.PROXY_SPKI}`] : [],
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
  });
  const p = await (await b.newContext({ viewport: { width: Number(w), height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)); });
  // The local preview serves pages without a doctype (quirks mode); Edge Delivery serves
  // <!DOCTYPE html>. Add it so measurements match production layout.
  await p.route((u) => u.pathname === new URL(url).pathname, async (r) => {
    const res = await r.fetch();
    const body = await res.text();
    await r.fulfill({ response: res, body: body.trimStart().toLowerCase().startsWith('<!doctype') ? body : `<!DOCTYPE html>\n${body}` });
  });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } window.scrollTo(0, 0); document.querySelector('.go-to-top')?.remove(); });
  await p.waitForTimeout(1500);
  // mirror the reference capture: the window grows to the page height (affects vh units)
  for (let i = 0; i < 4; i += 1) {
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    const cur = p.viewportSize().height;
    if (Math.abs(h - cur) < 2) break;
    await p.setViewportSize({ width: Number(w), height: h });
    await p.waitForTimeout(700);
  }
  await p.screenshot({ path: out, fullPage: true });
  console.log(JSON.stringify(errs.slice(0, 8)));
  await b.close();
})();
