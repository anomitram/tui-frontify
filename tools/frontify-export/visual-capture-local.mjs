/* Screenshot every migrated page in the local preview (desktop 1440 + mobile 390), full length,
 * with scrollbars rendered like the reference capture. One page at a time.
 * Usage: PW_PATH=... node visual-capture-local.mjs <frontifyDir> <outDir> [pageId,...] */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const [fdir, outDir, only] = process.argv.slice(2);
const nav = JSON.parse(await readFile(path.join(fdir, 'raw', 'navigation.json'))).data;
const pages = [];
for (const n of nav) {
  const t = n.translations.default;
  if (n.type === 'page_category') (n.children || []).filter((c) => c.type === 'page').forEach((c) => pages.push({ id: c.id, path: `/${t.slug}/${c.translations.default.slug}` }));
  else if (n.type === 'page') pages.push({ id: n.id, path: `/${t.slug}` });
}
const wanted = only ? pages.filter((p) => only.split(',').includes(String(p.id))) : pages;
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
for (const pg of wanted) {
  await mkdir(path.join(outDir, String(pg.id)), { recursive: true });
  for (const [vp, width] of [['desktop', 1440], ['mobile', 390]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    try {
      await page.goto(`http://localhost:3000/content${pg.path}`, { waitUntil: 'networkidle', timeout: 90000 });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => { setTimeout(r, 100); });
        }
        window.scrollTo(0, 0);
        document.querySelector('.go-to-top')?.remove();
      });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, String(pg.id), `${vp}.png`), fullPage: true, timeout: 120000 });
    } catch (e) {
      console.error('FAIL', pg.id, vp, e.message.split('\n')[0]);
    }
    await ctx.close();
  }
  console.log('shot', pg.id, pg.path);
}
await browser.close();
