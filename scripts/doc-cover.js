/*
 * "doc-cover" template: a Frontify document page in the new document theme, shown without sidebar
 * (e.g. The Mora brand home). Each section whose Section Metadata Style contains "doc-row" is one
 * Frontify section: Columns ("18 6", 24-column proportions), Padding ("80px 0px"), Gutter ("15px
 * 5px"), Max Width, and a colour scheme class ("scheme-1": Frontify's resolved --f-theme-
 * settings-* variables, defined in the theme). Every block in the section is one grid cell, in
 * order. Runs before blocks load, so it reads Section Metadata itself.
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

const el = (cls) => Object.assign(document.createElement('div'), { className: cls });

/**
 * Tabbed section groups: consecutive sections with the same "Tab Group" metadata are the panels of
 * one Frontify tab group ("Tab" = label). A tab bar section is inserted before the first panel;
 * only the selected panel is shown.
 */
function decorateTabGroups(main) {
  const sections = [...main.querySelectorAll(':scope > .section[data-tab-group]')];
  const groups = [];
  sections.forEach((s) => {
    const last = groups[groups.length - 1];
    const prev = last && last.panels[last.panels.length - 1];
    if (last && last.id === s.dataset.tabGroup && prev.nextElementSibling === s) {
      last.panels.push(s);
    } else groups.push({ id: s.dataset.tabGroup, panels: [s] });
  });
  groups.forEach((g, gi) => {
    const bar = el('section doc-tabbar');
    const region = el('doc-region');
    const list = el('doc-tablist');
    list.setAttribute('role', 'tablist');
    const tabs = g.panels.map((panel, i) => {
      const id = `doc-tab-${gi}-${i}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'doc-tab';
      btn.id = id;
      btn.setAttribute('role', 'tab');
      btn.textContent = panel.dataset.tab || `Tab ${i + 1}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', id);
      panel.id = panel.id || `${id}-panel`;
      btn.setAttribute('aria-controls', panel.id);
      list.append(btn);
      return btn;
    });
    const select = (n, focus) => {
      tabs.forEach((t, i) => {
        t.setAttribute('aria-selected', i === n ? 'true' : 'false');
        t.tabIndex = i === n ? 0 : -1;
        g.panels[i].hidden = i !== n;
      });
      if (focus) tabs[n].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (d) { e.preventDefault(); select((i + d + tabs.length) % tabs.length, true); }
      });
    });
    const sep = el('doc-tabsep');
    region.append(list, sep);
    bar.append(region);
    g.panels[0].before(bar);
    select(0);
  });
}

export function decorateDocCover(main) {
  // generic hook for the section styles (doc-cover pages and guideline pages with doc sections)
  document.body.classList.add('doc-sections');
  const pageScheme = toClassName(getMetadata('scheme'));
  if (pageScheme) main.classList.add(pageScheme);
  main.querySelectorAll(':scope > .section').forEach((section) => {
    applySectionMetadata(section);
    if (!section.classList.contains('doc-row')) return;
    const d = section.dataset;
    const set = (k, v) => { if (v && v !== 'default') section.style.setProperty(k, v); };
    const [pv, ph] = (d.padding || '').split(/\s+/);
    const [gv, gh] = (d.gutter || '').split(/\s+/);
    set('--doc-cols', (d.columns || '24').split(/\s+/).filter(Boolean).map((c) => `${c}fr`).join(' '));
    set('--doc-pad-v', pv);
    set('--doc-pad-h', ph);
    set('--doc-gap-v', gv);
    set('--doc-gap-h', gh);
    set('--doc-max-width', d.maxWidth);
    const region = el('doc-region');
    const content = el('doc-content');
    const grid = el('doc-grid');
    [...section.children].forEach((w) => { w.classList.add('doc-cell'); grid.append(w); });
    content.append(grid);
    region.append(content);
    section.append(region);
  });
  decorateTabGroups(main);
}

export async function loadDocCoverTheme() {
  const theme = toClassName(getMetadata('theme'));
  await Promise.all([
    loadCSS(`${window.hlx.codeBasePath}/styles/doc-cover.css`),
    theme ? loadCSS(`${window.hlx.codeBasePath}/styles/theme-${theme}.css`) : null,
  ]);
}
