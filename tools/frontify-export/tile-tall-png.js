/* Split PNGs taller than ImageMagick's limit into 8000px tiles using Chromium.
 * Usage: PW_PATH=... node tile-tall-png.js <png> [<png> ...]  -> <dir>/<name>-tiles/NN.png */
const fs = require('fs');
const path = require('path');

// eslint-disable-next-line import/no-dynamic-require
const { chromium } = require(process.env.PW_PATH);
const TILE = 8000;
(async () => {
  const browser = await chromium.launch();
  for (const file of process.argv.slice(2)) {
    const buf = fs.readFileSync(file);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const outDir = path.join(path.dirname(file), `${path.basename(file, '.png')}-tiles`);
    fs.mkdirSync(outDir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    await page.setContent(`<html><body style="margin:0"><img id="i" style="display:block" src="${dataUrl}"></body></html>`);
    // eslint-disable-next-line no-undef -- runs in the browser
    await page.waitForFunction(() => document.getElementById('i').complete);
    for (let y = 0, n = 0; y < h; y += TILE, n += 1) {
      await page.screenshot({
        path: path.join(outDir, `${String(n).padStart(2, '0')}.png`),
        fullPage: true,
        clip: {
          x: 0, y, width: w, height: Math.min(TILE, h - y),
        },
      });
    }
    await page.close();
    console.log('tiled', file, w, h);
  }
  await browser.close();
})();
