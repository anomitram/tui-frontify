/*
 * "hub" template: Frontify portal home page (grid of rows and cells).
 * Each section whose Section Metadata Style contains "hub-row" is one Frontify row. Its metadata
 * (Width, Content Width, Gutter, Margin Top, Margin Bottom, Background) maps to Frontify's
 * --brandportal-* variables, and cells (hub-cell / hub-divider blocks with a w-<n> class) become
 * .p-col.p-col--<n> columns. Runs before blocks load, so it reads Section Metadata itself.
 */
import {
  loadCSS, getMetadata, toClassName, readBlockConfig,
} from './aem.js';

function applySectionMetadata(section) {
  const meta = section.querySelector(':scope > div > .section-metadata, :scope > .section-metadata');
  if (!meta) return;
  const cfg = readBlockConfig(meta);
  Object.entries(cfg).forEach(([key, value]) => {
    if (key === 'style') {
      String(value).split(',').map((v) => toClassName(v.trim())).filter(Boolean)
        .forEach((c) => section.classList.add(c));
    } else {
      section.dataset[toClassName(key).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = value;
    }
  });
  const wrapper = meta.parentElement;
  meta.remove();
  if (wrapper !== section && !wrapper.children.length) wrapper.remove();
}

export function decorateHub(main) {
  main.querySelectorAll(':scope > .section').forEach((section) => {
    applySectionMetadata(section);
    if (!section.classList.contains('hub-row')) return;
    const d = section.dataset;
    const vars = {
      '--brandportal-width': d.width || d.contentWidth || '100%',
      '--brandportal-margin': d.gutter || '0',
      '--brandportal-margin-top': d.marginTop || '0',
      '--brandportal-margin-bottom': d.marginBottom || '0',
      '--brandportal-background-color': d.background || 'transparent',
    };
    Object.entries(vars).forEach(([k, v]) => section.style.setProperty(k, v));
    if (d.gutter && d.gutter !== '0') section.classList.add('state-has-margin');
    const wrap = document.createElement('div');
    wrap.className = 'po-brandportal__row-wrap';
    const row = document.createElement('div');
    row.className = 'p-row';
    [...section.children].forEach((w) => {
      const block = w.querySelector('.hub-cell, .hub-divider');
      if (!block) return;
      const width = ([...block.classList].find((c) => /^w-\d+$/.test(c)) || 'w-12').slice(2);
      w.classList.add('p-col', `p-col--${width}`);
      row.append(w);
    });
    wrap.append(row);
    section.append(wrap);
  });
}

export async function loadHubTheme() {
  const theme = toClassName(getMetadata('theme'));
  await Promise.all([
    loadCSS(`${window.hlx.codeBasePath}/styles/hub.css`),
    theme ? loadCSS(`${window.hlx.codeBasePath}/styles/theme-${theme}.css`) : null,
  ]);
}
