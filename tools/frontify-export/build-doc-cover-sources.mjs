/* Build the offline import source for a single-page Frontify document shown as a cover page
 * (new document theme with colour schemes and column sections), e.g. The Mora brand home
 * (document 1896). No requests to the source.
 * - Resolves every link once: /r/ permalinks via raw/permalinks.json, migrated targets
 *   (migrated-targets.mjs) to local paths, everything else to the absolute Frontify URL.
 * - Copies images to content/assets/<route>/<descriptive-name>.<ext> (names: <dir>/image-names.json
 *   overrides, else the card label / image title / asset title) and the declared fonts to
 *   fonts/<route>-<family>-<weight>-<style>.<ext>.
 * - Writes <srcDir>/<route>.html (captured page text + JSON payload), urls.txt, link-map.json/.csv,
 *   image-names.generated.json and fonts.generated.css.
 * Usage: [PAGE_PATH=/the-mora] [SOURCE_PORT=8096] node build-doc-cover-sources.mjs <dir> <srcDir> <contentDir> <route> */
import {
  mkdir, readFile, writeFile, copyFile, access,
} from 'node:fs/promises';
import path from 'node:path';
import CFG from './config.mjs';
import { migratedPath, normalise } from './migrated-targets.mjs';

const [dir, srcDir, contentDir, route] = process.argv.slice(2);
const PAGE_PATH = process.env.PAGE_PATH || `/${route}`;
const PORT = process.env.SOURCE_PORT || 8096;
const exists = (f) => access(f).then(() => true, () => false);
const raw = async (f, dflt) => {
  const p = path.join(dir, 'raw', f);
  if (!(await exists(p))) { if (dflt !== undefined) return dflt; throw new Error(`missing ${p}`); }
  return JSON.parse(await readFile(p, 'utf8'));
};
const slug = (t) => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60)
  .replace(/-+$/, '');
const slateText = (v) => {
  try { const n = typeof v === 'string' ? JSON.parse(v) : v; const t = (x) => (x.text || '') + (x.children || []).map(t).join(' '); return (n || []).map(t).join(' ').replace(/\s+/g, ' ').trim(); } catch (e) { return ''; }
};

const doc = (await raw('document.json')).data;
const pages = (await raw('pages.json')).data;
if (pages.length !== 1) throw new Error(`cover pages: expected one page, found ${pages.length}`);
const { page } = await raw(`pages/${pages[0].id}.json`);
const portal = (await raw('portal.json')).data;
const portalNav = (await raw('portal-navigation.json')).data;
const permalinks = await raw('permalinks.json', []);
const schemes = await raw('section-schemes.json');
const templateAsset = (await raw('template-asset.json', { data: [] })).data;
const themeAssets = (await raw('theme-asset-documentPage.json', { data: [] })).data;
const pageTheme = (await raw('graphql-page-theme.json', { data: {} })).data?.guideline?.theme?.settings?.documentPage || {};
const manifest = JSON.parse(await readFile(path.join(dir, 'assets', 'manifest.json'), 'utf8'));
const overridesFile = path.join(dir, 'image-names.json');
const overrides = (await exists(overridesFile)) ? JSON.parse(await readFile(overridesFile, 'utf8')) : {};

// ---- links: one final href per source URL ----
const permaByPath = Object.fromEntries(permalinks.filter((p) => p.target).map((p) => [p.link, p.target]));
const linkMap = {};
const linkUses = {};
function finalHref(url, where, label) {
  if (!url || typeof url !== 'string') return url;
  const src = url.trim();
  let target = src;
  const rp = /^(?:https?:\/\/[^/]+)?(\/r\/[^?#\s]+)/.exec(src);
  if (rp && permaByPath[rp[1]]) target = permaByPath[rp[1]];
  else if (src.startsWith('/')) target = CFG.host + src;
  const local = migratedPath(target);
  const href = local || normalise(target);
  linkMap[src] = href;
  linkMap[href] = href;
  (linkUses[src] = linkUses[src] || []).push({ where, label });
  return href;
}
// rewrite every link-like value in the page JSON (Slate content is stored as JSON strings)
function rewrite(o, where) {
  if (Array.isArray(o)) return o.map((x) => rewrite(x, where));
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && v.trim().startsWith('[') && /"(url|href|link)"/.test(v)) {
        try { out[k] = JSON.stringify(rewrite(JSON.parse(v), where)); continue; } catch (e) { /* not JSON */ }
      }
      if ((k === 'url' || k === 'href' || k === 'link') && typeof v === 'string' && v) {
        out[k] = finalHref(v, where, slateText(o.children) || o.altText || '');
      } else out[k] = rewrite(v, where);
    }
    return out;
  }
  return o;
}
const sections = [...page.sections].sort((a, b) => a.sort - b.sort)
  .map((s, i) => ({ ...rewrite(s, `section ${s.sort}`), scheme: schemes.sections[i] || schemes.page }));

// ---- images: descriptive names ----
const used = new Set();
const assets = {};
const alts = {};
const imageNames = {};
const labelFor = {};
for (const s of sections) {
  for (const b of s.content) {
    const st = b.settings || {};
    if (b.display_name === 'Image') {
      const a = (b.assets?.image || [])[0];
      if (a) labelFor[`asset-${a.id}`] = { name: slateText(st.name) || a.title, alt: st.altText || a.alternative_text || slateText(st.name) || '' };
    }
    if (b.display_name === 'Cards Grid') {
      for (const it of st.items || []) {
        const a = (b.assets?.[it.id] || [])[0];
        if (a) labelFor[`asset-${a.id}`] = { name: `cards ${slateText(it.description) || it.altText || a.title}`, alt: it.altText || slateText(it.description) || '' };
      }
    }
    if (b.display_name === 'Slider') {
      (st.slides || []).forEach((sl, n) => {
        const a = (b.assets?.[`slide_asset_image_${sl.id}`] || [])[0];
        if (a) labelFor[`asset-${a.id}`] = { name: `slider ${n + 1}`, alt: a.alternative_text || '' };
      });
    }
  }
}
const headerAsset = (templateAsset.find((t) => t.setting_id === 'headerBackgroundImage') || themeAssets.find((t) => t.setting_id === 'headerBackgroundImage'))?.asset;
const logoAsset = themeAssets.find((t) => t.setting_id === 'logoAsset')?.asset;
for (const m of manifest) {
  if (!m.file || m.key.startsWith('font-') || m.key.startsWith('bfont-')) continue;
  let label = labelFor[m.key];
  if (m.key.startsWith('page-')) {
    if (headerAsset && m.asset_id === headerAsset.id) label = { name: `${route} header`, alt: '' };
    else if (logoAsset && m.asset_id === logoAsset.id) label = { name: `${route} logo`, alt: portal.title?.replace(/ brand home$/i, '') || '' };
    else continue; // unused theme asset (e.g. the portal's default header image)
  }
  if (!label) continue; // not used on the page
  const o = overrides[m.key] || {};
  const ext = path.extname(m.file).toLowerCase();
  let base = slug(o.name || label.name) || m.key;
  if (used.has(base)) { let k = 2; while (used.has(`${base}-${k}`)) k += 1; base = `${base}-${k}`; }
  used.add(base);
  const rel = `assets/${route}/${base}${ext}`;
  await mkdir(path.dirname(path.join(contentDir, rel)), { recursive: true });
  await copyFile(path.join(dir, 'assets', m.file), path.join(contentDir, rel));
  assets[m.key] = `/${rel}`;
  alts[m.key] = 'alt' in o ? o.alt : label.alt;
  imageNames[m.key] = { path: `/${rel}`, alt: alts[m.key], frontify_file: m.file_name, source: o.name ? 'checked by hand' : 'asset/label' };
}

// ---- fonts (declared faces of the document's font project) ----
const fontCss = [];
const fontFiles = {};
for (const m of manifest.filter((x) => x.key.startsWith('font-') && x.file)) {
  const name = `${route}-${slug(m.family)}-${m.weight}-${m.style}.${m.ext}`;
  await copyFile(path.join(dir, 'assets', m.file), path.join('fonts', name));
  const k = `${m.family}|${m.weight}|${m.style}`;
  (fontFiles[k] = fontFiles[k] || []).push({ name, ext: m.ext });
}
for (const [k, files] of Object.entries(fontFiles)) {
  const [family, weight, style] = k.split('|');
  const fmt = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
  const srcs = files.sort((a, b) => ['woff2', 'woff', 'ttf', 'otf'].indexOf(a.ext) - ['woff2', 'woff', 'ttf', 'otf'].indexOf(b.ext))
    .map((f) => `url('../fonts/${f.name}') format('${fmt[f.ext] || f.ext}')`).join(', ');
  fontCss.push(`@font-face {\n  font-family: '${family}';\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: swap;\n  src: ${srcs};\n}`);
}

// ---- header navigation (portal) ----
const navHref = (n) => {
  if (n.type === 'link_document') return finalHref(n.url?.startsWith('/') ? CFG.host + n.url : n.url, 'header navigation', n.translations?.default?.title);
  return finalHref(`${CFG.host}/document/${n.id}`, 'header navigation', n.translations?.default?.title || n.translations?.default?.name);
};
const navItems = portalNav.filter((n) => !n.is_hidden_in_navigation).map((n) => {
  const tr = n.translations?.default || {};
  if (n.type === 'document_group') {
    return { title: tr.name || tr.title, children: (n.children || []).filter((c) => !c.is_hidden_in_navigation).map((c) => ({ title: c.translations?.default?.title || '', href: navHref(c) })) };
  }
  return { title: tr.title || '', href: navHref(n), current: n.id === doc.id };
});
const brandHub = portal.brandportal_settings || {};
const brandHubHref = brandHub.url ? finalHref(brandHub.url, 'header tools', brandHub.label) : null;
const logoHref = finalHref(pageTheme.logoLink?.link?.link || `${CFG.host}/document/${doc.id}`, 'header logo', 'logo');
const railHref = finalHref(`${CFG.host}/dashboard`, 'left rail', 'Back to dashboard');

// ---- captured page text (import runner completeness check) ----
let rendered = '';
let tabTitle = `${page.title} - ${doc.title} - ${portal.title}`;
const cap = path.join(dir, 'capture', '1440.html');
if (await exists(cap)) {
  const h = await readFile(cap, 'utf8');
  const mainM = /<main[\s\S]*?<\/main>/.exec(h);
  rendered = (mainM ? mainM[0] : '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<(img|video|source|iframe|link)\b[^>]*>/gi, '')
    .replace(/\s(style|srcset|src)="[^"]*"/gi, '');
  try { tabTitle = JSON.parse(await readFile(path.join(dir, 'capture', '1440.styles.json'), 'utf8')).title || tabTitle; } catch (e) { /* keep */ }
}

const payload = {
  host: CFG.host,
  route,
  pagePath: PAGE_PATH,
  originalUrl: `${CFG.host}/document/${doc.id}#/-/${page.slug}`,
  doc: { id: doc.id, title: doc.title },
  portal: { id: portal.id, title: portal.title },
  page: { id: page.id, title: page.title, slug: page.slug },
  tabTitle,
  sections,
  schemes: schemes.schemes,
  pageScheme: schemes.page,
  assets,
  alts,
  linkMap,
  nav: {
    logoKey: Object.keys(assets).find((k) => logoAsset && imageNames[k] && k.includes(String(logoAsset.id))),
    headerKey: Object.keys(assets).find((k) => headerAsset && k.includes(String(headerAsset.id))),
    logoHref,
    railHref,
    items: navItems,
    brandHub: brandHubHref ? { href: brandHubHref, label: brandHub.label || 'Brand Hub' } : null,
  },
};
await mkdir(srcDir, { recursive: true });
await writeFile(path.join(srcDir, `${route}.html`), `<!doctype html><html><head><meta charset="utf-8"><title>${tabTitle}</title></head><body>${rendered || '<main></main>'}<script id="frontify-export" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script></body></html>`);
await writeFile(path.join(srcDir, 'urls.txt'), `http://localhost:${PORT}/${route}.html\n`);
await writeFile(path.join(dir, 'image-names.generated.json'), JSON.stringify(imageNames, null, 1));
await writeFile(path.join(dir, 'fonts.generated.css'), `${fontCss.join('\n\n')}\n`);
// colour schemes as classes carrying Frontify's resolved variables verbatim (pasted into the theme)
const schemeCss = Object.entries(schemes.schemes).map(([name, vars]) => `.${route} .${name} {\n${Object.entries(vars)
  .filter(([k]) => !k.includes('-list-'))
  .map(([k, v]) => `  ${k}: ${v.replace(/&quot;/g, '"')};`).join('\n')}\n}`);
await writeFile(path.join(dir, 'schemes.generated.css'), `${schemeCss.join('\n\n')}\n`);
const lm = Object.entries(linkUses).map(([src, uses]) => ({
  source: src, target: linkMap[src], status: linkMap[src].startsWith('/') ? 'migrated' : 'out of scope (not migrated)', used_in: uses,
}));
await writeFile(path.join(dir, 'link-map.json'), JSON.stringify(lm, null, 2));
await writeFile(path.join(dir, 'link-map.csv'), `Old URL,Target,Status,Used in\n${lm.map((l) => [l.source, l.target, l.status, l.used_in.map((u) => u.where).join(' / ')].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')}\n`);
console.log('sections', sections.length, 'images', Object.keys(assets).length, 'font faces', fontCss.length, 'links', lm.length,
  'migrated', lm.filter((l) => l.status === 'migrated').length);
