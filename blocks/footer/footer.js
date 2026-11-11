import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { contentPath } from '../../scripts/scripts.js';

/**
 * loads and decorates the footer (the Frontify portal footer is empty; the /footer
 * document is kept so authors can add one)
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(contentPath(footerPath));

  block.textContent = '';
  if (!fragment) return;
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);
  // drop empty paragraphs so an empty footer document takes no space
  footer.querySelectorAll('p').forEach((p) => { if (!p.textContent.trim() && !p.querySelector('img,a')) p.remove(); });
  footer.querySelectorAll(':scope > div').forEach((d) => { if (!d.textContent.trim() && !d.querySelector('img')) d.remove(); });
  if (footer.children.length) block.append(footer);
}
