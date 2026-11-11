/*
 * Audio (Frontify "Audio" block): title + native audio player (+ optional download button).
 * Variant classes: downloadable, title-below.
 * Rows: "Title | rich text", a row linking the audio file, optional "Description | rich text".
 */

const AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|weba|opus)(\?|#|$)/i;

// Fondue "ArrowCircleDown" icon used by the Frontify download button
const DOWNLOAD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M3.5 12a8.5 8.5 0 1117 0 8.5 8.5 0 01-17 0M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12m14.42.13a.75.75 0 010 1.06l-.53-.53-.531-.53a.75.75 0 011.06 0m-.53.53.53.53h-.001l-.002.002-.005.006-.023.023-.088.088-.323.323-1.06 1.059-2.388 2.388-.53.53-.53-.53-3.89-3.889a.75.75 0 011.061-1.06l2.6 2.6V7.525a.75.75 0 111.5 0v7.222l1.117-1.117 1.06-1.06.322-.322.088-.088.023-.023.006-.005.001-.002z"/></svg>';

export default function decorate(block) {
  const title = document.createElement('div');
  title.className = 'audio-title';
  const description = document.createElement('div');
  description.className = 'audio-description';
  let fileLink = null;

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = cells.length > 1 ? cells[0].textContent.trim().toLowerCase() : '';
    const value = cells.length > 1 ? cells[cells.length - 1] : cells[0];
    if (!value) return;
    const link = [...row.querySelectorAll('a[href]')].find((a) => AUDIO_EXT.test(a.getAttribute('href')))
      || (!key && row.querySelector('a[href]'));
    if (link && !fileLink && key !== 'title' && key !== 'description') {
      fileLink = link;
      return;
    }
    if (key === 'description') description.append(...value.childNodes);
    else if (key === 'title' || !title.hasChildNodes()) title.append(...value.childNodes);
  });

  const header = document.createElement('div');
  header.className = 'audio-header';
  const text = document.createElement('div');
  text.className = 'audio-text';
  if (title.textContent.trim()) text.append(title);
  if (description.textContent.trim()) text.append(description);
  header.append(text);

  const elements = [header];
  if (fileLink) {
    const href = fileLink.getAttribute('href');
    const audio = document.createElement('audio');
    audio.className = 'audio-player';
    audio.controls = true;
    audio.preload = 'metadata';
    audio.setAttribute('controlslist', 'nodownload');
    const source = document.createElement('source');
    source.src = href;
    audio.append(source);
    audio.append(fileLink.cloneNode(true)); // fallback for browsers without <audio>
    elements.push(audio);

    if (block.classList.contains('downloadable')) {
      const addons = document.createElement('div');
      addons.className = 'audio-addons';
      const button = document.createElement('a');
      button.className = 'audio-download';
      button.href = href;
      // Prefer the authored link text (original file name); published URLs use URL-safe names.
      const linkText = (fileLink.textContent || '').trim();
      const fileName = /\.[a-z0-9]{2,5}$/i.test(linkText) ? linkText : decodeURIComponent(button.pathname.split('/').pop() || '');
      button.setAttribute('download', fileName);
      button.setAttribute('aria-label', 'Download');
      button.title = 'Download';
      button.innerHTML = DOWNLOAD_ICON;
      addons.append(button);
      header.append(addons);
    }
  }

  block.replaceChildren(...elements);
}
