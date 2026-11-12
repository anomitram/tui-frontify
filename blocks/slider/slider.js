/*
 * Slider (Frontify marketplace block "Slider", image slides). Variants: columns-<n> (slides per
 * view from 769px; one below, like Frontify's Splide breakpoints 768: 1, 1024: min(2, n)),
 * height-<px> (slide height, images cover-cropped), autoplay, controls-* (arrows/pagination; The
 * Mora shows none). Rows: picture [| caption]; optional "Interval | ms", "Gap | px". Moves by
 * swipe, trackpad or mouse drag and snaps to slides.
 */
export default function decorate(block) {
  const height = ([...block.classList].find((c) => /^height-\d+$/.test(c)) || '').slice(7);
  const perView = Number(([...block.classList].find((c) => /^columns-\d+$/.test(c)) || 'columns-1').slice(8));
  let interval = 0;
  let gap = '';
  const track = document.createElement('ul');
  track.className = 'slider-track';
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const label = cells.length === 2 ? cells[0].textContent.trim().toLowerCase() : '';
    if (label === 'interval') { interval = Number(cells[1].textContent) || 0; return; }
    if (label === 'gap') { gap = cells[1].textContent.trim(); return; }
    const pic = row.querySelector('picture, img');
    if (!pic) return;
    const li = document.createElement('li');
    li.className = 'slider-slide';
    const frame = document.createElement('div');
    frame.className = 'slider-frame';
    frame.append(pic);
    li.append(frame);
    const cap = cells[1];
    if (cap && cap.textContent.trim()) {
      const c = document.createElement('div');
      c.className = 'slider-caption';
      c.append(...cap.childNodes);
      li.append(c);
    }
    track.append(li);
  });
  if (height) block.style.setProperty('--slider-height', `${height}px`);
  block.style.setProperty('--slider-per-view', String(perView || 1));
  if (gap) block.style.setProperty('--slider-gap', gap);
  track.setAttribute('aria-label', 'Image slider');
  track.tabIndex = 0;
  block.replaceChildren(track);
  block.querySelectorAll('img').forEach((img, i) => { if (i > 1) img.loading = 'lazy'; });

  // mouse drag (touch and trackpads scroll natively)
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    dragging = true;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add('is-dragging');
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointermove', (e) => {
    if (dragging) track.scrollLeft = startScroll - (e.clientX - startX);
  });
  const end = () => { dragging = false; track.classList.remove('is-dragging'); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  if (interval && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(() => {
      const max = track.scrollWidth - track.clientWidth;
      track.scrollTo({ left: track.scrollLeft >= max - 2 ? 0 : track.scrollLeft + track.clientWidth / (perView || 1), behavior: 'smooth' });
    }, interval);
  }
}
