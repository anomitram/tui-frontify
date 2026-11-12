/* global WebImporter */
/* Shared section/cell builder for Frontify documents in the new document theme (colour schemes,
 * 24-column sections): the cover page (import-doc-cover-page.js, The Mora home) and multi-page
 * documents (import-doc-theme-page.js, The Mora Brand/Hotels/Support/Libraries).
 * One EDS section per Frontify section ("doc-row" + scheme + columns metadata); every section
 * element (block) becomes exactly one grid cell, in source order. A block that cannot be built
 * still gets an empty cell, so the following cells keep their grid positions. */
import { slateToHtml, img, rgbaToCss } from './frontify.js';
import imageParser from '../parsers/image.js';
import dividerParser from '../parsers/divider.js';
import calloutParser from '../parsers/callout.js';
import annotationsParser from '../parsers/annotations.js';
import assetKitParser from '../parsers/asset-kit.js';
import colorsParser from '../parsers/colors.js';
import videoParser from '../parsers/video.js';
import imageGridParser from '../parsers/image-grid.js';

export const parseSlate = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : (v || []); } catch (e) { return []; } };
const slateEmpty = (v) => {
  const t = (x) => (x.text || '') + (x.children || []).map(t).join('');
  return !parseSlate(v).map(t).join('').trim();
};
const div = (ctx, html) => { const d = ctx.document.createElement('div'); d.innerHTML = html || ''; return d; };
const create = (ctx, name, cells) => WebImporter.Blocks.createBlock(ctx.document, { name, cells });
const css = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => `${k}: ${v}`).join('; ');
const asset = (b, key) => (b.assets?.[key] || [])[0];
const picture = (ctx, a, alt) => (a ? img(ctx, `asset-${a.id}`, ctx.alts[`asset-${a.id}`] ?? alt ?? '', { width: a.width, height: a.height }) : null);

/** Frontify Text block -> "Text (cell)" block: rich text + "n: class: <style>; text-align: x". */
export function textCell(b, ctx) {
  // a line break at the start of an element is an empty first line in Frontify; html2md drops
  // leading breaks, so a zero-width space goes before it (measured, doc 1887 page 8288)
  const leadBreak = (n) => {
    if (n.type === 'ul' || n.type === 'ol' || slateEmpty([n])) return n;
    let done = false;
    const walk = (x) => {
      if (done) return x;
      if (typeof x.text === 'string') {
        if (!x.text) return x;
        done = true;
        return /^\n/.test(x.text) ? { ...x, text: `\u200B${x.text}` } : x;
      }
      return x.children ? { ...x, children: x.children.map(walk) } : x;
    };
    return walk(n);
  };
  // Frontify text keeps runs of spaces (white-space: pre-wrap): a zero-width space between the
  // spaces keeps them from collapsing; no-break spaces (lost in html2md) travel as word joiners
  // (U+2060), which blocks/text turns back into no-break spaces
  const keepRuns = (x) => {
    if (typeof x.text === 'string') {
      const text = x.text.replace(/\u00A0/g, '\u2060')
        .replace(/ {2,}/g, (sp) => `${' \u200B'.repeat(sp.length - 1)} `);
      return text === x.text ? x : { ...x, text };
    }
    return x.children ? { ...x, children: x.children.map(keepRuns) } : x;
  };
  const nodes = parseSlate(b.settings?.content).map(keepRuns).map(leadBreak);
  const html = nodes.length ? slateToHtml(nodes, ctx, { keepEmptyBreaks: true }) : '<p>​</p>';
  const styles = [];
  nodes.forEach((n, i) => {
    const decl = [];
    // image title/caption elements have no style in a Text block: Frontify renders them as body
    // text (measured, doc 1887 pages 8280 and 9981)
    if (n.type && !['p', 'ul', 'ol', 'imageTitle', 'imageCaption'].includes(n.type)) decl.push(`class: ${n.type}`);
    if (n.align) decl.push(`text-align: ${n.align}`);
    // a button whose text carries a text style (e.g. heading1: letter-spacing, uppercase)
    const btnStyle = (n.children || []).filter((c) => c.type === 'button')
      .flatMap((c) => (c.children || []).map((t) => t.textStyle)).find(Boolean);
    if (btnStyle) decl.push(`button-class: ${btnStyle}`);
    // list items take the text style of their text (e.g. custom2: font, 10px below each item;
    // measured, doc 1887 page 9976)
    if (n.type === 'ul' || n.type === 'ol') {
      const leaf = (x) => (typeof x.text === 'string' ? x.textStyle : (x.children || []).map(leaf).find(Boolean));
      const liStyle = (n.children || []).map(leaf).find((t) => t && t !== 'p');
      if (liStyle) decl.push(`li-class: ${liStyle}`);
    }
    if (decl.length) styles.push(`${i + 1}: ${decl.join('; ')}`);
  });
  const rows = [[div(ctx, html)]];
  if (styles.length) rows.push(['Styles', styles.join('\n')]);
  const cols = Number(b.settings?.columnNumber || 1);
  return create(ctx, `Text (cell${cols > 1 ? `, columns-${cols}` : ''})`, rows);
}

/** Empty cell (keeps the grid position of a block that has no output; Frontify shows such a
 * block, e.g. an Image without asset, as a 0px high grid item - measured, doc 1887 page 8294). */
const emptyCell = (ctx) => create(ctx, 'Text (cell, empty)', [[div(ctx, '<p>​</p>')]]);

/** Frontify page heading (sidebar entry, anchor = Frontify slug): "Text (cell, heading)". */
export function headingCell(b, ctx) {
  const st = b.settings || {};
  const n = String(st.type_style || 'HEADING2').replace(/\D/g, '') || '2';
  const style = /^CUSTOM/.test(st.type_style || '') ? `custom${n}` : `heading${n}`;
  const tag = `h${Math.min(Math.max(Number(n) || 2, 2), 4)}`;
  const d = ctx.document.createElement('div');
  const h = ctx.document.createElement(tag);
  h.textContent = b.title || '';
  d.append(h);
  const decl = [`class: ${style}`, `id: ${b.slug}`];
  if (st.alignment && st.alignment !== 'LEFT') decl.push(`text-align: ${st.alignment.toLowerCase()}`);
  // respect_columns false (Frontify default): the heading takes the whole grid row
  const variant = st.respect_columns ? 'cell, heading' : 'cell, heading, full-width';
  return create(ctx, `Text (${variant})`, [[d], ['Styles', `1: ${decl.join('; ')}`]]);
}

/** Frontify "Cards Grid" (marketplace block): image cards with a text overlay and a link. */
export function cardsGrid(b, ctx) {
  const s = b.settings || {};
  const low = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ratio = (v) => (/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(v || '') ? v.replace(':', ' / ') : '');
  const length = (v) => (/^\d+(\.\d+)?(px|%|rem|em|vh)$/.test(v || '') ? v : '');
  const some = (v) => v && v !== 'None';
  const isText = s.cardType === 'Text';
  const textRatio = s.hasCustomTextRatio ? s.customTextRatio : s.textRatioChoice;
  const imageSize = s.hasCustomImageHeightOrRatio ? s.customImageHeightOrRatio : s.imageRatioChoice;
  const textWidth = s.hasCustomTextFieldMaxWidth ? s.customTextFieldMaxWidth : s.textFieldMaxWidthChoice;
  const variants = [
    `columns-${s.columnCount || 3}`,
    s.positioning && `text-${low(s.positioning)}`,
    // anchor of the image (and the fallback text alignment)
    s.horizontalAlignment && `h-${low(s.horizontalAlignment)}`,
    s.verticalAlignment && `v-${low(s.verticalAlignment)}`,
    // text alignment inside the card (Frontify: text alignment settings win over the anchor)
    some(s.horizontalTextAlignment) && `align-${low(s.horizontalTextAlignment)}`,
    some(s.verticalTextAlignment) && `valign-${low(s.verticalTextAlignment)}`,
    !s.hasCustomPadding && s.paddingChoice && `padding-${low(s.paddingChoice)}`,
    !s.hasCustomSpacing && s.spacingChoice && `spacing-${low(s.spacingChoice)}`,
    s.display && `display-${low(s.display)}`,
    s.hasBorder && 'border',
    !s.hasRadius && s.radiusChoice && `radius-${low(s.radiusChoice)}`,
    s.cardType && `type-${low(s.cardType)}`,
    s.hasBackground && s.backgroundColor && 'background',
    isText && !s.hasCustomTextRatio && some(textRatio) && ratio(textRatio) && `ratio-${low(textRatio)}`,
    !isText && !s.hasCustomImageHeightOrRatio && some(imageSize) && ratio(imageSize) && `image-${low(imageSize)}`,
    !s.hasCustomTextFieldMaxWidth && some(textWidth) && length(textWidth) && `width-${low(textWidth)}`,
  ].filter(Boolean);
  // Frontify shows the editors' text with white-space: pre-wrap; keep repeated and leading spaces
  // (no-break spaces) and leading line breaks (zero-width space before them) through html2md
  const keepSpaces = (node) => {
    let first = true;
    const walk = (x) => {
      if (typeof x.text === 'string') {
        let t = x.text.replace(/ {2,}/g, (m) => ` ${'\u00A0'.repeat(m.length - 1)}`);
        if (first && t) {
          t = t.replace(/^ /, '\u00A0').replace(/^\n/, '\u200B\n');
          first = false;
        }
        if (/\n$/.test(t)) t = `${t}\u200B`; // a break at the end of an inline run is dropped
        return { ...x, text: t };
      }
      return x.children ? { ...x, children: x.children.map(walk) } : x;
    };
    return walk(node);
  };
  const rows = [];
  (s.items || []).forEach((it) => {
    const a = asset(b, it.id);
    const pic = picture(ctx, a, it.altText);
    // optional title (Slate) above the description; Frontify hides an editor without any text
    // (line breaks and spaces count as text)
    const allText = (x) => (x.text || '') + (x.children || []).map(allText).join('');
    const editor = (v, title) => {
      const ns = parseSlate(v);
      return ns.map(allText).join('') ? ns.map((n) => ({ n: keepSpaces(n), title })) : [];
    };
    const nodes = [...editor(it.title, true), ...editor(it.description, false)];
    const href = it.link?.href;
    if (!a && !nodes.length && !href) return; // Frontify's trailing placeholder item
    const text = div(ctx, nodes.map(({ n }) => slateToHtml([n], ctx, { keepEmptyBreaks: true })).join(''));
    // styles cell: "title: <number of title elements>", "all: text-align: x" (when every element
    // has the same alignment), "n: class: <text style>; text-align: x" for the n-th element
    const titles = nodes.filter((x) => x.title).length;
    // "all" = the most common alignment when every element has one; others are listed
    const count = {};
    nodes.forEach(({ n }) => { if (n.align) count[n.align] = (count[n.align] || 0) + 1; });
    const allAlign = nodes.length > 1 && nodes.every(({ n }) => n.align)
      && Object.keys(count).sort((x, y) => count[y] - count[x])[0];
    const styles = nodes.map(({ n }, i) => {
      const decl = [];
      // text styles the tag does not carry; an empty element (spacer) becomes a <p>, so it
      // keeps its style (line height, margins) as a class
      const tagged = { custom3: 'custom3', imageTitle: 'image-title', imageCaption: 'image-caption' };
      const cls = tagged[n.type] || (n.type && n.type !== 'p' && slateEmpty([n]) ? n.type : '');
      if (cls) decl.push(`class: ${cls}`);
      if (n.align && n.align !== allAlign) decl.push(`text-align: ${n.align}`);
      return decl.length ? `${i + 1}: ${decl.join('; ')}` : '';
    }).filter(Boolean);
    if (allAlign) styles.unshift(`all: text-align: ${allAlign}`);
    if (titles) styles.unshift(`title: ${titles}`);
    // own card background ("on"; "inherit" = the block's); library colours have alpha 0..255
    const bg = it.hasBackground === 'on' && it.backgroundColor;
    if (bg) styles.push(`card: --cards-bg: ${rgbaToCss({ ...bg, alpha: (bg.alpha ?? 1) > 1 ? Math.round((bg.alpha / 255) * 100) / 100 : bg.alpha })}`);
    const link = href ? ctx.document.createElement('a') : '';
    if (link) { link.href = href; link.textContent = href; }
    const row = [pic || '', text, link];
    if (styles.length) row.push(styles.join('\n'));
    rows.push(row);
  });
  const settings = css({
    '--cards-bg': s.hasBackground && s.backgroundColor ? rgbaToCss(s.backgroundColor) : '',
    '--cards-border': s.hasBorder ? `${s.borderWidth || '1px'} ${low(s.borderStyle || 'solid')} ${rgbaToCss(s.borderColor)}` : '',
    '--cards-gap': s.hasCustomSpacing ? length(s.spacingCustom) : '',
    '--cards-padding': s.hasCustomPadding ? length(s.customPadding) : '',
    '--cards-radius': s.hasRadius ? length(s.radiusValue) : '',
    '--cards-ratio': isText && s.hasCustomTextRatio ? ratio(textRatio) : '',
    '--cards-image-ratio': !isText && s.hasCustomImageHeightOrRatio ? ratio(imageSize) : '',
    '--cards-image-height': !isText && s.hasCustomImageHeightOrRatio ? length(imageSize) : '',
    '--cards-text-width': s.hasCustomTextFieldMaxWidth ? length(textWidth) : '',
  });
  if (settings) rows.push(['Settings', settings]);
  return create(ctx, `Cards Grid (${variants.join(', ')})`, rows);
}

/** Frontify "Slider" (marketplace block): image carousel. */
export function slider(b, ctx) {
  const s = b.settings || {};
  const variants = [
    `columns-${s.columns || 1}`, s.assetHeight && `height-${s.assetHeight}`, s.autoplay && 'autoplay',
    s.splideElements && s.splideElements !== 'none' && `controls-${s.splideElements}`,
  ].filter(Boolean);
  const rows = (s.slides || []).map((sl) => {
    const pic = picture(ctx, asset(b, `slide_asset_image_${sl.id}`), '');
    const cap = div(ctx, slateToHtml(parseSlate(sl.text), ctx, { keepEmpty: false }) || '');
    return cap.textContent.trim() ? [pic || '', cap] : [pic || ''];
  });
  if (s.autoplay && s.autoplayInterval) rows.push(['Interval', String(s.autoplayInterval)]);
  if (s.sliderGap && s.sliderGap !== '0') rows.push(['Gap', `${s.sliderGap}px`]);
  return create(ctx, `Slider (${variants.join(', ')})`, rows);
}

/** Frontify "Flip Card" (marketplace block): cards that turn over on hover (or click).
 * Rows: Settings (CSS variables), then per card: front | back | style. Each face: optional picture
 * (first paragraph; shown like Frontify's face background: --front-size contain/cover,
 * --front-position) + rich text. Style cell: colours/sizes as CSS variables, then the Frontify text
 * styles of each face as in the Text block: "Front: 1: class: heading4; text-align: center 2: ...". */
export function flipCard(b, ctx) {
  const s = b.settings || {};
  // Frontify text keeps runs of spaces (white-space: pre-wrap); a zero-width space between the
  // spaces keeps them from collapsing (no-break spaces do not survive the conversion)
  const keepSpaces = (html) => html.replace(/(^|>)([^<]+)/g, (m, a, t) => a + t.replace(/ {2,}/g, (sp) => `${' \u200B'.repeat(sp.length - 1)} `));
  // "n: class: <style>; text-align: x" for the n-th top-level element of a face (Text block syntax)
  const faceStyles = (nodes) => nodes.map((n, i) => {
    const decl = [];
    if (n.type && !['p', 'ul', 'ol'].includes(n.type)) decl.push(`class: ${n.type}`);
    if (n.align) decl.push(`text-align: ${n.align}`);
    return decl.length ? `${i + 1}: ${decl.join('; ')}` : '';
  }).filter(Boolean).join(' ');
  let radius = '0';
  if (s.borderRadius_enabled) {
    radius = s.borderRadius_detailed
      ? [s.borderRadius_topLeft, s.borderRadius_topRight, s.borderRadius_bottomRight, s.borderRadius_bottomLeft].join(' ')
      : s.borderRadius_value;
  }
  let pad = '0';
  if (s.padding_enabled) {
    pad = s.padding_detailed
      ? [s.padding_top, s.padding_right, s.padding_bottom, s.padding_left].join(' ') : s.padding_value;
  }
  const settings = css({
    '--flip-cols-l': s.grid_large_columns,
    '--flip-bp-l': s.grid_large_breakpoint,
    '--flip-cols-m': s.grid_medium_columns,
    '--flip-bp-m': s.grid_medium_breakpoint,
    '--flip-cols-s': s.grid_small_columns,
    '--flip-gap': s.grid_gap_size,
    '--flip-min-height': s.cardDimensions_min_height,
    '--flip-border': s.border_enabled ? `${s.border_width} ${s.border_style} ${rgbaToCss(s.border_color)}` : 'none',
    '--flip-radius': radius,
    '--flip-shadow': s.shadow_heading ? `${s.shadow_x} ${s.shadow_y} ${s.shadow_size} ${rgbaToCss(s.shadow_color)}` : 'none',
    '--flip-padding': pad,
    '--flip-duration': s.animation_duration,
    '--flip-timing': s.animation_timing,
    '--flip-perspective': s.animation_perspective,
  });
  const variants = [s.animation_flipOnClick ? 'click' : 'hover', `direction-${s.animation_direction || 'left'}`];
  const rows = [['Settings', settings]];
  (s.cards || []).forEach((c) => {
    const side = (name) => {
      const sd = c[name] || {};
      const cell = ctx.document.createElement('div');
      const a = asset(b, `${c.id}_${name}`) || (sd.asset ? { id: sd.asset.id, width: sd.asset.width, height: sd.asset.height } : null);
      const pic = picture(ctx, a, sd.asset?.alternativeText || '');
      if (pic) { const p = ctx.document.createElement('p'); p.append(pic); cell.append(p); }
      if (!slateEmpty(sd.text)) cell.append(...div(ctx, keepSpaces(slateToHtml(parseSlate(sd.text), ctx, { keepEmptyBreaks: true }))).childNodes);
      return cell;
    };
    const vars = css({
      '--front-bg': rgbaToCss(c.front?.bgColor),
      '--front-color': rgbaToCss(c.front?.color),
      '--front-size': c.front?.bgSize,
      '--front-position': (c.front?.bgPosition || '').replace('-', ' '),
      '--back-bg': rgbaToCss(c.back?.bgColor),
      '--back-color': rgbaToCss(c.back?.color),
      '--back-size': c.back?.bgSize,
      '--back-position': (c.back?.bgPosition || '').replace('-', ' '),
    });
    const style = ctx.document.createElement('div');
    const para = (t) => { const p = ctx.document.createElement('p'); p.textContent = t; style.append(p); };
    if (vars) para(vars);
    ['front', 'back'].forEach((name) => {
      const spec = slateEmpty(c[name]?.text) ? '' : faceStyles(parseSlate(c[name].text));
      if (spec) para(`${name === 'front' ? 'Front' : 'Back'}: ${spec}`);
    });
    rows.push([side('front'), side('back'), style]);
  });
  return create(ctx, `Flip Card (${variants.join(', ')})`, rows);
}

/** Frontify "Do & Don't": rows type (Do/Dont) | image | title (h4) + text; Settings row (CSS).
 * Colours: the stored doColor/dontColor only count when hasCustomDoColor/hasCustomDontColor is
 * set; otherwise the block's defaults apply (CSS fallbacks in blocks/dos-donts). Empty body
 * paragraphs are kept: Frontify renders them, and they set the row height. */
export function dosDonts(b, ctx) {
  const s = b.settings || {};
  // Frontify text keeps runs of spaces (white-space: pre-wrap); a zero-width space between the
  // spaces keeps them from collapsing (no-break spaces do not survive the conversion)
  const keepSpaces = (html) => html.replace(/(^|>)([^<]+)/g, (m, a, t) => a + t.replace(/ {2,}/g, (sp) => `${' \u200B'.repeat(sp.length - 1)} `));
  const variants = [
    `columns-${s.columns || 2}`, s.mode && `mode-${s.mode.replace(/_/g, '-')}`, s.style && `style-${s.style}`,
    s.keepSideBySide && 'side-by-side', s.hasStrikethrough && 'strikethrough', s.imageDisplay && `image-${s.imageDisplay}`,
    s.doIconChoice && `do-icon-${s.doIconChoice.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`,
    s.dontIconChoice && `dont-icon-${s.dontIconChoice.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`,
  ].filter(Boolean);
  const RADII = {
    None: '0px', Small: '2px', Medium: '4px', Large: '12px',
  };
  const GUTTERS = {
    None: '0px', Small: '10px', Medium: '30px', Large: '50px',
  };
  const gutter = (custom, val, choice) => (custom ? val : GUTTERS[choice] || choice);
  const settings = css({
    '--dd-col-gap': gutter(s.isCustomColumnGutter, s.customColumnGutterValue, s.columnGutterChoice),
    '--dd-row-gap': gutter(s.isCustomRowGutter, s.customRowGutterValue, s.rowGutterChoice),
    '--dd-do-color': s.hasCustomDoColor ? rgbaToCss(s.doColor) : '',
    '--dd-dont-color': s.hasCustomDontColor ? rgbaToCss(s.dontColor) : '',
    '--dd-bg': s.hasBackground ? rgbaToCss({ alpha: 1, ...s.backgroundColor }) : '',
    '--dd-border': s.hasBorder ? `${s.borderWidth} ${String(s.borderStyle).toLowerCase()} ${rgbaToCss(s.borderColor)}` : '',
    '--dd-radius': s.hasRadius ? (RADII[s.radiusChoice] || s.radiusChoice) : '',
    '--dd-image-height': s.isCustomImageHeight ? s.customImageHeightValue : '',
  });
  const rows = [['Settings', settings]];
  (s.items || []).forEach((it) => {
    const pic = picture(ctx, asset(b, it.id), it.alt || '');
    const text = ctx.document.createElement('div');
    if (it.title) text.append(...div(ctx, `<h4>${it.title.replace(/</g, '&lt;')}</h4>`).childNodes);
    if (!slateEmpty(it.body)) text.append(...div(ctx, keepSpaces(slateToHtml(parseSlate(it.body), ctx, { keepEmptyBreaks: true }))).childNodes);
    rows.push([it.type === 'Do' ? 'Do' : "Don't", pic || '', text]);
  });
  return create(ctx, `Dos Donts (${variants.join(', ')})`, rows);
}

/** Frontify "Quote" (marketplace block). Rows: quote text | optional "Author | name" | optional
 * "Settings | css". Quotation marks type: marks left/right of the text (no accent line, measured);
 * indentation type: accent line left of the text. Colours only when set as custom (otherwise the
 * theme's quote colour); empty quote paragraphs are kept (Frontify renders them as lines). */
export function quote(b, ctx) {
  const s = b.settings || {};
  const marks = s.type === 'QuotationMarks';
  const kebab = (v) => String(v).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, '');
  const variants = [
    marks ? 'quotation-marks' : 'indentation',
    marks && `left-${kebab(s.quoteStyleLeft || 'None')}`,
    marks && `right-${kebab(s.quoteStyleRight || 'None')}`,
    `align-${s.textAlignment || 'left'}`, marks && s.quotationMarksAnchoring && `anchor-${kebab(s.quotationMarksAnchoring)}`,
    !s.isCustomSize && s.sizeChoice && `size-${s.sizeChoice.replace(/Size$/, '').toLowerCase()}`,
    !marks && s.showAccentLine && 'accent-line',
  ].filter(Boolean);
  const rows = [[div(ctx, slateToHtml(parseSlate(s.content), ctx, { keepEmptyBreaks: true }))]];
  if (s.showAuthor && s.authorName) rows.push(['Author', s.authorName]);
  const settings = css({
    '--quote-marks-color': marks && s.isCustomQuotesColor ? rgbaToCss(s.quotesColor) : '',
    '--quote-size': s.isCustomSize ? s.sizeValue : '',
    '--quote-line': !marks && s.showAccentLine ? `${s.lineWidthValue || '2px'} ${s.lineType || 'solid'} ${s.isCustomLineColor ? rgbaToCss(s.accentLineColor) : 'currentcolor'}` : '',
  });
  if (settings) rows.push(['Settings', settings]);
  return create(ctx, `Quote (${variants.join(', ')})`, rows);
}

/** Frontify "Table" (legacy reference block): header row + rows of HTML cells; widths as variant. */
export function table(b, ctx) {
  const s = b.settings || {};
  const cols = s.columns || [];
  // Frontify spacer paragraphs (<p><br></p>) keep their line as a zero-width space (survives
  // html2md); editor classes (quill-clean, link) are dropped.
  const cell = (h) => div(ctx, String(h || '')
    .replace(/<p>(\s|&nbsp;|<br[^>]*>)*<\/p>/g, '<p>​</p>')
    .replace(/<br class="softbreak"\s*\/?>/g, '<br>')
    .replace(/\s(class|data-tooltip-link-label)="[^"]*"/g, ''));
  const rows = [cols.map((c) => cell(c.label))];
  (s.data || []).forEach((r) => rows.push(cols.map((c, i) => cell(Array.isArray(r) ? r[i] : r[c.field]))));
  const widths = cols.map((c) => c.width).filter(Boolean);
  return create(ctx, `Table (frontify${widths.length === cols.length ? `, widths-${widths.join('-')}` : ''})`, rows);
}

/** Frontify "Template" block: template preview, title, description and the "Use this Template"
 * button (Frontify's template editor - not migrated, so it links to the original page). */
export function templateCard(b, ctx, data) {
  const s = b.settings || {};
  const variants = [
    `text-${s.textPositioning || 'left'}`, s.textRatio && `ratio-${s.textRatio}`,
    s.textAnchoringVertical && `v-${s.textAnchoringVertical}`, s.textAnchoringHorizontal && `h-${s.textAnchoringHorizontal}`,
    `preview-${s.preview || 'template'}`, s.previewDisplay && `display-${s.previewDisplay}`,
    s.buttonStyle && `button-${s.buttonStyle}`, s.hasPageCount && 'page-count',
  ].filter(Boolean);
  // measured in the captures: Medium = 20px (page 10142), Large = 30px (doc 1888); Frontify's
  // radius switch hasRadius_* means "custom value", otherwise the radius choice applies
  const PADDING = {
    None: '0px', Small: '10px', Medium: '20px', Large: '30px',
  };
  const pad = s.hasCustomPaddingValue_blockCard ? s.paddingCustom_blockCard
    : PADDING[s.paddingChoice_blockCard];
  const RADIUS = {
    None: '0px', Small: '2px', Medium: '4px', Large: '12px',
  };
  const radius = (id) => (s[`hasRadius_${id}`] ? s[`radiusValue_${id}`] : RADIUS[s[`radiusChoice_${id}`]]);
  const PREVIEW_HEIGHT = {
    auto: 'auto', small: '200px', medium: '400px', large: '600px',
  };
  const settings = css({
    '--tpl-bg': s.hasBackground ? rgbaToCss(s.backgroundColor) : '',
    '--tpl-border': s.hasBorder_blockCard ? `${s.borderWidth_blockCard} ${String(s.borderStyle_blockCard).toLowerCase()} ${rgbaToCss(s.borderColor_blockCard)}` : '',
    '--tpl-padding': pad,
    '--tpl-radius': radius('blockCard'),
    '--tpl-preview-bg': s.hasBackgroundTemplatePreview ? rgbaToCss(s.backgroundColorTemplatePreview) : '',
    '--tpl-preview-border': s.hasBorder_templatePreview ? `${s.borderWidth_templatePreview} ${String(s.borderStyle_templatePreview).toLowerCase()} ${rgbaToCss(s.borderColor_templatePreview)}` : '',
    '--tpl-preview-height': s.isPreviewHeightCustom ? s.previewHeightCustom : PREVIEW_HEIGHT[s.previewHeightSimple],
    '--tpl-preview-radius': radius('templatePreview'),
    '--tpl-preview-position': s.previewImageAnchoring,
  });
  // preview "none" hides the picture (a stored custom preview is not shown); "template" shows the
  // template's own preview, which the export does not contain
  const preview = s.preview || 'template';
  let a = null;
  if (preview === 'custom') a = asset(b, 'previewCustom');
  else if (preview === 'template') a = (b.assets?.templatePreview || [])[0] || null;
  // a preview supplied by hand (extra-assets.json: template-preview-<blockId>, from the capture)
  const extraKey = `template-preview-${b.id}`;
  const extraPic = preview !== 'none' && !a && ctx.assets[extraKey] ? img(ctx, extraKey, 'Template preview') : null;
  if (preview !== 'none' && !a && !extraPic) ctx.notes.push(`Template block ${b.id}: preview image (${preview}) not in the export, preview left empty`);
  const text = ctx.document.createElement('div');
  if (!slateEmpty(s.title)) text.append(...div(ctx, slateToHtml(parseSlate(s.title), ctx, { keepEmpty: false })).childNodes);
  if (!slateEmpty(s.description)) text.append(...div(ctx, slateToHtml(parseSlate(s.description), ctx, { keepEmpty: false })).childNodes);
  const p = ctx.document.createElement('p');
  const btn = ctx.document.createElement('a');
  btn.href = data.originalUrl;
  btn.textContent = 'Use this Template';
  p.append(btn);
  text.append(p);
  ctx.notes.push(`Template block ${b.id}: "Use this Template" opens Frontify's template editor (not migrated); links to the Frontify page`);
  return create(ctx, `Template Card (${variants.join(', ')})`, [[extraPic || picture(ctx, a, '') || ''], [text], ['Settings', settings]]);
}

const LEGACY = {
  Divider: dividerParser,
  Callout: calloutParser,
  Annotations: annotationsParser,
  'Asset Kit': assetKitParser,
  Colors: colorsParser,
  Video: videoParser,
  'Image grid': imageGridParser,
};

/** One cell for one Frontify section element. */
export function cellFor(b, ctx, data) {
  const type = b.display_name || (b.slug !== undefined ? 'Heading' : 'Unknown');
  let out = null;
  if (type === 'Text') out = textCell(b, ctx);
  else if (type === 'Heading') out = headingCell(b, ctx);
  else if (type === 'Image') {
    const a = (b.assets?.image || [])[0];
    if (a && ctx.alts[`asset-${a.id}`] !== undefined) { a.alternative_text = ctx.alts[`asset-${a.id}`]; b.settings.altText = ctx.alts[`asset-${a.id}`]; }
    [out] = imageParser(b, ctx);
  } else if (type === 'Cards Grid') out = cardsGrid(b, ctx);
  else if (type === 'Slider') out = slider(b, ctx);
  else if (type === 'Flip Card') out = flipCard(b, ctx);
  else if (type === "Do & Don't") out = dosDonts(b, ctx);
  else if (type === 'Quote') out = quote(b, ctx);
  else if (type === 'Table') out = table(b, ctx);
  else if (type === 'Template') out = templateCard(b, ctx, data);
  else if (LEGACY[type]) [out] = LEGACY[type](b, ctx, {});
  else ctx.notes.push(`Unknown block type ${type} (${b.id})`);
  if (!out) ctx.notes.push(`${type} ${b.id}: no output, empty cell kept`);
  return { type, el: out || emptyCell(ctx) };
}

/** All sections of a page; returns { main, counts }. Section Metadata carries the grid. */
export function buildSections(data, ctx) {
  const { document } = ctx;
  const main = document.createElement('div');
  const counts = {};
  data.sections.forEach((s, i) => {
    if (i > 0) main.append(document.createElement('hr'));
    (s.content || []).forEach((b) => {
      const { type, el } = cellFor(b, ctx, data);
      counts[type] = (counts[type] || 0) + 1;
      main.append(el);
    });
    const meta = {
      Style: `doc-row, ${s.scheme}`,
      Section: String(s.id),
      Columns: (s.column_proportions || [24]).join(' '),
    };
    if (s.vertical_padding || s.horizontal_padding) meta.Padding = `${s.vertical_padding || 'default'} ${s.horizontal_padding || 'default'}`;
    if (s.vertical_gutter || s.horizontal_gutter) meta.Gutter = `${s.vertical_gutter || 'default'} ${s.horizontal_gutter || 'default'}`;
    if (s.max_width && s.max_width !== 'inherit') meta['Max Width'] = s.max_width;
    if (s.alignment) meta.Alignment = s.alignment;
    // tabbed section group: consecutive sections with the same group id, one tab each
    if (s.group_id) { meta['Tab Group'] = s.group_id; meta.Tab = s.label || ''; }
    main.append(create(ctx, 'Section Metadata', meta));
  });
  return { main, counts };
}

export function makeCtx(document, data, notes) {
  return {
    host: data.host,
    docId: data.doc.id,
    document,
    WebImporter,
    assets: data.assets,
    alts: data.alts || {},
    assetNames: data.assetNames || {},
    linkMap: data.linkMap,
    order: [],
    firstPath: data.pagePath,
    permalinks: {},
    colors: data.colors || {},
    links: [],
    missing: [],
    notes,
    // new document theme: parsers keep Frontify text styles (e.g. image title/caption styles)
    docTheme: true,
  };
}
