/*
 * Image grid block (Frontify "Image grid").
 * Variants: columns-1 | columns-2 | columns-3 | columns-4, border.
 * One row per image: picture | title | caption [| background colour].
 */

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
    const [titleCell, captionCell, bgCell] = rest;

    const li = document.createElement('li');
    li.className = 'image-grid-item';
    const figure = document.createElement('figure');

    const wrap = document.createElement('div');
    wrap.className = 'image-grid-image';
    const bg = bgCell?.textContent.trim();
    if (bg) wrap.style.backgroundColor = bg;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'image-grid-trigger';
    btn.setAttribute('aria-label', `Open image${img?.alt ? `: ${img.alt}` : ''}`);
    btn.append(picture);
    if (img) {
      if (lazy && !img.hasAttribute('loading')) img.loading = 'lazy';
      btn.addEventListener('click', () => openViewer(block, img));
    }
    wrap.append(btn);
    figure.append(wrap);

    const title = textCell(titleCell, 'image-grid-title');
    const caption = textCell(captionCell, 'image-grid-caption');
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
