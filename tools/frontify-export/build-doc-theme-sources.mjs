/* Build the offline import sources for multi-page Frontify documents in the new document theme
 * (colour schemes, column sections, sidebar), first used for The Mora portal 292 documents
 * Brand (1887), Hotels (1888), Support (1889) and Libraries Overview (1893). No requests to the source.
 * Input per document <base>/<id>/: raw/ (export.mjs), capture/<pageId>/ (capture-doc-pages.mjs),
 * schemes/<pageId>.json (extract_section_schemes.py), assets/manifest.json (assets.mjs).
 * Shared: <base>/permalinks.json (resolve-permalinks.mjs output for /r/ tokens not in the export).
 * Steps:
 * 1. Paths: <prefix>/<category-slug>/<page-slug> (uncategorised: <prefix>/<page-slug>), Frontify
 *    slugs kept exactly. Writes <base>/<id>/redirect-map.json (doc root, permalinks, hash routes,
 *    heading anchors) - read by migrated-targets.mjs (frontify.config.json "migrated.documents").
 * 2. Per page: links resolved once (export permalinks, permalinks.json, migrated targets, else the
 *    absolute Frontify URL); images copied to content/assets/<route>/<doc>/<page>/<name>.<ext>
 *    (name: <base>/<id>/image-names.json override, else the image label - title, alt, card text -
 *    else the original file name); colours from the capture (getColorBlockColors); schemes.
 * 3. Writes <srcDir>/<doc>/<cat>/<page>.html (rendered text + JSON payload), <srcDir>/urls.txt,
 *    <base>/link-map.json/.csv, <base>/image-names.generated.json, <base>/schemes.generated.css.
 * Usage: [SOURCE_PORT=8095] node build-doc-theme-sources.mjs <base> <srcDir> <contentDir> <route>
 *          <docId>=<prefix> [<docId>=<prefix> ...]
 *   e.g. ... migration-work/frontify-mora migration-work/frontify-mora/source-pages content the-mora
 *          1887=/the-mora/brand 1888=/the-mora/hotels 1889=/the-mora/support 1893=/the-mora/libraries */
import {
  mkdir, readFile, writeFile, copyFile, access,
} from 'node:fs/promises';
import path from 'node:path';
import CFG from './config.mjs';

const [base, srcDir, contentDir, route, ...docArgs] = process.argv.slice(2);
const PORT = process.env.SOURCE_PORT || 8095;
const HOST = CFG.host;
const exists = (f) => access(f).then(() => true, () => false);
const readJson = async (f, dflt) => {
  if (!(await exists(f))) { if (dflt !== undefined) return dflt; throw new Error(`missing ${f}`); }
  return JSON.parse(await readFile(f, 'utf8'));
};
const slug = (t) => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60)
  .replace(/-+$/, '');
const slateText = (v) => {
  try {
    const n = typeof v === 'string' ? JSON.parse(v) : v;
    const t = (x) => (x.text || '') + (x.children || []).map(t).join(' ');
    return (Array.isArray(n) ? n : []).map(t).join(' ').replace(/\s+/g, ' ').trim();
  } catch (e) { return ''; }
};
const SERVABLE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf', 'mp4']);
const MONTHS = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};
// signed or tokenised values never go into a source page
const SECRET_KEYS = new Set(['token', 'download_url', 'license_token', 'file_origin_url', 'signed_url', 'reference_token']);
function scrub(o) {
  if (Array.isArray(o)) return o.map(scrub);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) if (!SECRET_KEYS.has(k)) out[k] = scrub(v);
    return out;
  }
  if (typeof o === 'string' && /[?&](X-Amz-|Signature=|Expires=|token=)/.test(o)) return o.replace(/\?.*$/, '');
  return o;
}

const docs = [];
for (const a of docArgs) {
  const [id, prefix] = a.split('=');
  const dir = path.join(base, id);
  const raw = (f, d) => readJson(path.join(dir, 'raw', f), d);
  const doc = (await raw('document.json')).data;
  const nav = (await raw('navigation.json')).data;
  const pagesMeta = new Map((await raw('pages.json')).data.map((p) => [p.id, p]));
  docs.push({
    id: Number(id), prefix, dir, doc, nav, pagesMeta, raw,
  });
}

// ---- 1. paths, sidebar data, redirect maps ----
const permaToUrl = {}; // "/r/<token>" -> Frontify URL (from the export)
for (const d of docs) {
  const order = [];
  const categories = [];
  const head = (c) => (c.children || []).filter((h) => h.type === 'page_heading')
    .map((h) => ({ id: h.id, title: h.translations.default.title, slug: h.translations.default.slug }));
  for (const n of d.nav) {
    const tr = n.translations.default;
    if (n.type === 'page_category') {
      const cat = { title: tr.title, slug: tr.slug, pages: [] };
      categories.push(cat);
      for (const c of (n.children || []).filter((x) => x.type === 'page')) {
        const ct = c.translations.default;
        const pg = {
          id: c.id, title: ct.title, slug: ct.slug, cat: tr.slug, catTitle: tr.title, path: `${d.prefix}/${tr.slug}/${ct.slug}`,
          hidden: !!c.is_hidden_in_navigation, published: c.is_published !== false, headings: head(c),
          frontifyUrl: `${HOST}/document/${d.id}#/${tr.slug}/${ct.slug}`,
        };
        cat.pages.push(pg);
        order.push(pg);
      }
    } else if (n.type === 'page') {
      const pg = {
        id: n.id, title: tr.title, slug: tr.slug, cat: null, catTitle: null, path: `${d.prefix}/${tr.slug}`,
        hidden: !!n.is_hidden_in_navigation, published: n.is_published !== false, headings: head(n),
        frontifyUrl: `${HOST}/document/${d.id}#/-/${tr.slug}`,
      };
      categories.push({ title: null, pages: [pg], uncategorized: true });
      order.push(pg);
    }
  }
  const visible = order.filter((p) => p.published && !p.hidden);
  Object.assign(d, { order, categories, visible });
  const redirects = [{ from: `${HOST}/document/${d.id}`, to: d.prefix, type: 'document root' }];
  if (d.doc.permanent_link) {
    redirects.push({ from: HOST + d.doc.permanent_link, to: d.prefix, type: 'document permanent link' });
    permaToUrl[d.doc.permanent_link] = `${HOST}/document/${d.id}`;
  }
  for (const pg of order) {
    redirects.push({ from: pg.frontifyUrl, to: pg.path, type: 'page (hash route)', page_id: pg.id });
    const pm = d.pagesMeta.get(pg.id) || {};
    if (pm.permanent_link) {
      redirects.push({ from: HOST + pm.permanent_link, to: pg.path, type: 'page permanent link', page_id: pg.id });
      permaToUrl[pm.permanent_link] = pg.frontifyUrl;
    }
    const { page } = await d.raw(`pages/${pg.id}.json`);
    pg.page = page;
    for (const s of page.sections) {
      for (const b of s.content) {
        if (b.display_name || !b.slug) continue;
        redirects.push({ from: `${pg.frontifyUrl}#${b.slug}`, to: `${pg.path}#${b.slug}`, type: 'heading anchor', page_id: pg.id });
        if (b.permanent_link) {
          redirects.push({ from: HOST + b.permanent_link, to: `${pg.path}#${b.slug}`, type: 'heading permanent link', page_id: pg.id });
          permaToUrl[b.permanent_link] = `${pg.frontifyUrl}/${b.slug}`;
        }
      }
    }
  }
  await writeFile(path.join(d.dir, 'redirect-map.json'), JSON.stringify(redirects, null, 1));
}

// migrated-targets.mjs reads the redirect maps written above, so load it only now
const { migratedPath, normalise } = await import('./migrated-targets.mjs');
const resolved = await readJson(path.join(base, 'permalinks.json'), []);
for (const p of resolved) if (p.target && !permaToUrl[p.link]) permaToUrl[p.link] = p.target;

// ---- 2. per page ----
const linkMap = {};
const linkUses = {};
const unresolved = new Set();
function finalHref(url, where, label) {
  if (!url || typeof url !== 'string') return url;
  const src = url.trim();
  if (/^(mailto:|tel:|#)/i.test(src)) return src;
  let target = src;
  const rp = /^(?:https?:\/\/[^/]+)?(\/r\/[^?#\s]+)/.exec(src);
  if (rp && (!/^https?:/.test(src) || src.startsWith(HOST))) {
    if (permaToUrl[rp[1]]) target = permaToUrl[rp[1]];
    else { unresolved.add(rp[1]); target = HOST + rp[1]; }
  } else if (src.startsWith('/')) target = HOST + src;
  const local = migratedPath(target);
  const href = local || normalise(target);
  linkMap[src] = href;
  linkMap[href] = href; // the importer looks up the already rewritten href
  (linkUses[src] = linkUses[src] || []).push({ where, label });
  return href;
}
function rewrite(o, where) {
  if (Array.isArray(o)) return o.map((x) => rewrite(x, where));
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && v.trim().startsWith('[') && /"(url|href|link)"/.test(v)) {
        try { out[k] = JSON.stringify(rewrite(JSON.parse(v), where)); continue; } catch (e) { /* not JSON */ }
      }
      if (typeof v === 'string' && /<a\s[^>]*href=/i.test(v)) {
        out[k] = v.replace(/(<a\s[^>]*href=")([^"]+)(")/gi, (m0, a, h, c) => `${a}${finalHref(h.replace(/&amp;/g, '&'), where, '')}${c}`);
        continue;
      }
      if ((k === 'url' || k === 'href' || k === 'link') && typeof v === 'string' && v) {
        out[k] = finalHref(v, where, slateText(o.children) || o.altText || '');
      } else out[k] = rewrite(v, where);
    }
    return out;
  }
  return o;
}

/** Labels of the images a block uses: asset id -> descriptive label. */
function imageLabels(b) {
  const labels = {};
  const st = b.settings || {};
  const pick = (o) => {
    if (!o || typeof o !== 'object') return '';
    const cands = [o.altText, o.alt, typeof o.title === 'string' && !o.title.startsWith('[') ? o.title : slateText(o.title),
      slateText(o.name), o.videoTitle, typeof o.caption === 'string' ? o.caption : '', slateText(o.description),
      slateText(o.body), slateText(o.front?.title), slateText(o.front?.text)];
    return cands.map((c) => String(c || '').trim()).find((c) => c && !/^(image|untitled|screenshot)/i.test(c)) || '';
  };
  // settings items whose id keys an entry of b.assets (Cards Grid, Do & Don't, Flip Card, Slider ...)
  const byId = {};
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (o.id != null) byId[String(o.id)] = o;
    Object.values(o).forEach(walk);
  }(st));
  for (const [k, list] of Object.entries(b.assets || {})) {
    const idKey = k.replace(/^.*?_(?=[\w-]+$)/, '');
    const item = byId[k] || byId[idKey] || Object.values(byId).find((x) => k.endsWith(String(x.id)));
    for (const a of list || []) {
      const blockLabel = b.display_name === 'Image' ? pick({ ...st, title: st.name }) : '';
      labels[a.id] = { label: pick(item) || blockLabel || pick(a) || '', alt: item?.altText || item?.alt || st.altText || a.alternative_text || '' };
    }
  }
  // legacy blocks: asset_data inside settings (Annotations, Image grid items, Video)
  (function walk(o, ctx) {
    if (Array.isArray(o)) { o.forEach((x) => walk(x, ctx)); return; }
    if (!o || typeof o !== 'object') return;
    if (o.asset_data?.id && !labels[o.asset_data.id]) {
      labels[o.asset_data.id] = { label: pick(o) || pick(ctx), alt: o.alt || o.caption || '' };
    }
    Object.values(o).forEach((v) => walk(v, o));
  }(st, st));
  return labels;
}

const used = new Set();
const imageNames = {};
const allSchemes = {};
const sources = [];
const report = [];
for (const d of docs) {
  const manifest = await readJson(path.join(d.dir, 'assets', 'manifest.json'), []);
  const byKey = new Map(manifest.filter((m) => m.file).map((m) => [m.key, m]));
  // <dir>/extra/extra-assets.json: files supplied by hand for assets the export cannot provide
  // (re-encoded video, template preview images): [{key, file, page?, label?, note}]
  const extras = await readJson(path.join(d.dir, 'extra', 'extra-assets.json'), []);
  for (const x of extras.filter((e) => e.key.startsWith('asset-'))) {
    byKey.set(x.key, { ...(manifest.find((m) => m.key === x.key) || {}), key: x.key, file: path.join('..', 'extra', x.file) });
  }
  const overrides = await readJson(path.join(d.dir, 'image-names.json'), {});
  const docSlug = d.prefix.split('/').pop();
  const flat = d.visible;
  for (const pg of d.order) {
    if (!pg.published) continue;
    const { page } = pg;
    const capDir = path.join(d.dir, 'capture', String(pg.id));
    const schemes = await readJson(path.join(d.dir, 'schemes', `${pg.id}.json`), { schemes: {}, sections: [], page: null });
    Object.assign(allSchemes, schemes.schemes);
    const where = `${pg.path}`;
    const sorted = [...page.sections].sort((a, b) => a.sort - b.sort);
    // tabbed section groups (same group_id, tab = label) render as one section in the capture
    const slotOf = [];
    let slot = -1;
    sorted.forEach((s, i) => {
      if (!s.group_id || sorted[i - 1]?.group_id !== s.group_id) slot += 1;
      slotOf.push(slot);
    });
    const sections = sorted.map((s, i) => ({
      ...rewrite(scrub(s), where), scheme: schemes.sections[slotOf[i]] || schemes.page,
    }));
    if (schemes.sections.length && schemes.sections.length !== slot + 1) {
      console.log('WARN section count differs from capture', pg.path, schemes.sections.length, 'vs', slot + 1);
    }
    // images used on this page
    const assets = {};
    const alts = {};
    const names = {};
    for (const s of page.sections) {
      for (const b of s.content) {
        for (const [aid, l] of Object.entries(imageLabels(b))) {
          const key = `asset-${aid}`;
          const m = byKey.get(key);
          if (!m || assets[key]) continue;
          // only types the site can serve go into content (zip, docx, ai ... stay on Frontify)
          if (!SERVABLE.has(path.extname(m.file).slice(1).toLowerCase())) continue;
          const o = overrides[key] || {};
          const ext = path.extname(m.file).toLowerCase();
          const orig = path.basename(m.file_name || m.file, path.extname(m.file_name || m.file));
          let baseName = slug(o.name || l.label || orig) || key;
          const dirRel = `assets/${route}/${docSlug}/${pg.cat ? `${pg.cat}-` : ''}${pg.slug}`;
          let rel = `${dirRel}/${baseName}${ext}`;
          if (used.has(rel)) {
            let k = 2;
            while (used.has(`${dirRel}/${baseName}-${k}${ext}`)) k += 1;
            baseName = `${baseName}-${k}`;
            rel = `${dirRel}/${baseName}${ext}`;
          }
          used.add(rel);
          await mkdir(path.dirname(path.join(contentDir, rel)), { recursive: true });
          const resized = path.join(d.dir, 'resized', rel);
          await copyFile((await exists(resized)) ? resized : path.join(d.dir, 'assets', m.file), path.join(contentDir, rel));
          assets[key] = `/${rel}`;
          alts[key] = 'alt' in o ? o.alt : l.alt;
          names[key] = m.file_name || path.basename(m.file);
          imageNames[key] = {
            path: `/${rel}`, alt: alts[key], frontify_file: m.file_name, label: l.label, source: o.name ? 'checked by hand' : (l.label ? 'label' : 'file name'),
          };
        }
      }
    }
    // page-specific extra files with their own keys (e.g. template-preview-<blockId>)
    for (const x of extras.filter((e) => !e.key.startsWith('asset-') && e.page === pg.id)) {
      const rel = `assets/${route}/${docSlug}/${pg.cat ? `${pg.cat}-` : ''}${pg.slug}/${slug(x.label || x.key)}${path.extname(x.file)}`;
      await mkdir(path.dirname(path.join(contentDir, rel)), { recursive: true });
      await copyFile(path.join(d.dir, 'extra', x.file), path.join(contentDir, rel));
      assets[x.key] = `/${rel}`;
      alts[x.key] = '';
      imageNames[x.key] = { path: `/${rel}`, alt: '', label: x.label, source: 'extra (by hand)' };
    }
    // missing images (in the page, not in the manifest)
    const missing = [];
    for (const s of page.sections) {
      for (const b of s.content) {
        for (const aid of Object.keys(imageLabels(b))) if (!assets[`asset-${aid}`]) missing.push(`asset-${aid} (${b.display_name} ${b.id})`);
      }
    }
    // colours (Colors blocks) and page header asset from the capture
    const api = await readJson(path.join(capDir, 'captured-api.json'), {});
    const colors = {};
    for (const g of api.getColorBlockColors || []) {
      for (const cb of g.body?.data?.brandEssentialsColorBlocksByIds?.brandEssentialsColorBlocks || []) {
        const cid = JSON.parse(Buffer.from(cb.id, 'base64').toString()).identifier;
        colors[cid] = cb.colors;
      }
    }
    const templateAsset = (api['template-asset']?.[0]?.body?.data || []).find((t) => t.setting_id === 'headerBackgroundImage');
    // per-page theme settings (overrides resolved by Frontify): pagination / sidebar visibility
    const resolved = api.GetDocumentPageThemeSettings?.[0]?.body?.data?.guidelinePage?.theme?.resolvedSettings || {};
    // last modified + tab title from the capture
    let rendered = '';
    let lastModified = null;
    let tabTitle = `${page.title} - ${d.doc.title} - The Mora brand home`;
    const capHtml = path.join(capDir, '1440.html');
    if (await exists(capHtml)) {
      const h = await readFile(capHtml, 'utf8');
      const lm = /Last modified on ([^<]+)</.exec(h);
      if (lm) lastModified = lm[1].trim();
      const t = /<title>([^<]*)<\/title>/.exec(h);
      if (t) tabTitle = t[1].replace(/&amp;/g, '&').trim();
      const mainM = /<main[\s\S]*?<\/main>/.exec(h);
      rendered = (mainM ? mainM[0] : '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<(img|video|source|iframe|link|audio)\b[^>]*>/gi, '')
        .replace(/\s(style|srcset|src|poster|class)="[^"]*"/gi, '');
    }
    const hist = page.history?.last_modified_localized;
    if (!lastModified && hist) {
      const m = /^\w+, (\d+)\. (\w+) (\d{4}) (\d{2}):(\d{2})$/.exec(hist);
      if (m) lastModified = `${MONTHS[m[2]]} ${Number(m[1])}, ${m[3]} at ${Number(m[4]) % 12 || 12}:${m[5]} ${Number(m[4]) < 12 ? 'AM' : 'PM'}`;
    }
    const idx = flat.indexOf(pg);
    const rel = `${docSlug}/${pg.cat || '-'}/${pg.slug}.html`;
    const payload = {
      host: HOST,
      route,
      pagePath: pg.path,
      originalUrl: pg.frontifyUrl,
      permanentLink: d.pagesMeta.get(pg.id)?.permanent_link ? HOST + d.pagesMeta.get(pg.id).permanent_link : null,
      doc: { id: d.id, title: d.doc.title, prefix: d.prefix },
      page: {
        id: page.id, title: page.title, slug: page.slug, cat: pg.cat, catTitle: pg.catTitle,
      },
      tabTitle,
      lastModified,
      sections,
      pageScheme: schemes.page,
      assets,
      alts,
      assetNames: names,
      linkMap,
      colors,
      headerImage: templateAsset ? templateAsset.asset?.id : null,
      prev: flat[idx - 1] ? { path: flat[idx - 1].path, title: flat[idx - 1].title, cat: flat[idx - 1].catTitle } : null,
      next: flat[idx + 1] ? { path: flat[idx + 1].path, title: flat[idx + 1].title, cat: flat[idx + 1].catTitle } : null,
      // Frontify shows no sidebar for a document with a single uncategorised page (measured, 1893)
      sidebarPath: resolved.sidebarVisibility === 'hide' || (flat.length <= 1 && d.categories.every((c) => c.uncategorized)) ? 'none' : `${d.prefix}/sidebar`,
      pagination: resolved.paginationVisibility || 'show',
      // chrome documents (sidebar, doc-root redirect) come with the first page of each document
      chrome: idx === 0 ? {
        categories: d.categories.map((c) => ({ ...c, pages: c.pages.map(({ page: _p, ...p }) => p) })),
        first: { path: flat[0].path, title: flat[0].title },
      } : null,
    };
    await mkdir(path.dirname(path.join(srcDir, rel)), { recursive: true });
    await writeFile(path.join(srcDir, rel), `<!doctype html><html><head><meta charset="utf-8"><title>${tabTitle.replace(/</g, '&lt;')}</title></head><body>${rendered || '<main></main>'}<script id="frontify-export" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script></body></html>`);
    sources.push(`http://localhost:${PORT}/${rel}`);
    report.push({
      doc: d.id, page: pg.id, path: pg.path, sections: sections.length, images: Object.keys(assets).length, missing: missing.length, captured: !!rendered, schemes: schemes.sections.length,
    });
    if (missing.length) console.log('missing images', pg.path, missing.join(', '));
  }
}

// ---- 3. outputs ----
await writeFile(path.join(srcDir, 'urls.txt'), `${sources.join('\n')}\n`);
await writeFile(path.join(base, 'image-names.generated.json'), JSON.stringify(imageNames, null, 1));
const schemeCss = Object.entries(allSchemes).map(([name, vars]) => `.${route} .${name} {\n${Object.entries(vars)
  .filter(([k]) => !k.includes('-list-'))
  .map(([k, v]) => `  ${k}: ${v.replace(/&quot;/g, '"')};`).join('\n')}\n}`);
await writeFile(path.join(base, 'schemes.generated.css'), `${schemeCss.join('\n\n')}\n`);
const lm = Object.entries(linkUses).map(([src, uses]) => ({
  source: src,
  target: linkMap[src],
  status: linkMap[src].startsWith('/') ? 'migrated' : 'out of scope (not migrated)',
  used_in: [...new Set(uses.map((u) => u.where))],
}));
await writeFile(path.join(base, 'link-map.json'), JSON.stringify(lm, null, 2));
await writeFile(path.join(base, 'link-map.csv'), `Old URL,Target,Status,Used in\n${lm.map((l) => [l.source, l.target, l.status, l.used_in.join(' / ')].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')}\n`);
await writeFile(path.join(base, 'build-report.json'), JSON.stringify(report, null, 1));
console.log('pages', report.length, 'images', Object.keys(imageNames).length, 'schemes', Object.keys(allSchemes).length,
  'links', lm.length, 'migrated', lm.filter((l) => l.status === 'migrated').length, 'unresolved /r/', unresolved.size,
  'pages without capture', report.filter((r) => !r.captured).length);
// input for resolve-permalinks.mjs (tokens only; no signed data)
await writeFile(path.join(base, 'unresolved-permalinks.json'), JSON.stringify([...unresolved], null, 1));
