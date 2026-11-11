/*
 * Annotations block (Frontify "Annotations").
 * Row 1: picture. Then one row per annotation: "<left>% <top>%[; <left>% <top>%...]" | rich text.
 * Optional rows: Bubble | colour, Background | colour, Caption | text.
 * Variants: mode-figure (default, notes beside the image), mode-text-top (notes above),
 * mode-full (notes below), border, bubble-light, fixed.
 */

const OPTION_LABELS = ['bubble', 'background', 'caption'];

function parsePositions(text) {
  return text.split(';').map((pair) => {
    const nums = pair.match(/-?\d+(\.\d+)?/g);
    if (!nums || nums.length < 2) return null;
    const left = Math.min(100, Math.max(0, parseFloat(nums[0])));
    const top = Math.min(100, Math.max(0, parseFloat(nums[1])));
    return { left, top };
  }).filter(Boolean);
}

function readBlock(block) {
  let picture = null;
  const notes = [];
  const options = {};
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (!picture) {
      const pic = row.querySelector('picture') || row.querySelector('img');
      if (pic) {
        picture = pic.closest('picture') || pic;
        return;
      }
    }
    if (!cells.length) return;
    const [first, second] = cells;
    const label = first.textContent.trim();
    const key = label.toLowerCase();
    if (OPTION_LABELS.includes(key) && second) {
      options[key] = second.textContent.trim();
      return;
    }
    const positions = parsePositions(label);
    if (positions.length || second) {
      notes.push({ positions, content: second || null });
    }
  });
  return { picture, notes, options };
}

function setActive(block, index, on) {
  block.querySelectorAll(`[data-annotation="${index}"]`).forEach((el) => {
    el.classList.toggle('is-active', on);
  });
}

export default function decorate(block) {
  const { picture, notes, options } = readBlock(block);
  if (!picture) {
    block.replaceChildren();
    return;
  }
  const img = picture.tagName === 'IMG' ? picture : picture.querySelector('img');

  if (!['mode-figure', 'mode-text-top', 'mode-full'].some((c) => block.classList.contains(c))) {
    block.classList.add('mode-figure');
  }
  if (options.bubble) block.style.setProperty('--annotations-bubble', options.bubble);

  const layout = document.createElement('div');
  layout.className = 'annotations-layout';

  // image with bubbles
  const figure = document.createElement('figure');
  figure.className = 'annotations-figure';
  const canvas = document.createElement('div');
  canvas.className = 'annotations-canvas';
  if (options.background) canvas.style.backgroundColor = options.background;
  canvas.append(picture);
  if (img) {
    if (!img.alt && options.caption) img.alt = options.caption;
    const sections = [...document.querySelectorAll('main .section')];
    if (sections.indexOf(block.closest('.section')) > 1 && !img.hasAttribute('loading')) img.loading = 'lazy';
    // retina assets are shown at half their pixel width at most
    const limit = () => {
      const w = Number(img.getAttribute('width')) || img.naturalWidth;
      if (w && !block.classList.contains('fixed')) canvas.style.maxWidth = `${w / 2}px`;
    };
    if (img.getAttribute('width') || img.complete) limit();
    else img.addEventListener('load', limit, { once: true });
  }

  const bubbles = document.createElement('div');
  bubbles.className = 'annotations-bubbles';
  canvas.append(bubbles);
  figure.append(canvas);

  // notes list
  const list = document.createElement('ol');
  list.className = 'annotations-list';

  notes.forEach((note, i) => {
    const n = i + 1;
    note.positions.forEach((pos) => {
      const bubble = document.createElement('button');
      bubble.type = 'button';
      bubble.className = 'annotations-bubble';
      bubble.dataset.annotation = n;
      bubble.style.left = `${pos.left}%`;
      bubble.style.top = `${pos.top}%`;
      bubble.setAttribute('aria-label', `Annotation ${n}`);
      const num = document.createElement('span');
      num.className = 'annotations-bubble-number';
      num.textContent = n;
      bubble.append(num);
      bubbles.append(bubble);
    });

    const li = document.createElement('li');
    li.className = 'annotations-item';
    li.dataset.annotation = n;
    const content = document.createElement('div');
    content.className = 'annotations-item-content';
    if (note.content) content.append(...note.content.childNodes);
    li.append(content);
    list.append(li);
  });

  if (notes.length) {
    const blocks = [...document.querySelectorAll('.annotations')];
    const prefix = `annotations-${blocks.indexOf(block) + 1}-`;
    list.querySelectorAll('.annotations-item').forEach((li) => {
      li.id = `${prefix}${li.dataset.annotation}`;
    });
    bubbles.querySelectorAll('.annotations-bubble').forEach((b) => {
      b.setAttribute('aria-describedby', `${prefix}${b.dataset.annotation}`);
    });
  }

  layout.append(figure);
  if (notes.length) layout.append(list);
  block.replaceChildren(layout);

  // hover / focus links bubble(s) and note
  const hoverables = block.querySelectorAll('.annotations-bubble, .annotations-item');
  hoverables.forEach((el) => {
    const n = el.dataset.annotation;
    el.addEventListener('mouseenter', () => setActive(block, n, true));
    el.addEventListener('mouseleave', () => setActive(block, n, false));
    el.addEventListener('focus', () => setActive(block, n, true));
    el.addEventListener('blur', () => setActive(block, n, false));
  });
  // clicking a bubble brings its note into view if it is off screen (e.g. stacked on mobile)
  bubbles.addEventListener('click', (e) => {
    const bubble = e.target.closest('.annotations-bubble');
    if (!bubble) return;
    const item = list.querySelector(`[data-annotation="${bubble.dataset.annotation}"]`);
    if (!item) return;
    const r = item.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
