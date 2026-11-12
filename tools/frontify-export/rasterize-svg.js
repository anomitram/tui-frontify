/* eslint-disable max-len, object-curly-newline -- page.evaluate callbacks run in the browser */
/* Rasterize an SVG to PNG with Chromium (for SVGs above Edge Delivery's 40 KB content limit).
 * The PNG keeps the SVG's aspect ratio at the given pixel width; transparent background.
 * Usage: PW_PATH=... node rasterize-svg.js <in.svg> <out.png> [width=2000] */
const fs = require('fs');
// eslint-disable-next-line import/no-dynamic-require
const { chromium } = require(process.env.PW_PATH);

const [input, output, widthArg = '2000'] = process.argv.slice(2);
(async () => {
  const svg = fs.readFileSync(input, 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<html><body style="margin:0;background:transparent"><img id="i" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
  // eslint-disable-next-line no-undef -- runs in the browser
  const { w, h } = await page.evaluate(() => { const i = document.getElementById('i'); return { w: i.naturalWidth, h: i.naturalHeight }; });
  const width = Number(widthArg);
  const height = Math.round((width * h) / w);
  await page.setViewportSize({ width, height });
  // eslint-disable-next-line no-undef -- runs in the browser
  await page.evaluate(({ width: wd, height: ht }) => { const i = document.getElementById('i'); i.style.width = `${wd}px`; i.style.height = `${ht}px`; i.style.display = 'block'; }, { width, height });
  await page.screenshot({ path: output, omitBackground: true, clip: { x: 0, y: 0, width, height } });
  await browser.close();
  console.log('rasterized', input, `${w}x${h}`, '->', output, `${width}x${height}`, fs.statSync(output).size, 'bytes');
})();
