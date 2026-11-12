/*
 * Template Card (Frontify "Template" block): template preview, title, description and the
 * "Use this Template" button.
 * Rows:
 *   1. preview picture (may be empty)
 *   2. title + description + a paragraph with the button link (last link of the cell)
 *   3. "Settings | --tpl-bg: ...; --tpl-border: ...; --tpl-padding: ...; --tpl-radius: ...;
 *      --tpl-preview-bg: ...; --tpl-preview-border: ...; --tpl-preview-radius: ...;
 *      --tpl-preview-height: ...; --tpl-preview-position: ..." (all optional)
 * Variants: text-left|right, ratio-<25|33|50|66|75>, v-start|center|end, h-start|center|end,
 * preview-none|template|custom, display-fit|fill, button-primary|secondary|tertiary.
 */

const SETTING = /^--tpl-[a-z-]+$/;

function applySettings(block, value) {
  value.split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (SETTING.test(prop) && val && !/[<>{}]/.test(val)) block.style.setProperty(prop, val);
  });
}

export default function decorate(block) {
  const rows = [...block.children];
  let pictureRow = null;
  let textRow = null;
  rows.forEach((row) => {
    const cells = [...row.children];
    const key = cells.length > 1 ? cells[0].textContent.trim().toLowerCase() : '';
    if (key === 'settings') {
      applySettings(block, cells[1].textContent);
    } else if (!pictureRow && !textRow && !row.textContent.trim()) {
      pictureRow = row; // first row without text: the preview picture (or empty = no preview)
    } else if (!textRow) {
      textRow = row;
    }
  });

  const cls = block.classList;
  const img = pictureRow?.querySelector('picture, img');
  const showPreview = !cls.contains('preview-none') && img;

  const card = document.createElement('div');
  card.className = 'template-card-card';
  const content = document.createElement('div');
  content.className = 'template-card-content';
  card.append(content);

  // the preview layout (button under the text, text column at 1024px+) applies whenever a
  // preview is configured, also when its picture is missing
  if (!cls.contains('preview-none')) block.classList.add('has-preview');
  if (!cls.contains('preview-none')) {
    // without its picture the preview keeps its space, so the text sits where Frontify shows it
    const preview = document.createElement('div');
    preview.className = 'template-card-preview';
    if (showPreview) {
      const frame = document.createElement('div');
      frame.className = 'template-card-preview-frame';
      frame.append(img.closest('picture') || img);
      preview.append(frame);
    } else preview.classList.add('is-empty');
    content.append(preview);
  }

  // text: everything in the text cell except the button paragraph
  const wrapper = document.createElement('div');
  wrapper.className = 'template-card-text-cta';
  const text = document.createElement('div');
  text.className = 'template-card-text';
  const cell = textRow ? (textRow.children[textRow.children.length - 1]) : null;
  const links = cell ? [...cell.querySelectorAll('a[href]')] : [];
  const link = links[links.length - 1];
  const linkPara = link ? (link.closest('p') || link) : null;
  if (cell) {
    const nodes = [...cell.childNodes].filter((n) => n !== linkPara
      && !(n.nodeType === Node.TEXT_NODE && !n.textContent.trim()));
    const title = document.createElement('div');
    title.className = 'template-card-title';
    const description = document.createElement('div');
    description.className = 'template-card-description';
    // the first heading (or the first paragraph when there is no heading) is the title
    const titleNode = nodes.find((n) => /^H[1-6]$/.test(n.tagName)) || null;
    nodes.forEach((n) => (n === titleNode ? title : description).append(n));
    if (title.childNodes.length) text.append(title);
    if (description.childNodes.length) text.append(description);
  }
  wrapper.append(text);

  if (link) {
    const cta = document.createElement('div');
    cta.className = 'template-card-cta';
    const style = ['primary', 'secondary', 'tertiary']
      .find((s) => cls.contains(`button-${s}`)) || 'primary';
    link.className = `button template-card-button ${style}`;
    link.textContent = link.textContent.trim() || 'Use this Template';
    cta.append(link);
    wrapper.append(cta);
  }
  content.append(wrapper);

  block.replaceChildren(card);
}
