/*
 * Image grid block (Frontify "Image grid").
 * Variants: columns-1 | columns-2 | columns-3 | columns-4, border, download (a download button on
 * each image), no-viewer (no asset viewer on click).
 * One row per image: picture | title | caption [| background colour [| caption styles: "n:
 * text-align: center" for the n-th top-level element of the caption]].
 */

const DOWNLOAD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M3.5 12a8.5 8.5 0 1117 0 8.5 8.5 0 01-17 0M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12m14.42.13a.75.75 0 010 1.06l-3.89 3.89-.53.53-.53-.53-3.89-3.89a.75.75 0 011.06-1.06l2.61 2.6V7.53a.75.75 0 011.5 0v7.21l2.61-2.61a.75.75 0 011.06 0" clip-rule="evenodd"/></svg>';

function applyStyles(content, spec) {
  const els = [...content.children];
  (spec || '').split(/\s*\n\s*|\s+(?=\d+\s*:\s)/).forEach((line) => {
    const m = /^\s*(\d+)\s*:\s*text-align\s*:\s*(left|center|right|justify)/.exec(line);
    const el = m && els[Number(m[1]) - 1];
    if (el) [, , el.style.textAlign] = m;
  });
}

function openViewer(block, img) {
  const dialog = document.createElement('dialog');
  dialog.className = 'image-grid-viewer';
  dialog.setAttribute('aria-label', img.alt || 'Image viewer');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'image-grid-viewer-close';
  close.setAttribute('aria-label', 'Close');
  const large = document.createElement('img');
  large.src = img.currentSrc || img.src;
  large.alt = img.alt;
  dialog.append(close, large);
  const shut = () => dialog.close();
  close.addEventListener('click', shut);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) shut(); });
  dialog.addEventListener('close', () => dialog.remove());
  block.append(dialog);
  dialog.showModal();
}

function textCell(cell, className) {
  if (!cell || !cell.textContent.trim()) return null;
  const div = document.createElement('div');
  div.className = className;
  div.append(...cell.childNodes);
  return div;
}

export default function decorate(block) {
  if (![...block.classList].some((c) => /^columns-\d$/.test(c))) block.classList.add('columns-2');

  const sections = [...document.querySelectorAll('main .section')];
  const lazy = sections.indexOf(block.closest('.section')) > 1;

  const list = document.createElement('ul');
  list.className = 'image-grid-list';

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const picCell = cells.find((c) => c.querySelector('picture, img'));
    if (!picCell) return;
    const picture = picCell.querySelector('picture') || picCell.querySelector('img');
    const img = picture.tagName === 'IMG' ? picture : picture.querySelector('img');
    const rest = cells.filter((c) => c !== picCell);
    const [titleCell, captionCell, bgCell, styleCell] = rest;
    const viewer = !block.classList.contains('no-viewer');

    const li = document.createElement('li');
    li.className = 'image-grid-item';
    const figure = document.createElement('figure');

    const wrap = document.createElement('div');
    wrap.className = 'image-grid-image';
    const bg = bgCell?.textContent.trim();
    if (bg) wrap.style.backgroundColor = bg;

    const btn = document.createElement(viewer ? 'button' : 'div');
    btn.className = 'image-grid-trigger';
    if (viewer) {
      btn.type = 'button';
      btn.setAttribute('aria-label', `Open image${img?.alt ? `: ${img.alt}` : ''}`);
    }
    btn.append(picture);
    if (img) {
      if (lazy && !img.hasAttribute('loading')) img.loading = 'lazy';
      if (viewer) btn.addEventListener('click', () => openViewer(block, img));
    }
    wrap.append(btn);
    if (img && block.classList.contains('download')) {
      const download = document.createElement('a');
      download.className = 'image-grid-download';
      download.href = img.getAttribute('src');
      download.setAttribute('download', '');
      download.setAttribute('aria-label', 'Download image');
      download.innerHTML = DOWNLOAD_ICON;
      wrap.append(download);
    }
    figure.append(wrap);

    const title = textCell(titleCell, 'image-grid-title');
    const caption = textCell(captionCell, 'image-grid-caption');
    if (caption && styleCell) applyStyles(caption, styleCell.textContent);
    if (title || caption) {
      const cap = document.createElement('figcaption');
      if (title) cap.append(title);
      if (caption) cap.append(caption);
      figure.append(cap);
    }
    li.append(figure);
    list.append(li);
  });

  block.replaceChildren(list);
}
