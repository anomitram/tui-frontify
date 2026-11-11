/* eslint-env browser */
/* eslint-disable max-len -- page.evaluate callbacks run in the browser */
/* Compare element positions (images, headings, paragraphs, buttons) of the local hub page with the
 * reference captured by capture-hub.mjs (<width>.styles.json). Mirrors the reference capture
 * (window grown to page height). Usage: PW_PATH=... node hub-compare-rects.js <localUrl> <captureDir> <width>
 * Optional IMAGE_MAP=<hubDir>/image-names.generated.json maps descriptive image names to Frontify ids. */
const fs = require('fs');
// eslint-disable-next-line import/no-dynamic-require
const { chromium } = require(process.env.PW_PATH);

(async () => {
  const [url, capDir, w] = process.argv.slice(2);
  const ref = JSON.parse(fs.readFileSync(`${capDir}/${w}.styles.json`, 'utf8')).els;
  const IMAGE_MAP = process.env.IMAGE_MAP ? JSON.parse(fs.readFileSync(process.env.IMAGE_MAP, 'utf8')) : {};
  const b = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const p = await (await b.newContext({ viewport: { width: Number(w), height: 900 } })).newPage();
  // The local preview serves pages without a doctype (quirks mode); Edge Delivery serves
  // <!DOCTYPE html>. Add it so measurements match production layout.
  await p.route((u) => u.pathname === new URL(url).pathname, async (r) => {
    const res = await r.fetch();
    const body = await res.text();
    await r.fulfill({ response: res, body: body.trimStart().toLowerCase().startsWith('<!doctype') ? body : `<!DOCTYPE html>\n${body}` });
  });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(1200);
  for (let i = 0; i < 4; i += 1) {
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    if (Math.abs(h - p.viewportSize().height) < 2) break;
    await p.setViewportSize({ width: Number(w), height: h });
    await p.waitForTimeout(700);
  }
  const loc = await p.evaluate(() => {
    const R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + window.scrollY), Math.round(r.width), Math.round(r.height)]; };
    const pick = (sel) => [...document.querySelectorAll(`main ${sel}`)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ text: (e.innerText || '').trim().slice(0, 40), src: (e.currentSrc || e.getAttribute('src') || '').split('/').pop(), rect: R(e) }));
    return {
      img: pick('img'), h2: pick('h2'), h3: pick('h3'), h4: pick('h4'), p: pick('p:not(.button-wrapper)'), btn: pick('a.button'),
    };
  });
  const norm = (t) => (t || '').replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  const rows = [];
  for (const [k, refKey] of [['img', 'img'], ['h2', 'h2'], ['h3', 'h3'], ['h4', 'h4'], ['p', 'p'], ['btn', '.btn']]) {
    const r = (ref[refKey] || []).filter((e) => e.rect[2] > 0 && (k !== 'img' || /ffycdn|assets/.test(e.src) || e.src.includes('/tui/')));
    const l = loc[k];
    const seen = {};
    const same = (s1, s2) => { const x = norm(s1); const y = norm(s2); return x && y && (x.startsWith(y) || y.startsWith(x)); };
    l.forEach((le, i) => {
      let re;
      if (k === 'img') {
        // local images have descriptive names: map them back to the Frontify file id
        // (IMAGE_MAP = <hubDir>/image-names.generated.json); preview/live rename images to media_*,
        // so fall back to document order
        const base = le.src.split('?')[0];
        const ent = Object.values(IMAGE_MAP).find((m) => m.path && m.path.split('/').pop() === base);
        const id = ent && ent.frontify_file ? ent.frontify_file.split('.')[0] : base.split('.')[0];
        re = r.find((x) => x.src.includes(id)) || (base.startsWith('media_') || !ent ? r[i] : null);
      }
      else {
        // k-th element with the same (prefix-matched) text
        const key = norm(le.text);
        seen[key] = (seen[key] || 0) + 1;
        re = r.filter((x) => same(x.text, le.text))[seen[key] - 1] || r[i];
      }
      if (!re) { rows.push([k, norm(le.text || le.src).slice(0, 30), 'no reference', le.rect]); return; }
      const d = le.rect.map((v, j) => v - re.rect[j]);
      rows.push([k, norm(le.text || le.src).slice(0, 30), d.join(','), `ref ${re.rect.join(',')}`]);
    });
  }
  rows.forEach((r) => console.log(r.join(' | ')));
  await b.close();
})();
