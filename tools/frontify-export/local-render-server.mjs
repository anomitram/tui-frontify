/* eslint-disable max-len */
/* Offline stand-in for the local preview when it cannot render pages (e.g. the site is protected
 * and the preview asks for a sign-in): serves the repo code and renders /content/<path>.html from
 * content/<path>.plain.html the way Edge Delivery does - head.html in <head>, the Metadata block as
 * <meta> tags (Title -> <title>), <header></header><main>...</main><footer></footer>.
 * Everything else (/content/*.plain.html fragments, images, code) is served as a file.
 * Only for local verification; nothing is fetched from anywhere.
 * Usage: node local-render-server.mjs [port=3001] */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// CODE_ROOT: serve the code (scripts, styles, blocks, head.html) from another checkout, e.g. a
// worktree of the last commit, with this repo's content - for before/after comparisons
const ROOT = process.env.CODE_ROOT ? path.resolve(process.env.CODE_ROOT) : REPO;
const PORT = Number(process.argv[2] || 3001);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
};
const toClassName = (n) => String(n).toLowerCase().replace(/[^0-9a-z]/gi, '-').replace(/-+/g, '-')
  .replace(/^-|-$/g, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();

async function render(file) {
  let body = await readFile(file, 'utf8');
  const head = await readFile(path.join(ROOT, 'head.html'), 'utf8');
  const metas = [];
  let title = '';
  const start = body.indexOf('<div class="metadata">');
  if (start >= 0) {
    // the metadata block is the last block of the last section: rows of <div><div>Key</div><div>Value</div></div>
    const block = body.slice(start);
    for (const r of block.matchAll(/<div><div>([\s\S]*?)<\/div><div>([\s\S]*?)<\/div><\/div>/g)) {
      const key = text(r[1]);
      const val = text(r[2]);
      if (key.toLowerCase() === 'title') title = val;
      else metas.push(`<meta name="${esc(toClassName(key))}" content="${esc(val)}">`);
    }
    body = `${body.slice(0, start)}</div>`; // close the last section
  }
  return `<!DOCTYPE html>\n<html><head><title>${esc(title)}</title>${metas.join('')}${head}</head><body><header></header><main>${body}</main><footer></footer></body></html>`;
}

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index';
    if (p.startsWith('/content/') && (p.endsWith('.html') && !p.endsWith('.plain.html'))) {
      const plain = path.join(REPO, `${p.slice(0, -5)}.plain.html`);
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      res.end(await render(plain));
      return;
    }
    if (p.startsWith('/content/') && !path.extname(p)) {
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      res.end(await render(path.join(REPO, `${p}.plain.html`)));
      return;
    }
    let f = path.join(p.startsWith('/content/') ? REPO : ROOT, p);
    if (!f.startsWith(ROOT) && !f.startsWith(REPO)) throw new Error('outside');
    // like the preview: content files (images, fragments) also answer at the site root
    f = await stat(f).then(() => f, () => path.join(REPO, 'content', p));
    await stat(f);
    res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    res.end(await readFile(f));
  } catch (e) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`local render server on ${PORT}`));
