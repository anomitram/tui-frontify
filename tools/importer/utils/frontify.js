/* eslint-disable no-use-before-define */
/* Shared helpers for importing Frontify (TUI Brand Hub) guideline pages. */

// Source host and document id come from the import payload (ctx.host / ctx.docId).

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Frontify stores some text HTML-escaped inside Slate JSON (e.g. "d&#039;accord").
export const decodeEntities = (s) => String(s)
  .replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ');

/**
 * Rewrite a link found in source content to the migrated structure.
 * Returns { href, kind } where kind is internal | external | out-of-scope | email.
 */
export function rewriteLink(url, ctx) {
  if (!url) return { href: url, kind: 'empty' };
  let u = url.trim();
  // Source bug: "https://ci-support@tui-brandhub.com" was meant as an e-mail address.
  const mailLike = /^https?:\/\/([^/@\s]+@[^/\s]+\.[a-z]{2,})\/?$/i.exec(u);
  if (mailLike) return { href: `mailto:${mailLike[1]}`, kind: 'email', fixed: true };
  const HOST = ctx.host;
  if (u.startsWith('/')) u = HOST + u;
  let parsed;
  try { parsed = new URL(u); } catch (e) { return { href: url, kind: 'external' }; }
  if (parsed.host !== new URL(HOST).host) return { href: url, kind: 'external' };
  // permanent links
  if (parsed.pathname.startsWith('/r/')) {
    const target = ctx.permalinks[parsed.pathname];
    if (target) return { href: target, kind: 'internal' };
    return { href: u, kind: 'out-of-scope' };
  }
  const m = /^\/document\/(\d+)\/?$/.exec(parsed.pathname);
  if (m && m[1] === String(ctx.docId)) {
    const hash = parsed.hash.replace(/^#\/?/, '');
    if (!hash) return { href: ctx.firstPath, kind: 'internal' };
    const [cat, slug, heading] = hash.split('/');
    const page = ctx.order.find((p) => (p.cat || '-') === cat && p.slug === slug);
    if (page) return { href: heading ? `${page.path}#${heading}` : page.path, kind: 'internal' };
    return { href: u, kind: 'out-of-scope' };
  }
  return { href: u, kind: 'out-of-scope' };
}

const BLOCK_TAGS = {
  p: 'p',
  heading1: 'h1',
  heading2: 'h2',
  heading3: 'h3',
  heading4: 'h4',
  custom1: 'h5',
  custom2: 'h6',
  custom3: 'p',
  quote: 'blockquote',
  imageTitle: 'p',
  imageCaption: 'p',
};

/**
 * Convert Frontify Slate JSON (string or array) to HTML.
 * Empty paragraphs are kept as spacer paragraphs (Frontify uses them for spacing).
 */
export function slateToHtml(value, ctx, opts = {}) {
  let nodes = value;
  if (typeof value === 'string') {
    if (!value.trim().startsWith('[')) return value; // already HTML
    try { nodes = JSON.parse(value); } catch (e) { return esc(value); }
  }
  if (!Array.isArray(nodes)) return '';
  const out = nodes.map((n) => blockNode(n, ctx, opts)).join('');
  return out;
}

export function slateIsEmpty(value) {
  if (!value) return true;
  let nodes = value;
  if (typeof value === 'string') {
    try { nodes = JSON.parse(value); } catch (e) { return !value.trim(); }
  }
  const text = (n) => (n.text || '') + (n.children || []).map(text).join('');
  return !(nodes || []).some((n) => text(n).trim() || n.type === 'button' || (n.children || []).some((c) => c.type === 'a' || c.type === 'button'));
}

// Markdown trims whitespace inside inline tags, so keep edge spaces outside of them.
function wrapKeepSpaces(open, inner, close) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
  if (!m[2]) return inner;
  return `${m[1]}${open}${m[2]}${close}${m[3]}`;
}

function inline(nodes, ctx) {
  return (nodes || []).map((n) => {
    if ((n.type === 'a' || n.type === 'link') && (!n.url || n.url === 'null')) {
      // Source bug: link without a target. E-mail-looking text becomes a mailto link.
      const label = inline(n.children, ctx);
      const plain = label.replace(/<[^>]+>/g, '').trim();
      if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(plain)) {
        ctx.links?.push({
          source: String(n.url), href: `mailto:${plain}`, kind: 'email', fixed: true,
        });
        return `<a href="mailto:${esc(plain)}">${label}</a>`;
      }
      ctx.notes?.push(`Link without target dropped (text kept): ${plain}`);
      return label;
    }
    if (n.type === 'a' || n.type === 'link') {
      const { href, kind } = rewriteLink(n.url, ctx);
      ctx.links?.push({ source: n.url, href, kind });
      const target = n.target === '_blank' ? ' target="_blank"' : '';
      return wrapKeepSpaces(`<a href="${esc(href)}"${target}>`, inline(n.children, ctx), '</a>');
    }
    if (n.type === 'button') {
      const { href, kind } = rewriteLink(n.url, ctx);
      ctx.links?.push({ source: n.url, href, kind });
      return wrapKeepSpaces(`<strong><a href="${esc(href)}">`, inline(n.children, ctx), '</a></strong>');
    }
    if (n.children) return inline(n.children, ctx);
    let t = esc(decodeEntities(n.text || '')).replace(/\n/g, '<br>');
    if (!t) return '';
    if (n.code) t = wrapKeepSpaces('<code>', t, '</code>');
    if (n.underline) t = wrapKeepSpaces('<u>', t, '</u>');
    if (n.strikethrough) t = wrapKeepSpaces('<s>', t, '</s>');
    if (n.italic) t = wrapKeepSpaces('<em>', t, '</em>');
    if (n.bold) t = wrapKeepSpaces('<strong>', t, '</strong>');
    if (n.superscript) t = wrapKeepSpaces('<sup>', t, '</sup>');
    if (n.subscript) t = wrapKeepSpaces('<sub>', t, '</sub>');
    return t;
  }).join('');
}

function listItems(n, ctx) {
  return (n.children || []).map((li) => {
    const parts = (li.children || []).map((c) => {
      if (c.type === 'lic') return inline(c.children, ctx);
      if (c.type === 'ul' || c.type === 'ol') return `<${c.type}>${listItems(c, ctx)}</${c.type}>`;
      return inline([c], ctx);
    });
    return `<li>${parts.join('')}</li>`;
  }).join('');
}

function blockNode(n, ctx, opts) {
  if (n.type === 'ul' || n.type === 'ol') return `<${n.type}>${listItems(n, ctx)}</${n.type}>`;
  const tag = BLOCK_TAGS[n.type] || 'p';
  const body = inline(n.children, ctx);
  if (!body.replace(/<br>/g, '').trim()) {
    return opts.keepEmpty === false ? '' : '<p>\u200B</p>'; // Frontify spacer paragraph (zero-width space survives html2md)
  }
  // A trailing line break renders as an extra blank line in Frontify; keep it with a zero-width space.
  const kept = body.endsWith('<br>') ? `${body}\u200B` : body;
  return `<${tag}>${kept}</${tag}>`;
}

/** Sanitize the small HTML subset Frontify stores for annotations. */
export function cleanHtml(html, ctx) {
  const tpl = ctx.document.createElement('div');
  tpl.innerHTML = html || '';
  tpl.querySelectorAll('br.softbreak').forEach((br) => br.replaceWith(ctx.document.createElement('br')));
  tpl.querySelectorAll('a[href]').forEach((a) => {
    const { href, kind } = rewriteLink(a.getAttribute('href'), ctx);
    ctx.links?.push({ source: a.getAttribute('href'), href, kind });
    a.setAttribute('href', href);
  });
  tpl.querySelectorAll('[style],[class]').forEach((el) => { el.removeAttribute('style'); el.removeAttribute('class'); });
  return tpl.innerHTML;
}

export function rgbaToCss(c) {
  if (!c) return '';
  const a = c.alpha ?? c.a ?? 1;
  return `rgba(${c.red ?? c.r}, ${c.green ?? c.g}, ${c.blue ?? c.b}, ${a})`;
}

/** Build an <img> for an asset key, using the downloaded local copy. */
export function img(ctx, key, alt, { width, height, title } = {}) {
  // Non-web formats (PDF/AI) display Frontify's PNG rendition; the original stays downloadable.
  const preview = key.startsWith('asset-') ? ctx.assets[`preview-${key.slice(6)}`] : null;
  const src = preview || ctx.assets[key];
  if (!src) { ctx.missing.push(key); return null; }
  const el = ctx.document.createElement('img');
  el.src = src;
  el.alt = alt || '';
  if (title) el.title = title;
  if (width) el.setAttribute('width', width);
  if (height) el.setAttribute('height', height);
  return el;
}

export function link(ctx, href, text) {
  const a = ctx.document.createElement('a');
  a.href = href;
  a.textContent = text;
  return a;
}

export function frag(ctx, html) {
  const d = ctx.document.createElement('div');
  d.innerHTML = html;
  return d;
}

export function block(ctx, name, rows) {
  return ctx.WebImporter.Blocks.createBlock(ctx.document, { name, cells: rows });
}

export const variants = (...v) => v.filter(Boolean).map((x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).join(', ');
