/*
 * Video block (Frontify "Video").
 * 1 column; the single content row holds the video link (optional poster image)
 * followed by optional title paragraph(s).
 * Variants: autoplay, loop, width-<n>px (e.g. width-400px, width-200px).
 */

const INFO_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 1.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17m-.002 6.385q.39 0 .645.27.254.255.255.645v5.67q0 .39-.255.66a.87.87 0 01-.645.255.88.88 0 01-.646-.255.93.93 0 01-.254-.66V10.8q0-.39.254-.645a.85.85 0 01.646-.27m0-3.284q.524 0 .734.164.21.165.21.586v.284q0 .435-.224.6-.226.15-.736.15t-.72-.165-.21-.585V7.35q0-.435.225-.586.24-.165.721-.164"/></svg>';

function openViewer(block, src, label, poster) {
  const dialog = document.createElement('dialog');
  dialog.className = 'video-viewer';
  dialog.setAttribute('aria-label', label);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'video-viewer-close';
  close.setAttribute('aria-label', 'Close');
  const large = document.createElement('video');
  large.src = src;
  large.controls = true;
  large.playsInline = true;
  large.setAttribute('controlslist', 'nodownload');
  if (poster) large.poster = poster;
  const title = document.createElement('p');
  title.className = 'video-viewer-title';
  title.textContent = label;
  dialog.append(close, large, title);
  const shut = () => dialog.close();
  close.addEventListener('click', shut);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) shut(); });
  dialog.addEventListener('close', () => { large.pause(); dialog.remove(); });
  block.append(dialog);
  dialog.showModal();
}

function isVideoHref(href) {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(href || '');
}

/*
 * Frontify shows a CDN thumbnail of the frame at ~1s as poster for videos that do not autoplay.
 * Without that thumbnail, grab the same frame client side with an off-screen video element.
 */
function grabPosterFrame(src, video) {
  const probe = document.createElement('video');
  probe.muted = true;
  probe.playsInline = true;
  probe.preload = 'auto';
  const cleanup = () => {
    probe.removeAttribute('src');
    probe.load();
  };
  probe.addEventListener('loadedmetadata', () => {
    probe.currentTime = Math.min(1, (probe.duration || 2) / 2);
  }, { once: true });
  const draw = () => {
    if (!probe.videoWidth || video.poster) { cleanup(); return; }
    try {
      const scale = Math.min(1, 1920 / probe.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(probe.videoWidth * scale);
      canvas.height = Math.round(probe.videoHeight * scale);
      canvas.getContext('2d').drawImage(probe, 0, 0, canvas.width, canvas.height);
      if (!video.poster && video.paused && !video.currentTime) video.poster = canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      // cross-origin media: keep the first frame
    }
    cleanup();
  };
  probe.addEventListener('seeked', draw, { once: true });
  probe.addEventListener('error', cleanup, { once: true });
  probe.src = src;
}

function loadWhenVisible(video, src, { autoplay, poster }) {
  const start = () => {
    if (!video.getAttribute('src')) video.src = src;
    if (autoplay) {
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    } else if (!poster) {
      grabPosterFrame(src, video);
    }
  };
  if (!('IntersectionObserver' in window)) {
    start();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        io.disconnect();
        start();
      }
    });
  }, { rootMargin: '300px 0px' });
  io.observe(video);
}

export default function decorate(block) {
  const links = [...block.querySelectorAll('a[href]')];
  const link = links.find((a) => isVideoHref(a.getAttribute('href'))) || links[0];
  const href = link?.getAttribute('href');
  if (!href) {
    block.replaceChildren();
    return;
  }

  const posterImg = block.querySelector('picture img, img');
  const poster = posterImg ? (posterImg.currentSrc || posterImg.src) : '';

  // anything else in the cell (other than the link and the poster) is the title / caption
  const captionNodes = [];
  const cell = link.closest('.video > div > div') || link.parentElement;
  [...cell.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim() && node !== link) captionNodes.push(node);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node === link || node.contains(link) || node.querySelector('picture, img') || node.tagName === 'PICTURE') return;
    if (node.textContent.trim()) captionNodes.push(node);
  });

  const autoplay = block.classList.contains('autoplay');
  const loop = block.classList.contains('loop');
  const widthClass = [...block.classList].find((c) => /^width-\d+px$/.test(c));

  const frame = document.createElement('div');
  frame.className = 'video-frame';
  if (widthClass) frame.style.width = widthClass.replace('width-', '');

  const video = document.createElement('video');
  video.controls = true;
  video.setAttribute('controlslist', 'nodownload');
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.preload = autoplay ? 'auto' : 'metadata';
  const name = decodeURIComponent(href.split('/').pop().split('?')[0]);
  video.setAttribute('aria-label', name);
  if (poster) video.poster = poster;
  if (loop) video.loop = true;
  if (autoplay) {
    video.muted = true;
    video.setAttribute('muted', '');
    video.autoplay = true;
  }
  video.addEventListener('loadedmetadata', () => {
    if (video.videoWidth && video.videoHeight) {
      video.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      frame.style.maxWidth = `min(100%, ${video.videoWidth}px)`;
    }
  });

  const actions = document.createElement('div');
  actions.className = 'video-actions';
  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'video-info';
  info.setAttribute('aria-label', 'Open video with asset viewer');
  info.title = name;
  info.innerHTML = INFO_ICON;
  info.addEventListener('click', () => {
    video.pause();
    openViewer(block, href, name, poster);
  });
  actions.append(info);
  frame.append(video, actions);

  const container = document.createElement('div');
  container.className = 'video-container';
  container.append(frame);

  const children = [container];
  if (captionNodes.length) {
    const caption = document.createElement('div');
    caption.className = 'video-caption';
    caption.append(...captionNodes);
    children.push(caption);
  }
  block.replaceChildren(...children);

  loadWhenVisible(video, href, { autoplay, poster });
}
