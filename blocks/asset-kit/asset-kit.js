/*
 * Asset Kit block (Frontify "Asset Kit").
 *
 * Markup: key/value rows `Title | rich text`, `Description | rich text`,
 * `Package | link`, `Border | css border`, `Thumbnail background | css colour`,
 * then one row per asset: thumbnail | link to file | title | extension.
 * Block classes: thumbnails, count, border, background, thumbnail-border,
 * thumbnail-background, radius-<none|small|medium|large>.
 */

const META_KEYS = ['title', 'description', 'package', 'border', 'thumbnail background', 'background'];
const DOWNLOAD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12 3.25a.75.75 0 01.75.75v9.19l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V4a.75.75 0 01.75-.75M4.75 15a.75.75 0 01.75.75v2.5c0 .414.336.75.75.75h11.5a.75.75 0 00.75-.75v-2.5a.75.75 0 011.5 0v2.5A2.250 2.250 0 0117.75 20.5H6.25A2.250 2.250 0 014 18.25v-2.5a.75.75 0 01.75-.75"/></svg>';

const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

/* Generic file icon (Frontify style) for assets without a preview image. */
function fileIcon(ext) {
  const label = (ext || 'file').toUpperCase().slice(0, 4);
  const wrap = document.createElement('span');
  wrap.className = 'asset-kit-file-icon';
  wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 399 512" aria-hidden="true" focusable="false">
    <path d="M265 9.3a26 26 0 0 1 18.4 7.6l103.7 103.7a26 26 0 0 1 7.6 18.4v338.8c0 14.3-11.6 25.9-25.9 25.9H30.2c-14.3 0-25.9-11.6-25.9-25.9V35.2C4.3 20.9 15.9 9.3 30.2 9.3z" fill="#fff" stroke="#666" stroke-width="8.7"/>
    <path d="M265 9.3v104a26 26 0 0 0 26 26h104" fill="none" stroke="#666" stroke-width="8.7"/>
    <text x="199.5" y="455" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700" fill="#666">${label}</text>
  </svg>`;
  return wrap;
}

function wrapInlineContent(cell) {
  const frag = document.createDocumentFragment();
  let p = null;
  [...cell.childNodes].forEach((node) => {
    const inline = node.nodeType === Node.TEXT_NODE
      || (node.nodeType === Node.ELEMENT_NODE && !/^(P|H[1-6]|UL|OL|DIV|TABLE|BLOCKQUOTE|PRE|PICTURE)$/.test(node.tagName));
    if (inline) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim() && !p) return;
      if (!p) {
        p = document.createElement('p');
        frag.append(p);
      }
      p.append(node);
    } else {
      p = null;
      frag.append(node);
    }
  });
  return frag;
}

function buildThumbnail(cells, thumbStyle) {
  const [thumbCell, linkCell, titleCell, extCell] = cells;
  const link = linkCell?.querySelector('a[href]') || cells.map((c) => c?.querySelector('a[href]')).find(Boolean);
  const fileName = text(link) || text(linkCell);
  const title = text(titleCell) || fileName.replace(/\.[^.]+$/, '');
  const [, extFromName = ''] = fileName.match(/\.([a-z0-9]+)$/i) || [];
  const ext = text(extCell) || extFromName;

  const item = document.createElement('li');
  item.className = 'asset-kit-thumbnail';

  const frame = document.createElement(link ? 'a' : 'div');
  frame.className = 'asset-kit-thumbnail-frame';
  Object.assign(frame.style, thumbStyle);
  if (link) {
    frame.href = link.href;
    frame.setAttribute('download', fileName || '');
    frame.setAttribute('aria-label', `Download ${title || fileName}`);
  }

  const img = thumbCell?.querySelector('img');
  if (img) {
    const picture = img.closest('picture') || img;
    img.alt = img.alt && !/ file$/.test(img.alt) ? img.alt : title;
    img.loading = 'lazy';
    frame.append(picture);
  } else {
    frame.append(fileIcon(ext));
  }

  if (link) {
    const badge = document.createElement('span');
    badge.className = 'asset-kit-thumbnail-download';
    badge.innerHTML = DOWNLOAD_ICON;
    frame.append(badge);
  }

  item.append(frame);
  return item;
}

export default function decorate(block) {
  const meta = {};
  const assetRows = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = text(cells[0]).toLowerCase();
    if (cells.length === 2 && META_KEYS.includes(key)) {
      [, meta[key]] = cells;
    } else if (cells.some((c) => text(c) || c.querySelector('img, a'))) assetRows.push(cells);
  });

  const cls = block.classList;
  const hasFlags = ['thumbnails', 'count'].some((c) => cls.contains(c));
  const showThumbnails = !hasFlags || cls.contains('thumbnails');
  const showCount = !hasFlags || cls.contains('count');

  const container = document.createElement('div');
  container.className = 'asset-kit-container';
  if (cls.contains('border')) {
    container.style.border = text(meta.border) || '1px solid rgb(230 230 230)';
  }
  if (cls.contains('background')) {
    container.style.backgroundColor = text(meta.background) || 'rgb(241 241 241)';
  }

  const thumbStyle = {};
  if (cls.contains('thumbnail-background')) {
    thumbStyle.backgroundColor = text(meta['thumbnail background']) || 'rgb(241 241 241)';
  }
  if (cls.contains('thumbnail-border')) thumbStyle.border = '1px solid rgb(230 230 230)';

  // head: title + description | download package button
  const head = document.createElement('div');
  head.className = 'asset-kit-head';
  const intro = document.createElement('div');
  intro.className = 'asset-kit-intro';

  const title = document.createElement('div');
  title.className = 'asset-kit-title';
  if (meta.title) {
    const heading = meta.title.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) title.append(...meta.title.childNodes);
    else if (text(meta.title)) {
      const h3 = document.createElement('h3');
      h3.textContent = text(meta.title);
      title.append(h3);
    }
  }
  const description = document.createElement('div');
  description.className = 'asset-kit-description';
  if (meta.description) description.append(wrapInlineContent(meta.description));
  intro.append(title, description);
  head.append(intro);

  const pkg = meta.package?.querySelector('a[href]');
  if (pkg) {
    const action = document.createElement('div');
    action.className = 'asset-kit-action';
    const button = document.createElement('a');
    button.className = 'button asset-kit-download';
    button.href = pkg.href;
    button.textContent = text(pkg) || 'Download package';
    const zipName = decodeURIComponent(pkg.pathname.split('/').pop() || '');
    button.setAttribute('download', zipName);
    action.append(button);
    head.append(action);
  }
  container.append(head);

  // assets: count + thumbnail grid
  const assets = document.createElement('div');
  assets.className = 'asset-kit-assets';
  if (showCount) {
    const count = document.createElement('div');
    count.className = 'asset-kit-count';
    const n = assetRows.length;
    count.textContent = n > 0 ? `${n} asset${n > 1 ? 's' : ''}` : 'Add assets to make them available';
    if (!n) count.classList.add('is-empty');
    assets.append(count);
  }
  if (showThumbnails && assetRows.length) {
    const grid = document.createElement('ul');
    grid.className = 'asset-kit-grid';
    assetRows.forEach((cells) => grid.append(buildThumbnail(cells, thumbStyle)));
    assets.append(grid);
  }
  if (assets.children.length) container.append(assets);

  block.replaceChildren(container);
}
