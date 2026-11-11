/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-guideline-page.js
  var import_guideline_page_exports = {};
  __export(import_guideline_page_exports, {
    default: () => import_guideline_page_default,
    rewriteLink: () => rewriteLink
  });

  // tools/importer/utils/frontify.js
  var HOST = "https://tui-brandhub.com";
  var DOC_ID = "396";
  var esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  var decodeEntities = (s) => String(s).replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, "\xA0");
  function rewriteLink(url, ctx) {
    if (!url) return { href: url, kind: "empty" };
    let u = url.trim();
    const mailLike = /^https?:\/\/([^/@\s]+@[^/\s]+\.[a-z]{2,})\/?$/i.exec(u);
    if (mailLike) return { href: `mailto:${mailLike[1]}`, kind: "email", fixed: true };
    if (u.startsWith("/")) u = HOST + u;
    let parsed;
    try {
      parsed = new URL(u);
    } catch (e) {
      return { href: url, kind: "external" };
    }
    if (parsed.host !== "tui-brandhub.com") return { href: url, kind: "external" };
    if (parsed.pathname.startsWith("/r/")) {
      const target = ctx.permalinks[parsed.pathname];
      if (target) return { href: target, kind: "internal" };
      return { href: u, kind: "out-of-scope" };
    }
    const m = /^\/document\/(\d+)\/?$/.exec(parsed.pathname);
    if (m && m[1] === DOC_ID) {
      const hash = parsed.hash.replace(/^#\/?/, "");
      if (!hash) return { href: ctx.firstPath, kind: "internal" };
      const [cat, slug, heading] = hash.split("/");
      const page = ctx.order.find((p) => (p.cat || "-") === cat && p.slug === slug);
      if (page) return { href: heading ? `${page.path}#${heading}` : page.path, kind: "internal" };
      return { href: u, kind: "out-of-scope" };
    }
    return { href: u, kind: "out-of-scope" };
  }
  var BLOCK_TAGS = {
    p: "p",
    heading1: "h1",
    heading2: "h2",
    heading3: "h3",
    heading4: "h4",
    custom1: "h5",
    custom2: "h6",
    custom3: "p",
    quote: "blockquote",
    imageTitle: "p",
    imageCaption: "p"
  };
  function slateToHtml(value, ctx, opts = {}) {
    let nodes = value;
    if (typeof value === "string") {
      if (!value.trim().startsWith("[")) return value;
      try {
        nodes = JSON.parse(value);
      } catch (e) {
        return esc(value);
      }
    }
    if (!Array.isArray(nodes)) return "";
    const out = nodes.map((n) => blockNode(n, ctx, opts)).join("");
    return out;
  }
  function slateIsEmpty(value) {
    if (!value) return true;
    let nodes = value;
    if (typeof value === "string") {
      try {
        nodes = JSON.parse(value);
      } catch (e) {
        return !value.trim();
      }
    }
    const text = (n) => (n.text || "") + (n.children || []).map(text).join("");
    return !(nodes || []).some((n) => text(n).trim() || n.type === "button" || (n.children || []).some((c) => c.type === "a" || c.type === "button"));
  }
  function wrapKeepSpaces(open, inner, close) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
    if (!m[2]) return inner;
    return `${m[1]}${open}${m[2]}${close}${m[3]}`;
  }
  function inline(nodes, ctx) {
    return (nodes || []).map((n) => {
      var _a, _b, _c, _d;
      if ((n.type === "a" || n.type === "link") && (!n.url || n.url === "null")) {
        const label = inline(n.children, ctx);
        const plain = label.replace(/<[^>]+>/g, "").trim();
        if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(plain)) {
          (_a = ctx.links) == null ? void 0 : _a.push({
            source: String(n.url),
            href: `mailto:${plain}`,
            kind: "email",
            fixed: true
          });
          return `<a href="mailto:${esc(plain)}">${label}</a>`;
        }
        (_b = ctx.notes) == null ? void 0 : _b.push(`Link without target dropped (text kept): ${plain}`);
        return label;
      }
      if (n.type === "a" || n.type === "link") {
        const { href, kind } = rewriteLink(n.url, ctx);
        (_c = ctx.links) == null ? void 0 : _c.push({ source: n.url, href, kind });
        const target = n.target === "_blank" ? ' target="_blank"' : "";
        return wrapKeepSpaces(`<a href="${esc(href)}"${target}>`, inline(n.children, ctx), "</a>");
      }
      if (n.type === "button") {
        const { href, kind } = rewriteLink(n.url, ctx);
        (_d = ctx.links) == null ? void 0 : _d.push({ source: n.url, href, kind });
        return wrapKeepSpaces(`<strong><a href="${esc(href)}">`, inline(n.children, ctx), "</a></strong>");
      }
      if (n.children) return inline(n.children, ctx);
      let t = esc(decodeEntities(n.text || "")).replace(/\n/g, "<br>");
      if (!t) return "";
      if (n.code) t = wrapKeepSpaces("<code>", t, "</code>");
      if (n.underline) t = wrapKeepSpaces("<u>", t, "</u>");
      if (n.strikethrough) t = wrapKeepSpaces("<s>", t, "</s>");
      if (n.italic) t = wrapKeepSpaces("<em>", t, "</em>");
      if (n.bold) t = wrapKeepSpaces("<strong>", t, "</strong>");
      if (n.superscript) t = wrapKeepSpaces("<sup>", t, "</sup>");
      if (n.subscript) t = wrapKeepSpaces("<sub>", t, "</sub>");
      return t;
    }).join("");
  }
  function listItems(n, ctx) {
    return (n.children || []).map((li) => {
      const parts = (li.children || []).map((c) => {
        if (c.type === "lic") return inline(c.children, ctx);
        if (c.type === "ul" || c.type === "ol") return `<${c.type}>${listItems(c, ctx)}</${c.type}>`;
        return inline([c], ctx);
      });
      return `<li>${parts.join("")}</li>`;
    }).join("");
  }
  function blockNode(n, ctx, opts) {
    if (n.type === "ul" || n.type === "ol") return `<${n.type}>${listItems(n, ctx)}</${n.type}>`;
    const tag = BLOCK_TAGS[n.type] || "p";
    const body = inline(n.children, ctx);
    if (!body.replace(/<br>/g, "").trim()) {
      return opts.keepEmpty === false ? "" : "<p>\u200B</p>";
    }
    const kept = body.endsWith("<br>") ? `${body}\u200B` : body;
    return `<${tag}>${kept}</${tag}>`;
  }
  function cleanHtml(html, ctx) {
    const tpl = ctx.document.createElement("div");
    tpl.innerHTML = html || "";
    tpl.querySelectorAll("br.softbreak").forEach((br) => br.replaceWith(ctx.document.createElement("br")));
    tpl.querySelectorAll("a[href]").forEach((a) => {
      var _a;
      const { href, kind } = rewriteLink(a.getAttribute("href"), ctx);
      (_a = ctx.links) == null ? void 0 : _a.push({ source: a.getAttribute("href"), href, kind });
      a.setAttribute("href", href);
    });
    tpl.querySelectorAll("[style],[class]").forEach((el) => {
      el.removeAttribute("style");
      el.removeAttribute("class");
    });
    return tpl.innerHTML;
  }
  function rgbaToCss(c) {
    var _a, _b, _c, _d, _e;
    if (!c) return "";
    const a = (_b = (_a = c.alpha) != null ? _a : c.a) != null ? _b : 1;
    return `rgba(${(_c = c.red) != null ? _c : c.r}, ${(_d = c.green) != null ? _d : c.g}, ${(_e = c.blue) != null ? _e : c.b}, ${a})`;
  }
  function img(ctx, key, alt, { width, height, title } = {}) {
    const preview = key.startsWith("asset-") ? ctx.assets[`preview-${key.slice(6)}`] : null;
    const src = preview || ctx.assets[key];
    if (!src) {
      ctx.missing.push(key);
      return null;
    }
    const el = ctx.document.createElement("img");
    el.src = src;
    el.alt = alt || "";
    if (title) el.title = title;
    if (width) el.setAttribute("width", width);
    if (height) el.setAttribute("height", height);
    return el;
  }
  function link(ctx, href, text) {
    const a = ctx.document.createElement("a");
    a.href = href;
    a.textContent = text;
    return a;
  }
  function frag(ctx, html) {
    const d = ctx.document.createElement("div");
    d.innerHTML = html;
    return d;
  }
  function block(ctx, name, rows) {
    return ctx.WebImporter.Blocks.createBlock(ctx.document, { name, cells: rows });
  }
  var variants = (...v) => v.filter(Boolean).map((x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).join(", ");

  // tools/importer/parsers/text.js
  function parse(b, ctx, { prevType } = {}) {
    const s = b.settings || {};
    const html = slateToHtml(s.content || "", ctx);
    const cols = Number(s.columnNumber || 1);
    if (!html.trim()) return [];
    if (cols > 1 || prevType === "Text") {
      const v = variants(cols > 1 && `columns-${cols}`, s.isColumnGutterCustom && "gutter-custom", cols > 1 && s.columnGutterSimple && `gutter-${s.columnGutterSimple}`);
      const rows = [[frag(ctx, html)]];
      if (s.isColumnGutterCustom && s.columnGutterCustom) rows.push(["Gutter", s.columnGutterCustom]);
      return [block(ctx, v ? `Text (${v})` : "Text", rows)];
    }
    return [...frag(ctx, html).childNodes];
  }

  // tools/importer/parsers/heading.js
  function parse2(b, ctx) {
    var _a;
    const level = String(((_a = b.settings) == null ? void 0 : _a.type_style) || "HEADING2").replace(/\D/g, "") || "2";
    const h = ctx.document.createElement(`h${level}`);
    h.textContent = b.title || "";
    return [h];
  }

  // tools/importer/parsers/callout.js
  function parse3(b, ctx) {
    const s = b.settings || {};
    const v = variants(
      s.type || "info",
      s.appearance || "light",
      s.width && s.width !== "fullWidth" && `width-${s.width}`,
      s.alignment && s.alignment !== "left" && `align-${s.alignment}`,
      !s.hasCustomPadding && `padding-${s.paddingChoice || "m"}`,
      !s.hasExtendedCustomRadius && `radius-${s.extendedRadiusChoice || "none"}`,
      // Frontify shows the chosen icon whenever iconType is set (iconSwitch only toggles custom icons).
      s.iconType && s.iconType !== "none" && `icon-${s.iconType}`
    );
    const rows = [[frag(ctx, slateToHtml(s.textValue || "", ctx))]];
    if (s.hasCustomPadding) rows.push(["Padding", [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((x) => x || "0px").join(" ")]);
    if (s.hasExtendedCustomRadius) rows.push(["Radius", [s.extendedRadiusTopLeft, s.extendedRadiusTopRight, s.extendedRadiusBottomRight, s.extendedRadiusBottomLeft].map((x) => x || "0px").join(" ")]);
    return [block(ctx, `Callout (${v})`, rows)];
  }

  // tools/importer/parsers/image.js
  function parse4(b, ctx) {
    var _a, _b, _c, _d;
    const s = b.settings || {};
    const a = (((_a = b.assets) == null ? void 0 : _a.image) || [])[0];
    if (!a) {
      ctx.notes.push(`Image block ${b.id} has no image asset`);
      return [];
    }
    const pic = img(ctx, `asset-${a.id}`, s.altText || a.alternative_text || "", { width: a.width, height: a.height });
    const v = variants(
      s.alignment && s.alignment !== "Center" && `align-${s.alignment}`,
      s.positioning && s.positioning !== "Below" && `caption-${s.positioning}`,
      s.hasCustomRatio && `ratio-${s.ratioChoice}`,
      s.autosizing && s.autosizing !== "none" && `autosize-${s.autosizing}`,
      !s.hasCustomPadding && s.paddingChoice && s.paddingChoice !== "None" && `padding-${s.paddingChoice}`,
      s.hasBackground && "background",
      s.hasBorder && "border",
      s.hasRadius_cornerRadius && `radius-${s.radiusChoice_cornerRadius}`,
      s.downloadable && "downloadable"
    );
    const rows = [[pic || ""]];
    if (!slateIsEmpty(s.name)) rows.push(["Title", frag(ctx, slateToHtml(s.name, ctx, { keepEmpty: false }))]);
    if (!slateIsEmpty(s.description)) rows.push(["Caption", frag(ctx, slateToHtml(s.description, ctx, { keepEmpty: false }))]);
    if (s.hasLink && ((_c = (_b = s.linkObject) == null ? void 0 : _b.link) == null ? void 0 : _c.link)) rows.push(["Link", s.linkObject.link.link]);
    if (s.hasBackground) rows.push(["Background", rgbaToCss(s.backgroundColor)]);
    if (s.hasBorder) rows.push(["Border", `${s.borderWidth} ${String(s.borderStyle).toLowerCase()} ${rgbaToCss(s.borderColor)}`]);
    if (s.downloadable && ctx.assets[`asset-${a.id}`]) rows.push(["Download", ctx.assets[`asset-${a.id}`]]);
    const atts = (((_d = b.assets) == null ? void 0 : _d.attachments) || []).filter((x) => ctx.assets[`asset-${x.id}`]);
    if (atts.length) {
      const cell = ctx.document.createElement("div");
      atts.forEach((x) => {
        const p = ctx.document.createElement("p");
        p.append(ctx.document.createElement("a"));
        p.firstChild.href = ctx.assets[`asset-${x.id}`];
        p.firstChild.textContent = x.file_name;
        cell.append(p);
      });
      rows.push(["Attachments", cell]);
    }
    return [block(ctx, v ? `Image (${v})` : "Image", rows)];
  }

  // tools/importer/parsers/video.js
  function parse5(b, ctx) {
    const s = b.settings || {};
    const ad = s.asset_data || {};
    const key = `asset-${ad.id || s.asset}`;
    const href = ctx.assets[key];
    if (!href) {
      ctx.missing.push(key);
      ctx.notes.push(`Video block ${b.id}: file missing`);
      return [];
    }
    const width = s.isCustomWidth ? s.widthCustom : s.widthSimple;
    const v = variants(s.autoplay && "autoplay", s.loop && "loop", width && width !== "auto" && `width-${width}`);
    const cell = ctx.document.createElement("div");
    const p = ctx.document.createElement("p");
    p.append(link(ctx, href, href));
    cell.append(p);
    if (!slateIsEmpty(s.title)) cell.append(...frag(ctx, slateToHtml(s.title, ctx, { keepEmpty: false })).childNodes);
    return [block(ctx, v ? `Video (${v})` : "Video", [[cell]])];
  }

  // tools/importer/parsers/annotations.js
  function parse6(b, ctx) {
    const s = b.settings || {};
    const ad = s.asset_data || {};
    const pic = img(ctx, `asset-${ad.id || s.asset}`, s.caption || ad.filename || "", { width: ad.width, height: ad.height });
    const v = variants(s.mode && `mode-${s.mode}`, s.border && "border", s.bubble_light && "bubble-light", s.responsive === false && "fixed");
    const rows = [[pic || ""]];
    (s.annotations || []).forEach((an) => {
      const pos = (an.bubbles || []).map((p) => `${Number(p.left).toFixed(4)}% ${Number(p.top).toFixed(4)}%`).join("; ");
      rows.push([pos, frag(ctx, cleanHtml(an.content, ctx))]);
    });
    if (s.bubble) rows.push(["Bubble", s.bubble]);
    if (s.background_color && s.background_color !== "transparent") rows.push(["Background", s.background_color]);
    if (s.caption) rows.push(["Caption", s.caption]);
    return [block(ctx, v ? `Annotations (${v})` : "Annotations", rows)];
  }

  // tools/importer/parsers/image-grid.js
  function parse7(b, ctx) {
    const s = b.settings || {};
    const v = variants(`columns-${s.columns || 2}`, s.border && "border");
    const rows = (s.assets || []).map((it) => {
      const ad = it.asset_data || {};
      const pic = img(ctx, `asset-${ad.id || it.asset}`, it.alt || it.title || "", { width: ad.width, height: ad.height });
      const row = [pic || "", it.title || "", it.caption || ""];
      if (it.background && it.background !== "transparent") row.push(it.background);
      return row;
    });
    return [block(ctx, `Image Grid (${v})`, rows)];
  }

  // tools/importer/parsers/divider.js
  function parse8(b, ctx) {
    const s = b.settings || {};
    const height = s.isHeightCustom ? s.heightCustom : s.heightSimple;
    const width = s.isWidthCustom ? s.widthCustom : s.widthSimple;
    const v = variants(
      s.isLine === "NoLine" ? "no-line" : String(s.style || "Solid"),
      !s.isHeightCustom && `height-${s.heightSimple || "Small"}`,
      s.alignment && s.alignment !== "Left" && `align-${s.alignment}`
    );
    const rows = [["Line", s.isLine === "NoLine" ? "none" : `${s.thickness || "1px"} ${String(s.style || "solid").toLowerCase()} ${rgbaToCss(s.color)}`]];
    if (s.isHeightCustom) rows.push(["Height", height]);
    if (width && width !== "100%") rows.push(["Width", width]);
    return [block(ctx, `Divider (${v})`, rows)];
  }

  // tools/importer/parsers/attachments.js
  function parse9(b, ctx) {
    var _a;
    const rows = (((_a = b.settings) == null ? void 0 : _a.downloads) || []).map((d) => {
      const href = ctx.assets[`attachment-${d.attachment}`];
      if (!href) ctx.missing.push(`attachment-${d.attachment}`);
      const title = decodeEntities(d.title || "");
      return [href ? link(ctx, href, title) : title, d.size || "", d.ext || ""];
    });
    return [block(ctx, "Attachments", rows)];
  }

  // tools/importer/parsers/colors.js
  var REPS = [
    ["rgba", "RGBA", (v) => {
      var _a;
      return `${v.red}, ${v.green}, ${v.blue}, ${(_a = v.alpha) != null ? _a : 1}`;
    }],
    ["hex", "HEX", (v) => v],
    ["hsl", "HSL", (v) => typeof v === "object" ? `${v.hue}, ${v.saturation}, ${v.lightness}` : v],
    ["lab", "LAB", (v) => typeof v === "object" ? `${v.l}, ${v.a}, ${v.b}` : v],
    ["ral", "RAL", (v) => v],
    ["pantone", "PMS", (v) => v],
    ["pantoneCoated", "PMS Coated", (v) => v],
    ["pantoneUncoated", "PMS Uncoated", (v) => v],
    ["pantoneCp", "PMS CP", (v) => v],
    ["pantonePlastics", "PMS Plastics", (v) => v],
    ["pantoneTextile", "PMS Textile", (v) => v],
    ["cmyk", "CMYK", (v) => `${v.cyan}, ${v.magenta}, ${v.yellow}, ${v.black}`],
    ["cmykCoated", "CMYK Coated", (v) => `${v.cyan}, ${v.magenta}, ${v.yellow}, ${v.black}`],
    ["cmykUncoated", "CMYK Uncoated", (v) => `${v.cyan}, ${v.magenta}, ${v.yellow}, ${v.black}`],
    ["cmykNewspaper", "CMYK Newspaper", (v) => `${v.cyan}, ${v.magenta}, ${v.yellow}, ${v.black}`],
    ["ncs", "NCS", (v) => v],
    ["hks", "HKS", (v) => v],
    ["threeM", "3M", (v) => v],
    ["oracal", "Oracal", (v) => v],
    ["cssVariable", "CSS Variable", (v) => v]
  ];
  function parse10(b, ctx) {
    const s = b.settings || {};
    const colors = ctx.colors[String(b.id)];
    if (!colors) {
      ctx.notes.push(`Colors block ${b.id}: colour values not captured`);
      ctx.missing.push(`colors-${b.id}`);
      return [];
    }
    const enabled = new Set(s.enabledRepresentations || []);
    const present = REPS.filter(([k]) => colors.some((c) => {
      var _a, _b;
      return ((_b = (_a = c.representations) == null ? void 0 : _a[k]) == null ? void 0 : _b.value) != null;
    }));
    const v = variants(
      s.view || "card",
      s.showColorUsageDescription && "show-description",
      s.hasCardBorder && "card-border",
      s.showTableHeader && "table-header",
      s.isSpacingCustom && `gap-${s.spacingCustom}`,
      !s.isCornerRadiusCustom && s.cornerRadius && s.cornerRadius !== "none" && `radius-${s.cornerRadius}`,
      s.isSwatchSizeCustom && "swatch-custom",
      ...present.filter(([k]) => enabled.has(k)).map(([k]) => `show-${k}`)
    );
    const rows = [];
    if (s.title) rows.push(["Title", s.title]);
    if (s.description) rows.push(["Description", s.description]);
    rows.push(["Name", "Usage", ...present.map(([, label]) => label)]);
    colors.forEach((c) => {
      rows.push([c.name || "", c.description || "", ...present.map(([k, , fmt]) => {
        var _a, _b;
        const val = (_b = (_a = c.representations) == null ? void 0 : _a[k]) == null ? void 0 : _b.value;
        return val == null ? "" : String(fmt(val));
      })]);
    });
    return [block(ctx, `Colors (${v})`, rows)];
  }

  // tools/importer/parsers/asset-kit.js
  function parse11(b, ctx) {
    var _a;
    const s = b.settings || {};
    const v = variants(
      s.showThumbnails && "thumbnails",
      s.showCount && "count",
      s.hasBorder_blocks && "border",
      s.hasBackgroundBlocks && "background",
      s.hasBorder_thumbnails && "thumbnail-border",
      s.hasBackgroundThumbnails && "thumbnail-background",
      s.hasRadius_blocks && `radius-${s.radiusChoice_blocks}`
    );
    const rows = [];
    if (!slateIsEmpty(s.title)) rows.push(["Title", frag(ctx, slateToHtml(s.title, ctx, { keepEmpty: false }))]);
    if (!slateIsEmpty(s.description)) rows.push(["Description", frag(ctx, slateToHtml(s.description, ctx, { keepEmpty: false }))]);
    const pkg = ctx.assets[`assetkit-${b.id}`];
    if (pkg) rows.push(["Package", link(ctx, pkg, "Download package")]);
    else ctx.notes.push(`Asset Kit ${b.id}: no package zip`);
    if (s.hasBorder_blocks) rows.push(["Border", `${s.borderWidth_blocks} ${String(s.borderStyle_blocks).toLowerCase()} ${rgbaToCss(s.borderColor_blocks)}`]);
    if (s.hasBackgroundThumbnails) rows.push(["Thumbnail background", rgbaToCss(s.backgroundColorThumbnails)]);
    (((_a = b.assets) == null ? void 0 : _a.images) || []).forEach((a) => {
      const key = `asset-${a.id}`;
      const file = ctx.assets[key];
      if (!file) ctx.missing.push(key);
      const isImage = a.object_type === "IMAGE" && ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(String(a.ext).toLowerCase());
      const icon = ctx.assets[`icon-file-${String(a.ext).toLowerCase()}.svg`];
      let thumb = "";
      if (isImage || ctx.assets[`preview-${a.id}`]) thumb = img(ctx, key, a.title || a.file_name);
      else if (icon) {
        thumb = ctx.document.createElement("img");
        thumb.src = icon;
        thumb.alt = `${a.ext} file`;
      }
      rows.push([thumb || "", file ? link(ctx, file, a.file_name) : a.file_name, a.title || "", String(a.ext || "")]);
    });
    return [block(ctx, v ? `Asset Kit (${v})` : "Asset Kit", rows)];
  }

  // tools/importer/parsers/audio.js
  function parse12(b, ctx) {
    var _a;
    const s = b.settings || {};
    const a = (((_a = b.assets) == null ? void 0 : _a.audio) || [])[0];
    if (!a) {
      ctx.notes.push(`Audio block ${b.id} has no file`);
      return [];
    }
    const href = ctx.assets[`asset-${a.id}`];
    if (!href) ctx.missing.push(`asset-${a.id}`);
    const v = variants(s.downloadable && "downloadable", s.positioning && s.positioning !== "Above" && `title-${s.positioning}`);
    const rows = [];
    if (!slateIsEmpty(s.title)) rows.push(["Title", frag(ctx, slateToHtml(s.title, ctx, { keepEmpty: false }))]);
    rows.push([href ? link(ctx, href, a.file_name) : a.file_name]);
    return [block(ctx, v ? `Audio (${v})` : "Audio", rows)];
  }

  // tools/importer/import-guideline-page.js
  var HOST2 = "https://tui-brandhub.com";
  var PARSERS = {
    Text: parse,
    Heading: parse2,
    Callout: parse3,
    Image: parse4,
    Video: parse5,
    Annotations: parse6,
    "Image grid": parse7,
    Divider: parse8,
    Attachments: parse9,
    Colors: parse10,
    "Asset Kit": parse11,
    Audio: parse12
  };
  var payload = null;
  function readPayload(document) {
    if (payload) return payload;
    const el = document.getElementById("frontify-export");
    if (!el) throw new Error("No #frontify-export payload in source page");
    payload = JSON.parse(el.textContent);
    return payload;
  }
  function makeCtx(document, data) {
    return {
      document,
      WebImporter,
      assets: data.assets,
      colors: data.colors || {},
      order: data.nav.order,
      firstPath: data.nav.order[0].path,
      permalinks: data.permalinks || {},
      links: [],
      missing: [],
      notes: []
    };
  }
  var hr = (document) => document.createElement("hr");
  function metadataBlock(document, data, ctx) {
    const { page, self } = data;
    const rows = {
      Title: data.tabTitle || `${page.title} - ${data.doc.title}`,
      Template: "guideline",
      Category: self.catTitle || "",
      "Category Slug": self.cat || "",
      "Frontify Page Id": String(page.id),
      "Last Modified": data.lastModified || "",
      "Original Url": data.frontifyUrl
    };
    if (data.permanentLink) rows["Original Permalink"] = data.permanentLink;
    if (!page.title) rows.Robots = "noindex";
    return ctx.WebImporter.Blocks.getMetadataBlock(document, rows);
  }
  function buildPage(document, data, ctx) {
    const main = document.createElement("div");
    const { page } = data;
    const counts = {};
    const h1 = document.createElement("h1");
    h1.textContent = page.title || "\u200B";
    main.append(h1);
    const sections = [...page.sections].sort((a, b) => a.sort - b.sort);
    sections.forEach((s) => {
      main.append(hr(document));
      if (!s.content || !s.content.length) {
        main.append(WebImporter.Blocks.createBlock(document, { name: "Section Metadata", cells: { Style: "empty" } }));
        ctx.notes.push(`Empty section ${s.id} kept as spacer`);
        return;
      }
      let prevType = null;
      s.content.forEach((b) => {
        const type = b.display_name || (b.slug !== void 0 ? "Heading" : "Unknown");
        counts[type] = (counts[type] || 0) + 1;
        const parser = PARSERS[type];
        if (!parser) {
          ctx.notes.push(`Unknown block type ${type} (${b.id})`);
          return;
        }
        const nodes = parser(b, ctx, { prevType });
        nodes.forEach((n) => main.append(n));
        prevType = type;
      });
      const nonDefault = s.alignment || s.max_width || s.vertical_padding || s.horizontal_padding || s.vertical_gutter || s.horizontal_gutter || s.has_border || s.color_scheme_id;
      if (nonDefault) {
        const rows = { Style: "frontify-section" };
        if (s.vertical_gutter) rows["Vertical Gutter"] = s.vertical_gutter;
        if (s.horizontal_gutter) rows["Horizontal Gutter"] = s.horizontal_gutter;
        if (s.vertical_padding) rows["Vertical Padding"] = s.vertical_padding;
        if (s.horizontal_padding) rows["Horizontal Padding"] = s.horizontal_padding;
        if (s.max_width) rows["Max Width"] = s.max_width;
        if (s.alignment) rows.Alignment = s.alignment;
        main.append(WebImporter.Blocks.createBlock(document, { name: "Section Metadata", cells: rows }));
      }
    });
    main.append(metadataBlock(document, data, ctx));
    return { main, counts };
  }
  function libraryHref(item) {
    if (item.type === "link_document") {
      const u = item.url || "";
      return u.startsWith("/") ? HOST2 + u : u;
    }
    return `${HOST2}/document/${item.id}`;
  }
  function buildNav(document, data) {
    const div = document.createElement("div");
    const logo = data.assets[data.logoKey];
    div.innerHTML = `<p><a href="${data.nav.order[0].path}"><img src="${logo}" alt="${data.portalTitle} logo"></a></p>
    <p><a href="${HOST2}/dashboard">Back to dashboard</a></p>`;
    div.append(hr(document));
    const ul = document.createElement("ul");
    data.portalNav.filter((n) => !n.is_hidden_in_navigation).forEach((n) => {
      var _a;
      const tr = ((_a = n.translations) == null ? void 0 : _a.default) || {};
      const li = document.createElement("li");
      if (n.type === "document_group") {
        li.append(document.createTextNode(tr.name || ""));
        const sub = document.createElement("ul");
        (n.children || n.items || []).forEach((c) => {
          var _a2;
          const ct = ((_a2 = c.translations) == null ? void 0 : _a2.default) || {};
          const sli = document.createElement("li");
          const a = document.createElement("a");
          a.href = libraryHref(c);
          a.textContent = ct.title || ct.name || "";
          sli.append(a);
          sub.append(sli);
        });
        li.append(sub);
      } else {
        const a = document.createElement("a");
        a.href = n.id === data.doc.id ? data.nav.order[0].path : libraryHref(n);
        a.textContent = tr.title || "";
        li.append(a);
      }
      ul.append(li);
    });
    div.append(ul);
    div.append(hr(document));
    div.insertAdjacentHTML("beforeend", `<ul>
    <li><a href="${HOST2}/dashboard">:brand-hub: Brand Hub</a></li>
    <li>:search: Search</li>
    <li><a href="${HOST2}/document/396">:brand-assistant: Brand Assistant</a></li>
  </ul>`);
    return div;
  }
  function buildSidebar(document, data) {
    const div = document.createElement("div");
    const ul = document.createElement("ul");
    data.nav.categories.forEach((cat) => {
      const visiblePages = cat.pages.filter((p) => !p.hidden && p.published);
      if (!visiblePages.length) return;
      if (cat.uncategorized) {
        visiblePages.forEach((p) => {
          const li2 = document.createElement("li");
          const a = document.createElement("a");
          a.href = p.path;
          if (p.title) a.textContent = p.title;
          else {
            const em = document.createElement("em");
            em.textContent = data.doc.title;
            a.append(em);
          }
          li2.append(a);
          ul.append(li2);
        });
        return;
      }
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = cat.title;
      li.append(strong);
      const pages = document.createElement("ul");
      visiblePages.forEach((p) => {
        const pli = document.createElement("li");
        const a = document.createElement("a");
        a.href = p.path;
        a.textContent = p.title;
        pli.append(a);
        if (p.headings.length) {
          const hs = document.createElement("ul");
          p.headings.forEach((h) => {
            const hli = document.createElement("li");
            const ha = document.createElement("a");
            ha.href = `${p.path}#${h.slug}`;
            ha.textContent = h.title;
            hli.append(ha);
            hs.append(hli);
          });
          pli.append(hs);
        }
        pages.append(pli);
      });
      li.append(pages);
      ul.append(li);
    });
    div.append(ul);
    return div;
  }
  function buildRedirect(document, data, title) {
    const div = document.createElement("div");
    const first = data.nav.order[0];
    div.innerHTML = `<p><a href="${first.path}">${first.title}</a></p>`;
    div.append(WebImporter.Blocks.getMetadataBlock(document, {
      Title: title,
      Template: "redirect",
      Redirect: first.path,
      Robots: "noindex"
    }));
    return div;
  }
  function buildFooter(document) {
    const div = document.createElement("div");
    div.innerHTML = "<p></p>";
    return div;
  }
  var import_guideline_page_default = {
    onLoad: ({ document }) => {
      payload = null;
      readPayload(document);
    },
    transform: ({ document }) => {
      const data = readPayload(document);
      const ctx = makeCtx(document, data);
      const { main, counts } = buildPage(document, data, ctx);
      const links = ctx.links.filter((l) => l.kind !== "internal" || l.source !== l.href);
      const report = {
        frontifyPageId: data.page.id,
        originalUrl: data.frontifyUrl,
        blockCounts: JSON.stringify(counts),
        outOfScopeLinks: JSON.stringify(links.filter((l) => l.kind === "out-of-scope").map((l) => l.href)),
        rewrittenLinks: JSON.stringify(links.filter((l) => l.kind === "internal").map((l) => `${l.source} -> ${l.href}`)),
        fixedLinks: JSON.stringify(links.filter((l) => l.kind === "email").map((l) => `${l.source} -> ${l.href}`)),
        missing: JSON.stringify(ctx.missing),
        notes: JSON.stringify(ctx.notes)
      };
      const results = [{ element: main, path: data.self.path, report }];
      if (data.emitChrome) {
        results.push({ element: buildNav(document, data), path: "/nav" });
        results.push({ element: buildSidebar(document, data), path: "/sidebar" });
        results.push({ element: buildFooter(document), path: "/footer" });
        results.push({ element: buildRedirect(document, data, data.doc.title), path: "/index" });
        results.push({ element: buildRedirect(document, data, data.doc.title), path: `/document/${data.doc.id}` });
      }
      return results;
    }
  };
  return __toCommonJS(import_guideline_page_exports);
})();
