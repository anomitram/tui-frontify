/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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

  // tools/importer/import-doc-cover-page.js
  var import_doc_cover_page_exports = {};
  __export(import_doc_cover_page_exports, {
    default: () => import_doc_cover_page_default
  });

  // tools/importer/utils/frontify.js
  var esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  var decodeEntities = (s) => String(s).replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, "\xA0");
  function rewriteLink(url, ctx) {
    if (!url) return { href: url, kind: "empty" };
    let u = url.trim();
    if (ctx.linkMap && Object.prototype.hasOwnProperty.call(ctx.linkMap, u)) {
      const href = ctx.linkMap[u];
      return { href, kind: href.startsWith("/") ? "internal" : "out-of-scope" };
    }
    const mailLike = /^https?:\/\/([^/@\s]+@[^/\s]+\.[a-z]{2,})\/?$/i.exec(u);
    if (mailLike) return { href: `mailto:${mailLike[1]}`, kind: "email", fixed: true };
    const HOST = ctx.host;
    if (u.startsWith("/")) u = HOST + u;
    let parsed;
    try {
      parsed = new URL(u);
    } catch (e) {
      return { href: url, kind: "external" };
    }
    if (parsed.host !== new URL(HOST).host) return { href: url, kind: "external" };
    if (parsed.pathname.startsWith("/r/")) {
      const target = ctx.permalinks[parsed.pathname];
      if (target) return { href: target, kind: "internal" };
      return { href: u, kind: "out-of-scope" };
    }
    const m = /^\/document\/(\d+)\/?$/.exec(parsed.pathname);
    if (m && m[1] === String(ctx.docId)) {
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
        const [open, close] = {
          secondary: ["<em>", "</em>"],
          tertiary: ["<em><strong>", "</strong></em>"]
        }[n.buttonStyle] || ["<strong>", "</strong>"];
        return wrapKeepSpaces(`${open}<a href="${esc(href)}">`, inline(n.children, ctx), `</a>${close}`);
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
      if (opts.keepEmpty === false) return "";
      const breaks = (body.match(/<br>/g) || []).length;
      if (opts.keepEmptyBreaks && breaks) return `<p>${Array(breaks + 1).fill("\u200B").join("<br>")}</p>`;
      return "<p>\u200B</p>";
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

  // tools/importer/parsers/image.js
  function parse(b, ctx) {
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

  // tools/importer/parsers/divider.js
  function parse2(b, ctx) {
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

  // tools/importer/parsers/annotations.js
  function noteStyles(html, ctx) {
    const tpl = ctx.document.createElement("div");
    tpl.innerHTML = html || "";
    return [...tpl.children].map((el, i) => {
      const cls = (el.getAttribute("class") || "").split(/\s+/).find((c) => /^custom\d$/.test(c));
      return cls ? `${i + 1}: class: ${cls}` : "";
    }).filter(Boolean).join("\n");
  }
  var LEGACY_DOCS = [396];
  var keepEmpty = (html) => html.replace(/<p>(\s|<br[^>]*>)*<\/p>/g, "<p>\u200B</p>");
  function parse4(b, ctx) {
    const s = b.settings || {};
    const ad = s.asset_data || {};
    const pic = img(ctx, `asset-${ad.id || s.asset}`, s.caption || ad.filename || "", { width: ad.width, height: ad.height });
    const v = variants(s.mode && `mode-${s.mode}`, s.border && "border", s.bubble_light && "bubble-light", s.responsive === false && "fixed");
    const rows = [[pic || ""]];
    (s.annotations || []).forEach((an) => {
      const pos = (an.bubbles || []).map((p) => `${Number(p.left).toFixed(4)}% ${Number(p.top).toFixed(4)}%`).join("; ");
      const styles = noteStyles(an.content, ctx);
      let html = cleanHtml(an.content, ctx);
      if (!LEGACY_DOCS.includes(Number(ctx.docId))) html = keepEmpty(html);
      rows.push(styles ? [pos, frag(ctx, html), styles] : [pos, frag(ctx, html)]);
    });
    if (s.bubble) rows.push(["Bubble", s.bubble]);
    if (s.background_color && s.background_color !== "transparent") rows.push(["Background", s.background_color]);
    if (s.caption) rows.push(["Caption", s.caption]);
    return [block(ctx, v ? `Annotations (${v})` : "Annotations", rows)];
  }

  // tools/importer/parsers/asset-kit.js
  var SERVABLE = ["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf", "mp4"];
  function parse5(b, ctx) {
    var _a, _b;
    const s = b.settings || {};
    const v = variants(
      s.showThumbnails && "thumbnails",
      s.showCount && "count",
      s.hasBorder_blocks && "border",
      s.hasBackgroundBlocks && "background",
      s.hasBorder_thumbnails && "thumbnail-border",
      s.hasBackgroundThumbnails && "thumbnail-background",
      // Frontify's radius switch (hasRadius_blocks) selects a custom value; off = the radius choice
      !s.hasRadius_blocks && s.radiusChoice_blocks && `radius-${s.radiusChoice_blocks}`
    );
    const rows = [];
    if (!slateIsEmpty(s.title)) rows.push(["Title", frag(ctx, slateToHtml(s.title, ctx, { keepEmpty: false }))]);
    if (!slateIsEmpty(s.description)) rows.push(["Description", frag(ctx, slateToHtml(s.description, ctx, { keepEmpty: false }))]);
    const pkg = ctx.assets[`assetkit-${b.id}`];
    const files = ((_a = b.assets) == null ? void 0 : _a.images) || [];
    const single = files.length === 1 && SERVABLE.includes(String(files[0].ext).toLowerCase()) ? ctx.assets[`asset-${files[0].id}`] : null;
    if (pkg) rows.push(["Package", link(ctx, pkg, "Download package")]);
    else if (single) rows.push(["Package", link(ctx, single, "Download package")]);
    else ctx.notes.push(`Asset Kit ${b.id}: no package zip; "Download package" links to the Frontify page`);
    if (s.hasRadius_blocks && s.radiusValue_blocks) rows.push(["Radius", s.radiusValue_blocks]);
    const unservable = files.filter((a) => !SERVABLE.includes(String(a.ext).toLowerCase()));
    if (unservable.length) ctx.notes.push(`Asset Kit ${b.id}: files Edge Delivery cannot serve: ${unservable.map((a) => a.file_name || `${a.id}.${a.ext}`).join(", ")}`);
    if (s.hasBorder_blocks) rows.push(["Border", `${s.borderWidth_blocks} ${String(s.borderStyle_blocks).toLowerCase()} ${rgbaToCss(s.borderColor_blocks)}`]);
    if (s.hasBackgroundThumbnails) rows.push(["Thumbnail background", rgbaToCss(s.backgroundColorThumbnails)]);
    (((_b = b.assets) == null ? void 0 : _b.images) || []).forEach((a) => {
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
  function parse6(b, ctx) {
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

  // tools/importer/parsers/video.js
  var parseTitle = (t) => {
    try {
      return typeof t === "string" ? JSON.parse(t) : t || [];
    } catch (e) {
      return [];
    }
  };
  function parse7(b, ctx) {
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
    const radius = s.isBorderRadiusCustom ? s.borderRadiusCustom : s.borderRadiusSimple;
    const titleAlign = !slateIsEmpty(s.title) && (parseTitle(s.title)[0] || {}).align;
    const v = variants(
      s.autoplay && "autoplay",
      s.loop && "loop",
      width && width !== "auto" && `width-${width}`,
      s.controls === "none" && "no-controls",
      radius && radius !== "0px" && `radius-${radius}`,
      titleAlign && `title-${titleAlign}`,
      // frame size (new theme settings), so the layout is right before the file loads
      s.video_width && s.video_height && `ratio-${s.video_width}-${s.video_height}`
    );
    const cell = ctx.document.createElement("div");
    const p = ctx.document.createElement("p");
    p.append(link(ctx, href, href));
    cell.append(p);
    if (!slateIsEmpty(s.title)) cell.append(...frag(ctx, slateToHtml(s.title, ctx, { keepEmpty: false })).childNodes);
    return [block(ctx, v ? `Video (${v})` : "Video", [[cell]])];
  }

  // tools/importer/parsers/image-grid.js
  var LEGACY_DOCS2 = [396];
  function captionStyles(html, ctx) {
    const tpl = ctx.document.createElement("div");
    tpl.innerHTML = html || "";
    return [...tpl.children].map((el, i) => {
      const m = /\bql-align-(left|center|right|justify)\b/.exec(el.getAttribute("class") || "");
      return m ? `${i + 1}: text-align: ${m[1]}` : "";
    }).filter(Boolean).join("\n");
  }
  function parse8(b, ctx) {
    const s = b.settings || {};
    const legacy = LEGACY_DOCS2.includes(Number(ctx.docId));
    const v = variants(
      `columns-${s.columns || 2}`,
      s.border && "border",
      !legacy && s.downloadable && "download",
      !legacy && s.asset_viewer_enabled === false && "no-viewer"
    );
    const rows = (s.assets || []).map((it) => {
      const ad = it.asset_data || {};
      const pic = img(ctx, `asset-${ad.id || it.asset}`, it.alt || it.title || "", { width: ad.width, height: ad.height });
      const row = [pic || "", it.title || "", it.caption || ""];
      const bg = it.background && it.background !== "transparent" ? it.background : "";
      const styles = legacy ? "" : captionStyles(it.caption, ctx);
      if (bg || styles) row.push(bg);
      if (styles) row.push(styles);
      return row;
    });
    return [block(ctx, `Image Grid (${v})`, rows)];
  }

  // tools/importer/utils/doc-sections.js
  var parseSlate = (v) => {
    try {
      return typeof v === "string" ? JSON.parse(v) : v || [];
    } catch (e) {
      return [];
    }
  };
  var slateEmpty = (v) => {
    const t = (x) => (x.text || "") + (x.children || []).map(t).join("");
    return !parseSlate(v).map(t).join("").trim();
  };
  var div = (ctx, html) => {
    const d = ctx.document.createElement("div");
    d.innerHTML = html || "";
    return d;
  };
  var create = (ctx, name, cells) => WebImporter.Blocks.createBlock(ctx.document, { name, cells });
  var css = (o) => Object.entries(o).filter(([, v]) => v !== void 0 && v !== null && v !== "").map(([k, v]) => `${k}: ${v}`).join("; ");
  var asset = (b, key) => {
    var _a;
    return (((_a = b.assets) == null ? void 0 : _a[key]) || [])[0];
  };
  var picture = (ctx, a, alt) => {
    var _a, _b;
    return a ? img(ctx, `asset-${a.id}`, (_b = (_a = ctx.alts[`asset-${a.id}`]) != null ? _a : alt) != null ? _b : "", { width: a.width, height: a.height }) : null;
  };
  function textCell(b, ctx) {
    var _a, _b;
    const nodes = parseSlate((_a = b.settings) == null ? void 0 : _a.content);
    const html = nodes.length ? slateToHtml(nodes, ctx, { keepEmptyBreaks: true }) : "<p>\u200B</p>";
    const styles = [];
    nodes.forEach((n, i) => {
      const decl = [];
      if (n.type && n.type !== "p" && n.type !== "ul" && n.type !== "ol") decl.push(`class: ${n.type}`);
      if (n.align) decl.push(`text-align: ${n.align}`);
      const btnStyle = (n.children || []).filter((c) => c.type === "button").flatMap((c) => (c.children || []).map((t) => t.textStyle)).find(Boolean);
      if (btnStyle) decl.push(`button-class: ${btnStyle}`);
      if (decl.length) styles.push(`${i + 1}: ${decl.join("; ")}`);
    });
    const rows = [[div(ctx, html)]];
    if (styles.length) rows.push(["Styles", styles.join("\n")]);
    const cols = Number(((_b = b.settings) == null ? void 0 : _b.columnNumber) || 1);
    return create(ctx, `Text (cell${cols > 1 ? `, columns-${cols}` : ""})`, rows);
  }
  var emptyCell = (ctx) => create(ctx, "Text (cell)", [[div(ctx, "<p>\u200B</p>")]]);
  function headingCell(b, ctx) {
    const st = b.settings || {};
    const n = String(st.type_style || "HEADING2").replace(/\D/g, "") || "2";
    const style = /^CUSTOM/.test(st.type_style || "") ? `custom${n}` : `heading${n}`;
    const tag = `h${Math.min(Math.max(Number(n) || 2, 2), 4)}`;
    const d = ctx.document.createElement("div");
    const h = ctx.document.createElement(tag);
    h.textContent = b.title || "";
    d.append(h);
    const decl = [`class: ${style}`, `id: ${b.slug}`];
    if (st.alignment && st.alignment !== "LEFT") decl.push(`text-align: ${st.alignment.toLowerCase()}`);
    return create(ctx, "Text (cell, heading)", [[d], ["Styles", `1: ${decl.join("; ")}`]]);
  }
  function cardsGrid(b, ctx) {
    const s = b.settings || {};
    const low = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const ratio = (v) => /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(v || "") ? v.replace(":", " / ") : "";
    const length = (v) => /^\d+(\.\d+)?(px|%|rem|em|vh)$/.test(v || "") ? v : "";
    const some = (v) => v && v !== "None";
    const isText = s.cardType === "Text";
    const textRatio = s.hasCustomTextRatio ? s.customTextRatio : s.textRatioChoice;
    const imageSize = s.hasCustomImageHeightOrRatio ? s.customImageHeightOrRatio : s.imageRatioChoice;
    const textWidth = s.hasCustomTextFieldMaxWidth ? s.customTextFieldMaxWidth : s.textFieldMaxWidthChoice;
    const variants2 = [
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
      s.hasBorder && "border",
      !s.hasRadius && s.radiusChoice && `radius-${low(s.radiusChoice)}`,
      s.cardType && `type-${low(s.cardType)}`,
      s.hasBackground && s.backgroundColor && "background",
      isText && !s.hasCustomTextRatio && some(textRatio) && ratio(textRatio) && `ratio-${low(textRatio)}`,
      !isText && !s.hasCustomImageHeightOrRatio && some(imageSize) && ratio(imageSize) && `image-${low(imageSize)}`,
      !s.hasCustomTextFieldMaxWidth && some(textWidth) && length(textWidth) && `width-${low(textWidth)}`
    ].filter(Boolean);
    const keepSpaces = (node) => {
      let first = true;
      const walk = (x) => {
        if (typeof x.text === "string") {
          let t = x.text.replace(/ {2,}/g, (m) => ` ${"\xA0".repeat(m.length - 1)}`);
          if (first && t) {
            t = t.replace(/^ /, "\xA0").replace(/^\n/, "\u200B\n");
            first = false;
          }
          if (/\n$/.test(t)) t = `${t}\u200B`;
          return __spreadProps(__spreadValues({}, x), { text: t });
        }
        return x.children ? __spreadProps(__spreadValues({}, x), { children: x.children.map(walk) }) : x;
      };
      return walk(node);
    };
    const rows = [];
    (s.items || []).forEach((it) => {
      var _a, _b;
      const a = asset(b, it.id);
      const pic = picture(ctx, a, it.altText);
      const allText = (x) => (x.text || "") + (x.children || []).map(allText).join("");
      const editor = (v, title) => {
        const ns = parseSlate(v);
        return ns.map(allText).join("") ? ns.map((n) => ({ n: keepSpaces(n), title })) : [];
      };
      const nodes = [...editor(it.title, true), ...editor(it.description, false)];
      const href = (_a = it.link) == null ? void 0 : _a.href;
      if (!a && !nodes.length && !href) return;
      const text = div(ctx, nodes.map(({ n }) => slateToHtml([n], ctx, { keepEmptyBreaks: true })).join(""));
      const titles = nodes.filter((x) => x.title).length;
      const count = {};
      nodes.forEach(({ n }) => {
        if (n.align) count[n.align] = (count[n.align] || 0) + 1;
      });
      const allAlign = nodes.length > 1 && nodes.every(({ n }) => n.align) && Object.keys(count).sort((x, y) => count[y] - count[x])[0];
      const styles = nodes.map(({ n }, i) => {
        const decl = [];
        const tagged = { custom3: "custom3", imageTitle: "image-title", imageCaption: "image-caption" };
        const cls = tagged[n.type] || (n.type && n.type !== "p" && slateEmpty([n]) ? n.type : "");
        if (cls) decl.push(`class: ${cls}`);
        if (n.align && n.align !== allAlign) decl.push(`text-align: ${n.align}`);
        return decl.length ? `${i + 1}: ${decl.join("; ")}` : "";
      }).filter(Boolean);
      if (allAlign) styles.unshift(`all: text-align: ${allAlign}`);
      if (titles) styles.unshift(`title: ${titles}`);
      const bg = it.hasBackground === "on" && it.backgroundColor;
      if (bg) styles.push(`card: --cards-bg: ${rgbaToCss(__spreadProps(__spreadValues({}, bg), { alpha: ((_b = bg.alpha) != null ? _b : 1) > 1 ? Math.round(bg.alpha / 255 * 100) / 100 : bg.alpha }))}`);
      const link2 = href ? ctx.document.createElement("a") : "";
      if (link2) {
        link2.href = href;
        link2.textContent = href;
      }
      const row = [pic || "", text, link2];
      if (styles.length) row.push(styles.join("\n"));
      rows.push(row);
    });
    const settings = css({
      "--cards-bg": s.hasBackground && s.backgroundColor ? rgbaToCss(s.backgroundColor) : "",
      "--cards-border": s.hasBorder ? `${s.borderWidth || "1px"} ${low(s.borderStyle || "solid")} ${rgbaToCss(s.borderColor)}` : "",
      "--cards-gap": s.hasCustomSpacing ? length(s.spacingCustom) : "",
      "--cards-padding": s.hasCustomPadding ? length(s.customPadding) : "",
      "--cards-radius": s.hasRadius ? length(s.radiusValue) : "",
      "--cards-ratio": isText && s.hasCustomTextRatio ? ratio(textRatio) : "",
      "--cards-image-ratio": !isText && s.hasCustomImageHeightOrRatio ? ratio(imageSize) : "",
      "--cards-image-height": !isText && s.hasCustomImageHeightOrRatio ? length(imageSize) : "",
      "--cards-text-width": s.hasCustomTextFieldMaxWidth ? length(textWidth) : ""
    });
    if (settings) rows.push(["Settings", settings]);
    return create(ctx, `Cards Grid (${variants2.join(", ")})`, rows);
  }
  function slider(b, ctx) {
    const s = b.settings || {};
    const variants2 = [
      `columns-${s.columns || 1}`,
      s.assetHeight && `height-${s.assetHeight}`,
      s.autoplay && "autoplay",
      s.splideElements && s.splideElements !== "none" && `controls-${s.splideElements}`
    ].filter(Boolean);
    const rows = (s.slides || []).map((sl) => {
      const pic = picture(ctx, asset(b, `slide_asset_image_${sl.id}`), "");
      const cap = div(ctx, slateToHtml(parseSlate(sl.text), ctx, { keepEmpty: false }) || "");
      return cap.textContent.trim() ? [pic || "", cap] : [pic || ""];
    });
    if (s.autoplay && s.autoplayInterval) rows.push(["Interval", String(s.autoplayInterval)]);
    if (s.sliderGap && s.sliderGap !== "0") rows.push(["Gap", `${s.sliderGap}px`]);
    return create(ctx, `Slider (${variants2.join(", ")})`, rows);
  }
  function flipCard(b, ctx) {
    const s = b.settings || {};
    const keepSpaces = (html) => html.replace(/(^|>)([^<]+)/g, (m, a, t) => a + t.replace(/ {2,}/g, (sp) => `${" \u200B".repeat(sp.length - 1)} `));
    const faceStyles = (nodes) => nodes.map((n, i) => {
      const decl = [];
      if (n.type && !["p", "ul", "ol"].includes(n.type)) decl.push(`class: ${n.type}`);
      if (n.align) decl.push(`text-align: ${n.align}`);
      return decl.length ? `${i + 1}: ${decl.join("; ")}` : "";
    }).filter(Boolean).join(" ");
    let radius = "0";
    if (s.borderRadius_enabled) {
      radius = s.borderRadius_detailed ? [s.borderRadius_topLeft, s.borderRadius_topRight, s.borderRadius_bottomRight, s.borderRadius_bottomLeft].join(" ") : s.borderRadius_value;
    }
    let pad = "0";
    if (s.padding_enabled) {
      pad = s.padding_detailed ? [s.padding_top, s.padding_right, s.padding_bottom, s.padding_left].join(" ") : s.padding_value;
    }
    const settings = css({
      "--flip-cols-l": s.grid_large_columns,
      "--flip-bp-l": s.grid_large_breakpoint,
      "--flip-cols-m": s.grid_medium_columns,
      "--flip-bp-m": s.grid_medium_breakpoint,
      "--flip-cols-s": s.grid_small_columns,
      "--flip-gap": s.grid_gap_size,
      "--flip-min-height": s.cardDimensions_min_height,
      "--flip-border": s.border_enabled ? `${s.border_width} ${s.border_style} ${rgbaToCss(s.border_color)}` : "none",
      "--flip-radius": radius,
      "--flip-shadow": s.shadow_heading ? `${s.shadow_x} ${s.shadow_y} ${s.shadow_size} ${rgbaToCss(s.shadow_color)}` : "none",
      "--flip-padding": pad,
      "--flip-duration": s.animation_duration,
      "--flip-timing": s.animation_timing,
      "--flip-perspective": s.animation_perspective
    });
    const variants2 = [s.animation_flipOnClick ? "click" : "hover", `direction-${s.animation_direction || "left"}`];
    const rows = [["Settings", settings]];
    (s.cards || []).forEach((c) => {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const side = (name) => {
        var _a2;
        const sd = c[name] || {};
        const cell = ctx.document.createElement("div");
        const a = asset(b, `${c.id}_${name}`) || (sd.asset ? { id: sd.asset.id, width: sd.asset.width, height: sd.asset.height } : null);
        const pic = picture(ctx, a, ((_a2 = sd.asset) == null ? void 0 : _a2.alternativeText) || "");
        if (pic) {
          const p = ctx.document.createElement("p");
          p.append(pic);
          cell.append(p);
        }
        if (!slateEmpty(sd.text)) cell.append(...div(ctx, keepSpaces(slateToHtml(parseSlate(sd.text), ctx, { keepEmptyBreaks: true }))).childNodes);
        return cell;
      };
      const vars = css({
        "--front-bg": rgbaToCss((_a = c.front) == null ? void 0 : _a.bgColor),
        "--front-color": rgbaToCss((_b = c.front) == null ? void 0 : _b.color),
        "--front-size": (_c = c.front) == null ? void 0 : _c.bgSize,
        "--front-position": (((_d = c.front) == null ? void 0 : _d.bgPosition) || "").replace("-", " "),
        "--back-bg": rgbaToCss((_e = c.back) == null ? void 0 : _e.bgColor),
        "--back-color": rgbaToCss((_f = c.back) == null ? void 0 : _f.color),
        "--back-size": (_g = c.back) == null ? void 0 : _g.bgSize,
        "--back-position": (((_h = c.back) == null ? void 0 : _h.bgPosition) || "").replace("-", " ")
      });
      const style = ctx.document.createElement("div");
      const para = (t) => {
        const p = ctx.document.createElement("p");
        p.textContent = t;
        style.append(p);
      };
      if (vars) para(vars);
      ["front", "back"].forEach((name) => {
        var _a2;
        const spec = slateEmpty((_a2 = c[name]) == null ? void 0 : _a2.text) ? "" : faceStyles(parseSlate(c[name].text));
        if (spec) para(`${name === "front" ? "Front" : "Back"}: ${spec}`);
      });
      rows.push([side("front"), side("back"), style]);
    });
    return create(ctx, `Flip Card (${variants2.join(", ")})`, rows);
  }
  function dosDonts(b, ctx) {
    const s = b.settings || {};
    const keepSpaces = (html) => html.replace(/(^|>)([^<]+)/g, (m, a, t) => a + t.replace(/ {2,}/g, (sp) => `${" \u200B".repeat(sp.length - 1)} `));
    const variants2 = [
      `columns-${s.columns || 2}`,
      s.mode && `mode-${s.mode.replace(/_/g, "-")}`,
      s.style && `style-${s.style}`,
      s.keepSideBySide && "side-by-side",
      s.hasStrikethrough && "strikethrough",
      s.imageDisplay && `image-${s.imageDisplay}`,
      s.doIconChoice && `do-icon-${s.doIconChoice.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`,
      s.dontIconChoice && `dont-icon-${s.dontIconChoice.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`
    ].filter(Boolean);
    const RADII = {
      None: "0px",
      Small: "2px",
      Medium: "4px",
      Large: "12px"
    };
    const GUTTERS = {
      None: "0px",
      Small: "10px",
      Medium: "30px",
      Large: "50px"
    };
    const gutter = (custom, val, choice) => custom ? val : GUTTERS[choice] || choice;
    const settings = css({
      "--dd-col-gap": gutter(s.isCustomColumnGutter, s.customColumnGutterValue, s.columnGutterChoice),
      "--dd-row-gap": gutter(s.isCustomRowGutter, s.customRowGutterValue, s.rowGutterChoice),
      "--dd-do-color": s.hasCustomDoColor ? rgbaToCss(s.doColor) : "",
      "--dd-dont-color": s.hasCustomDontColor ? rgbaToCss(s.dontColor) : "",
      "--dd-bg": s.hasBackground ? rgbaToCss(__spreadValues({ alpha: 1 }, s.backgroundColor)) : "",
      "--dd-border": s.hasBorder ? `${s.borderWidth} ${String(s.borderStyle).toLowerCase()} ${rgbaToCss(s.borderColor)}` : "",
      "--dd-radius": s.hasRadius ? RADII[s.radiusChoice] || s.radiusChoice : "",
      "--dd-image-height": s.isCustomImageHeight ? s.customImageHeightValue : ""
    });
    const rows = [["Settings", settings]];
    (s.items || []).forEach((it) => {
      const pic = picture(ctx, asset(b, it.id), it.alt || "");
      const text = ctx.document.createElement("div");
      if (it.title) text.append(...div(ctx, `<h4>${it.title.replace(/</g, "&lt;")}</h4>`).childNodes);
      if (!slateEmpty(it.body)) text.append(...div(ctx, keepSpaces(slateToHtml(parseSlate(it.body), ctx, { keepEmptyBreaks: true }))).childNodes);
      rows.push([it.type === "Do" ? "Do" : "Don't", pic || "", text]);
    });
    return create(ctx, `Dos Donts (${variants2.join(", ")})`, rows);
  }
  function quote(b, ctx) {
    const s = b.settings || {};
    const marks = s.type === "QuotationMarks";
    const kebab = (v) => String(v).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, "");
    const variants2 = [
      marks ? "quotation-marks" : "indentation",
      marks && `left-${kebab(s.quoteStyleLeft || "None")}`,
      marks && `right-${kebab(s.quoteStyleRight || "None")}`,
      `align-${s.textAlignment || "left"}`,
      marks && s.quotationMarksAnchoring && `anchor-${kebab(s.quotationMarksAnchoring)}`,
      !s.isCustomSize && s.sizeChoice && `size-${s.sizeChoice.replace(/Size$/, "").toLowerCase()}`,
      !marks && s.showAccentLine && "accent-line"
    ].filter(Boolean);
    const rows = [[div(ctx, slateToHtml(parseSlate(s.content), ctx, { keepEmptyBreaks: true }))]];
    if (s.showAuthor && s.authorName) rows.push(["Author", s.authorName]);
    const settings = css({
      "--quote-marks-color": marks && s.isCustomQuotesColor ? rgbaToCss(s.quotesColor) : "",
      "--quote-size": s.isCustomSize ? s.sizeValue : "",
      "--quote-line": !marks && s.showAccentLine ? `${s.lineWidthValue || "2px"} ${s.lineType || "solid"} ${s.isCustomLineColor ? rgbaToCss(s.accentLineColor) : "currentcolor"}` : ""
    });
    if (settings) rows.push(["Settings", settings]);
    return create(ctx, `Quote (${variants2.join(", ")})`, rows);
  }
  function table(b, ctx) {
    const s = b.settings || {};
    const cols = s.columns || [];
    const cell = (h) => div(ctx, String(h || "").replace(/<p>(\s|&nbsp;|<br[^>]*>)*<\/p>/g, "<p>\u200B</p>").replace(/<br class="softbreak"\s*\/?>/g, "<br>").replace(/\s(class|data-tooltip-link-label)="[^"]*"/g, ""));
    const rows = [cols.map((c) => cell(c.label))];
    (s.data || []).forEach((r) => rows.push(cols.map((c, i) => cell(Array.isArray(r) ? r[i] : r[c.field]))));
    const widths = cols.map((c) => c.width).filter(Boolean);
    return create(ctx, `Table (frontify${widths.length === cols.length ? `, widths-${widths.join("-")}` : ""})`, rows);
  }
  function templateCard(b, ctx, data) {
    var _a;
    const s = b.settings || {};
    const variants2 = [
      `text-${s.textPositioning || "left"}`,
      s.textRatio && `ratio-${s.textRatio}`,
      s.textAnchoringVertical && `v-${s.textAnchoringVertical}`,
      s.textAnchoringHorizontal && `h-${s.textAnchoringHorizontal}`,
      `preview-${s.preview || "template"}`,
      s.previewDisplay && `display-${s.previewDisplay}`,
      s.buttonStyle && `button-${s.buttonStyle}`,
      s.hasPageCount && "page-count"
    ].filter(Boolean);
    const PADDING = {
      None: "0px",
      Small: "10px",
      Medium: "20px",
      Large: "30px"
    };
    const pad = s.hasCustomPaddingValue_blockCard ? s.paddingCustom_blockCard : PADDING[s.paddingChoice_blockCard];
    const RADIUS = {
      None: "0px",
      Small: "2px",
      Medium: "4px",
      Large: "12px"
    };
    const radius = (id) => s[`hasRadius_${id}`] ? s[`radiusValue_${id}`] : RADIUS[s[`radiusChoice_${id}`]];
    const PREVIEW_HEIGHT = {
      auto: "auto",
      small: "200px",
      medium: "400px",
      large: "600px"
    };
    const settings = css({
      "--tpl-bg": s.hasBackground ? rgbaToCss(s.backgroundColor) : "",
      "--tpl-border": s.hasBorder_blockCard ? `${s.borderWidth_blockCard} ${String(s.borderStyle_blockCard).toLowerCase()} ${rgbaToCss(s.borderColor_blockCard)}` : "",
      "--tpl-padding": pad,
      "--tpl-radius": radius("blockCard"),
      "--tpl-preview-bg": s.hasBackgroundTemplatePreview ? rgbaToCss(s.backgroundColorTemplatePreview) : "",
      "--tpl-preview-border": s.hasBorder_templatePreview ? `${s.borderWidth_templatePreview} ${String(s.borderStyle_templatePreview).toLowerCase()} ${rgbaToCss(s.borderColor_templatePreview)}` : "",
      "--tpl-preview-height": s.isPreviewHeightCustom ? s.previewHeightCustom : PREVIEW_HEIGHT[s.previewHeightSimple],
      "--tpl-preview-radius": radius("templatePreview"),
      "--tpl-preview-position": s.previewImageAnchoring
    });
    const preview = s.preview || "template";
    let a = null;
    if (preview === "custom") a = asset(b, "previewCustom");
    else if (preview === "template") a = (((_a = b.assets) == null ? void 0 : _a.templatePreview) || [])[0] || null;
    if (preview !== "none" && !a) ctx.notes.push(`Template block ${b.id}: preview image (${preview}) not in the export, preview left empty`);
    const text = ctx.document.createElement("div");
    if (!slateEmpty(s.title)) text.append(...div(ctx, slateToHtml(parseSlate(s.title), ctx, { keepEmpty: false })).childNodes);
    if (!slateEmpty(s.description)) text.append(...div(ctx, slateToHtml(parseSlate(s.description), ctx, { keepEmpty: false })).childNodes);
    const p = ctx.document.createElement("p");
    const btn = ctx.document.createElement("a");
    btn.href = data.originalUrl;
    btn.textContent = "Use this Template";
    p.append(btn);
    text.append(p);
    ctx.notes.push(`Template block ${b.id}: "Use this Template" opens Frontify's template editor (not migrated); links to the Frontify page`);
    return create(ctx, `Template Card (${variants2.join(", ")})`, [[picture(ctx, a, "") || ""], [text], ["Settings", settings]]);
  }
  var LEGACY = {
    Divider: parse2,
    Callout: parse3,
    Annotations: parse4,
    "Asset Kit": parse5,
    Colors: parse6,
    Video: parse7,
    "Image grid": parse8
  };
  function cellFor(b, ctx, data) {
    var _a;
    const type = b.display_name || (b.slug !== void 0 ? "Heading" : "Unknown");
    let out = null;
    if (type === "Text") out = textCell(b, ctx);
    else if (type === "Heading") out = headingCell(b, ctx);
    else if (type === "Image") {
      const a = (((_a = b.assets) == null ? void 0 : _a.image) || [])[0];
      if (a && ctx.alts[`asset-${a.id}`] !== void 0) {
        a.alternative_text = ctx.alts[`asset-${a.id}`];
        b.settings.altText = ctx.alts[`asset-${a.id}`];
      }
      [out] = parse(b, ctx);
    } else if (type === "Cards Grid") out = cardsGrid(b, ctx);
    else if (type === "Slider") out = slider(b, ctx);
    else if (type === "Flip Card") out = flipCard(b, ctx);
    else if (type === "Do & Don't") out = dosDonts(b, ctx);
    else if (type === "Quote") out = quote(b, ctx);
    else if (type === "Table") out = table(b, ctx);
    else if (type === "Template") out = templateCard(b, ctx, data);
    else if (LEGACY[type]) [out] = LEGACY[type](b, ctx, {});
    else ctx.notes.push(`Unknown block type ${type} (${b.id})`);
    if (!out) ctx.notes.push(`${type} ${b.id}: no output, empty cell kept`);
    return { type, el: out || emptyCell(ctx) };
  }
  function buildSections(data, ctx) {
    const { document } = ctx;
    const main = document.createElement("div");
    const counts = {};
    data.sections.forEach((s, i) => {
      if (i > 0) main.append(document.createElement("hr"));
      (s.content || []).forEach((b) => {
        const { type, el } = cellFor(b, ctx, data);
        counts[type] = (counts[type] || 0) + 1;
        main.append(el);
      });
      const meta = {
        Style: `doc-row, ${s.scheme}`,
        Section: String(s.id),
        Columns: (s.column_proportions || [24]).join(" ")
      };
      if (s.vertical_padding || s.horizontal_padding) meta.Padding = `${s.vertical_padding || "default"} ${s.horizontal_padding || "default"}`;
      if (s.vertical_gutter || s.horizontal_gutter) meta.Gutter = `${s.vertical_gutter || "default"} ${s.horizontal_gutter || "default"}`;
      if (s.max_width && s.max_width !== "inherit") meta["Max Width"] = s.max_width;
      if (s.alignment) meta.Alignment = s.alignment;
      if (s.group_id) {
        meta["Tab Group"] = s.group_id;
        meta.Tab = s.label || "";
      }
      main.append(create(ctx, "Section Metadata", meta));
    });
    return { main, counts };
  }
  function makeCtx(document, data, notes) {
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
      notes
    };
  }

  // tools/importer/import-doc-cover-page.js
  var payload = null;
  function readPayload(document) {
    if (payload) return payload;
    const el = document.getElementById("frontify-export");
    if (!el) throw new Error("No #frontify-export payload in source page");
    payload = JSON.parse(el.textContent);
    return payload;
  }
  function buildPage(document, data, notes) {
    const ctx = makeCtx(document, data, notes);
    const { main, counts } = buildSections(data, ctx);
    main.append(WebImporter.Blocks.getMetadataBlock(document, {
      Title: data.tabTitle,
      Template: "doc-cover",
      Theme: data.route,
      Scheme: data.pageScheme,
      Nav: `/${data.route}/nav`,
      Footer: `/${data.route}/footer`,
      "Frontify Document": `${data.doc.id} (${data.doc.title})`,
      "Frontify Page Id": String(data.page.id),
      "Original Url": data.originalUrl
    }));
    return { main, counts, ctx };
  }
  function buildNav(document, data) {
    const div2 = document.createElement("div");
    const { nav, assets, alts } = data;
    const logo = nav.logoKey ? `<p><a href="${nav.logoHref}"><img src="${assets[nav.logoKey]}" alt="${(alts[nav.logoKey] || data.portal.title).replace(/"/g, "&quot;")}"></a></p>` : "";
    const bg = nav.headerKey ? `<p><img src="${assets[nav.headerKey]}" alt=""></p>` : "";
    div2.innerHTML = `${logo}<p><a href="${nav.railHref}">Back to dashboard</a></p>${bg}`;
    div2.append(document.createElement("hr"));
    const ul = document.createElement("ul");
    nav.items.forEach((n) => {
      const li = document.createElement("li");
      if (n.children) {
        li.append(document.createTextNode(n.title));
        const sub = document.createElement("ul");
        n.children.forEach((c) => {
          const s = document.createElement("li");
          const a = document.createElement("a");
          a.href = c.href;
          a.textContent = c.title;
          s.append(a);
          sub.append(s);
        });
        li.append(sub);
      } else {
        const a = document.createElement("a");
        a.href = n.href;
        a.textContent = n.title;
        li.append(a);
      }
      ul.append(li);
    });
    div2.append(ul, document.createElement("hr"));
    if (nav.brandHub) div2.insertAdjacentHTML("beforeend", `<ul><li><a href="${nav.brandHub.href}">:brand-hub: ${nav.brandHub.label}</a></li></ul>`);
    return div2;
  }
  var import_doc_cover_page_default = {
    onLoad: ({ document }) => {
      payload = null;
      readPayload(document);
    },
    transform: ({ document }) => {
      const data = readPayload(document);
      const notes = [];
      const { main, counts, ctx } = buildPage(document, data, notes);
      const footer = document.createElement("div");
      footer.innerHTML = "<p></p>";
      return [
        {
          element: main,
          path: data.pagePath,
          report: {
            blocks: JSON.stringify(counts),
            notes: JSON.stringify(notes),
            links: ctx.links.length,
            missing: JSON.stringify(ctx.missing)
          }
        },
        { element: buildNav(document, data), path: `/${data.route}/nav` },
        { element: footer, path: `/${data.route}/footer` }
      ];
    }
  };
  return __toCommonJS(import_doc_cover_page_exports);
})();
