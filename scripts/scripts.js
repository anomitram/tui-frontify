import {
  getMetadata,
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
} from './aem.js';

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/**
 * Local preview serves the content folder under /content; on Edge Delivery pages live at
 * the root. CONTENT_BASE is '' in production.
 */
export const CONTENT_BASE = window.location.pathname.startsWith('/content/') ? '/content' : '';

/** Prefix a root-relative content path with the local preview mount (no-op in production). */
export function contentPath(path) {
  if (!CONTENT_BASE || !path || !path.startsWith('/') || path.startsWith(`${CONTENT_BASE}/`)) return path;
  return `${CONTENT_BASE}${path}`;
}

/** Rewrite root-relative page links for the local preview mount (no-op in production). */
export function localizeLinks(root) {
  if (!CONTENT_BASE) return;
  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/assets/')) a.setAttribute('href', contentPath(href));
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Turns `/widgets/...` links into widget blocks.
 * @param {Element} main The container element
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = [...main.querySelectorAll('a[href*="/widgets/"]')];
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const newLink = link.cloneNode(true);
    const widgetBlock = buildBlock('widget', { elems: [newLink] });
    const p = link.closest('p');
    if (
      p
      && p.querySelectorAll('a').length === 1
      && p.querySelector('a') === link
      && p.textContent.trim() === link.textContent.trim()
    ) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Frontify puts several buttons in one paragraph (e.g. "Global Campaign Playbooks / Assets /
 * Guidelines") or a button inside a heading (The Mora: "About our brand ->"). The site's
 * decorateButtons() only handles a link that is alone in its paragraph, so formatted links in
 * those places are turned into buttons here (hub-cell, text blocks), with the same mapping:
 * bold = primary, italic = secondary, bold + italic = accent (Frontify tertiary).
 */
export function decorateInlineButtons(content) {
  // only elements that hold nothing but formatted links (and spaces): a bold link inside a
  // sentence stays a bold link
  const onlyButtons = (el) => {
    const links = [...el.querySelectorAll('a[href]')];
    const rest = links.reduce((t, a) => t.replace(a.textContent, ''), el.textContent);
    return links.length && !rest.replace(/[\s\u200b]/g, '');
  };
  content.querySelectorAll(':is(p, h1, h2, h3, h4, h5, h6) a[href]:not(.button)').forEach((a) => {
    const strong = a.closest('strong');
    const em = a.closest('em');
    if ((!strong && !em) || a.querySelector('img')) return;
    if (!onlyButtons(a.closest('p, h1, h2, h3, h4, h5, h6'))) return;
    // the outermost formatting element around the link
    let outer = strong || em;
    if (strong && em) outer = strong.contains(em) ? strong : em;
    if (outer.textContent.trim() !== a.textContent.trim()) return;
    a.classList.add('button'); // keep classes set from a Styles row (e.g. the button's text style)
    if (strong && em) a.classList.add('accent');
    else a.classList.add(strong ? 'primary' : 'secondary');
    outer.replaceWith(a);
    a.closest('p, h1, h2, h3, h4, h5, h6').classList.add('button-wrapper');
  });
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
  localizeLinks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
/**
 * Frontify reserves a 10px scrollbar gutter on every platform. Where the browser's own
 * scrollbar is thinner (overlay scrollbars), pad the page by the difference.
 */
function compensateScrollbar() {
  const sbw = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.setProperty('--scrollbar-compensation', `${Math.max(0, 10 - sbw)}px`);
}

/**
 * "redirect" template: forwards to the Redirect metadata path. Old Frontify routes
 * (/document/396#/category/page[/heading]) map to [Redirect Base]/category/page[#heading].
 */
function handleRedirectTemplate() {
  if (getMetadata('template') !== 'redirect') return false;
  let target = getMetadata('redirect') || '/';
  const route = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (route.length >= 2) {
    const [cat, slug, heading] = route;
    // "Redirect Base": path prefix of the document's pages (e.g. /the-mora/brand); doc 396: none
    const base = (getMetadata('redirect-base') || '').replace(/\/$/, '');
    target = cat === '-' ? `${base}/${slug}` : `${base}/${cat}/${slug}`;
    if (heading) target += `#${heading}`;
  }
  window.location.replace(contentPath(target));
  return true;
}

async function loadEager(doc) {
  document.documentElement.lang = 'en';
  compensateScrollbar();
  window.addEventListener('resize', compensateScrollbar);
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    // guideline pages of the new Frontify document theme (The Mora): column sections + schemes
    if (document.body.classList.contains('guideline') && getMetadata('layout') === 'doc-sections') {
      const { decorateDocCover, loadDocCoverTheme } = await import('./doc-cover.js');
      decorateDocCover(main);
      await loadDocCoverTheme();
    }
    if (document.body.classList.contains('guideline')) {
      // eslint-disable-next-line import/no-cycle
      const { decorateGuidelineLayout } = await import('./guideline.js');
      decorateGuidelineLayout(main);
    }
    if (document.body.classList.contains('hub')) {
      const { decorateHub, loadHubTheme } = await import('./hub.js');
      decorateHub(main);
      await loadHubTheme();
    }
    if (document.body.classList.contains('doc-cover')) {
      const { decorateDocCover, loadDocCoverTheme } = await import('./doc-cover.js');
      decorateDocCover(main);
      await loadDocCoverTheme();
    }
    // Frontify asset library pages (logos, media, icons, documents)
    if (document.body.classList.contains('library')) {
      const { loadLibraryTheme } = await import('./library.js');
      await loadLibraryTheme();
    }
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  if (document.body.classList.contains('guideline')) {
    // eslint-disable-next-line import/no-cycle
    const { loadGuideline } = await import('./guideline.js');
    await loadGuideline(main);
  } else {
    const { hash } = window.location;
    const element = hash ? doc.getElementById(hash.substring(1)) : false;
    if (hash && element) element.scrollIntoView();
  }

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  import('./consent-check.js');
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  if (handleRedirectTemplate()) return;
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
