import { readBlockConfig, toClassName } from '../../scripts/aem.js';

/**
 * Applies Section Metadata to its section: "Style" becomes classes, every other key a
 * data attribute (e.g. Vertical Gutter -> data-vertical-gutter). The block removes itself.
 * Supported Frontify section settings: vertical/horizontal gutter, vertical/horizontal padding,
 * max width, alignment.
 */
export default function decorate(block) {
  const section = block.closest('.section');
  const config = readBlockConfig(block);
  if (section) {
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'style') {
        String(value).split(',').map((v) => toClassName(v.trim())).filter(Boolean)
          .forEach((c) => section.classList.add(c));
      } else {
        section.dataset[toClassName(key).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = value;
      }
    });
    if (config['vertical-gutter']) section.style.rowGap = config['vertical-gutter'];
    if (config['horizontal-gutter']) section.style.columnGap = config['horizontal-gutter'];
    if (config['vertical-padding']) {
      section.style.paddingTop = config['vertical-padding'];
      section.style.paddingBottom = config['vertical-padding'];
    }
    if (config['horizontal-padding']) {
      section.style.paddingLeft = config['horizontal-padding'];
      section.style.paddingRight = config['horizontal-padding'];
    }
    if (config['max-width']) section.style.maxWidth = config['max-width'];
  }
  const wrapper = block.parentElement;
  block.remove();
  if (wrapper && wrapper.classList.contains('section-metadata-wrapper') && !wrapper.children.length) wrapper.remove();
}
