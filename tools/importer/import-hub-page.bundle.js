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

  // tools/importer/import-hub-page.js
  var import_hub_page_exports = {};
  __export(import_hub_page_exports, {
    default: () => import_hub_page_default
  });

  // tools/importer/utils/hub.js
  var BLOCK_SEL = "h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote";
  function resolveLink(url, ctx) {
    if (!url) return url;
    const rec = ctx.linkMap[url];
    if (rec == null ? void 0 : rec.migrated) return rec.migrated;
    if (rec == null ? void 0 : rec.target) return rec.target;
    return url.startsWith("/") ? ctx.host + url : url;
  }
  function convertCellHtml(html, ctx) {
    const d = ctx.document.createElement("div");
    d.innerHTML = (html || "").replace(/\uFEFF/g, "");
    d.querySelectorAll("span[contenteditable]").forEach((s) => s.replaceWith(...s.childNodes));
    d.querySelectorAll("br.softbreak").forEach((br) => br.removeAttribute("class"));
    d.querySelectorAll("a").forEach((a) => {
      const href = resolveLink(a.getAttribute("href"), ctx);
      const cls = a.className || "";
      const clean = ctx.document.createElement("a");
      clean.href = href;
      clean.textContent = a.textContent.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, "").replace(/\u00a0$/, "\xA0\u200B");
      if (a.getAttribute("target") === "_blank") clean.setAttribute("target", "_blank");
      let el = clean;
      if (/btn-primary/.test(cls)) {
        el = ctx.document.createElement("strong");
        el.append(clean);
      }
      if (/btn-secondary/.test(cls)) {
        el = ctx.document.createElement("em");
        el.append(clean);
      }
      if (/btn-tertiary/.test(cls)) {
        const s = ctx.document.createElement("strong");
        s.append(clean);
        el = ctx.document.createElement("em");
        el.append(s);
      }
      a.replaceWith(el);
    });
    const styles = [];
    [...d.querySelectorAll(BLOCK_SEL)].filter((el) => !el.parentElement.closest(BLOCK_SEL)).forEach((el, i) => {
      var _a, _b, _c;
      const css = [];
      const custom = (/(custom\d)/.exec(el.className || "") || [])[1];
      if (custom) css.push(`class: ${custom}`);
      const align = (/ql-align-(\w+)/.exec(el.className || "") || [])[1];
      if (align) css.push(`text-align: ${align}`);
      const fs = (_a = el.style) == null ? void 0 : _a.fontSize;
      if (fs) css.push(`font-size: ${fs}`);
      if ((_b = el.style) == null ? void 0 : _b.color) css.push(`color: ${el.style.color}`);
      const runs = [...el.childNodes].filter((n) => n.nodeType === 3 && n.previousSibling && n.nextSibling && /^[\s\u00a0]+$/.test(n.nodeValue)).map((n) => n.nodeValue.length);
      if (runs.some((n) => n > 1)) css.push("white-space: pre-wrap", `spaces: ${runs.join(",")}`);
      const spans = [...el.querySelectorAll("span[style]")];
      const colors = [...new Set(spans.map((s) => s.style.color).filter(Boolean))];
      if (colors.length === 1 && !((_c = el.style) == null ? void 0 : _c.color)) css.push(`color: ${colors[0]}`);
      spans.forEach((s) => s.replaceWith(...s.childNodes));
      el.removeAttribute("style");
      el.removeAttribute("class");
      if (!el.textContent.trim() && !el.querySelector("img,a")) el.innerHTML = "\u200B";
      if (css.length) styles.push(`${i + 1}: ${css.join("; ")}`);
    });
    return { html: d.innerHTML, styles };
  }
  function box(p) {
    if (!p) return null;
    const v = (x) => {
      if (x === 0 || x === "0" || x == null) return "0";
      return typeof x === "number" ? `${x}px` : String(x);
    };
    return [p.top, p.right, p.bottom, p.left].map(v).join(" ");
  }
  var len = (x) => {
    if (x == null || x === "") return null;
    return typeof x === "number" ? `${x}px` : String(x);
  };

  // tools/importer/parsers/hub-cell.js
  function parse(cell, ctx) {
    var _a, _b, _c;
    const s = cell.settings || {};
    const variants = [
      s.layout || "text",
      `w-${cell.width || 12}`,
      s.content_position && `text-${s.content_position}`,
      s.image_position && `image-${s.image_position}`,
      s.cover && "cover",
      s.cover_mode && s.cover_mode !== "cover" && `cover-mode-${s.cover_mode}`
    ].filter(Boolean);
    const rows = [];
    const key = `cell-${cell.sort}-${cell.key}`;
    const src = ctx.assets[key];
    const img = s.image && typeof s.image === "object" ? s.image : null;
    if (src) {
      const el = ctx.document.createElement("img");
      el.src = src;
      el.alt = s.image_alt || (ctx.assetAlts || {})[key] || "";
      rows.push([el]);
    } else if ((img == null ? void 0 : img.file_id) && s.layout !== "text") {
      ctx.notes.push(`cell ${key}: image ${img.file_id} has no file in the hub data (not rendered by Frontify)`);
    }
    const { html, styles } = convertCellHtml(s.content || "", ctx);
    if (html.trim()) {
      const div = ctx.document.createElement("div");
      div.innerHTML = html;
      rows.push([div]);
    }
    const kv = (k, v) => {
      if (v != null && v !== "") rows.push([k, String(v)]);
    };
    kv("Link", ((_a = s.link) == null ? void 0 : _a.url) ? resolveLink(s.link.url, ctx) : null);
    kv("Image Link", ((_b = s.image_link) == null ? void 0 : _b.url) ? resolveLink(s.image_link.url, ctx) : null);
    if (s.new_window || ((_c = s.link) == null ? void 0 : _c.new_window)) kv("New Window", "true");
    if (s.image_new_window) kv("Image New Window", "true");
    const transparent = (c) => !c || /rgba\([^)]*,\s*0\)$/.test(c);
    if (src && !transparent(s.image_background)) kv("Image Background", s.image_background);
    kv("Content Padding", box(s.content_padding));
    const ip = box(s.image_padding);
    if (ip && ip !== "0 0 0 0") kv("Image Padding", ip);
    kv("Content Width", len(s.content_width));
    kv("Image Width", len(s.image_width));
    if (src && (img == null ? void 0 : img.ratio_percent)) kv("Ratio", `${Number(img.ratio_percent).toFixed(4)}%`);
    kv("Overlay", s.image_overlay);
    kv("Content Background", s.content_background);
    if (s.border && (s.border.width || s.border.radius)) kv("Border", `${s.border.width || 0}px solid ${s.border.color}; radius ${s.border.radius || 0}px`);
    if (styles.length) rows.push(["Styles", styles.join("\n")]);
    kv("Frontify Cell", `${cell.teaser} (row ${ctx.rowId}, sort ${cell.sort})`);
    return ctx.WebImporter.Blocks.createBlock(ctx.document, { name: `Hub Cell (${variants.join(", ")})`, cells: rows });
  }

  // tools/importer/parsers/hub-divider.js
  function parse2(cell, ctx) {
    const s = cell.settings || {};
    const rows = [
      ["Line", `${s.height || 1}px ${s.background || "rgb(221, 221, 221)"}`],
      ["Padding", box(s.padding) || "25px 0 25px 0"]
    ];
    if (s.containerBackground && !/,\s*0\)$/.test(s.containerBackground)) rows.push(["Background", s.containerBackground]);
    rows.push(["Frontify Cell", `${cell.teaser} (row ${ctx.rowId}, sort ${cell.sort})`]);
    return ctx.WebImporter.Blocks.createBlock(ctx.document, { name: `Hub Divider (w-${cell.width || 12})`, cells: rows });
  }

  // tools/importer/import-hub-page.js
  var payload = null;
  function readPayload(document) {
    if (payload) return payload;
    const el = document.getElementById("frontify-hub-export");
    if (!el) throw new Error("No #frontify-hub-export payload in source page");
    payload = JSON.parse(el.textContent);
    return payload;
  }
  var len2 = (x) => {
    if (x == null || x === "") return null;
    return typeof x === "number" ? `${x}px` : String(x);
  };
  function buildPage(document, data, notes) {
    const main = document.createElement("div");
    const counts = { rows: 0, cells: 0 };
    data.rows.forEach((row, i) => {
      if (i > 0) main.append(document.createElement("hr"));
      counts.rows += 1;
      const ctx = {
        document,
        WebImporter,
        assets: data.assets,
        assetAlts: data.assetAlts,
        linkMap: data.linkMap,
        host: data.host,
        notes,
        rowId: row.id
      };
      let visible = 0;
      const hasContent = row.cells.some((c) => c.block_type === "TEXTIMAGE" || c.block_type === "DIVIDER");
      row.cells.forEach((cell) => {
        counts.cells += 1;
        if (cell.block_type === "TEXTIMAGE") {
          main.append(parse(cell, ctx));
          visible += 1;
        } else if (cell.block_type === "DIVIDER") {
          main.append(parse2(cell, ctx));
          visible += 1;
        } else if (hasContent) {
          main.append(WebImporter.Blocks.createBlock(document, {
            name: `Hub Cell (none, w-${cell.width || 12})`,
            cells: [["Frontify Cell", `${cell.teaser} (row ${row.id}, sort ${cell.sort}, empty)`]]
          }));
        } else {
          notes.push(`row ${row.id}: ${cell.block_type} cell ${cell.teaser} has no content (editor placeholder) - kept as empty row`);
        }
      });
      const s = row.settings || {};
      const meta = { Style: visible ? "hub-row" : "hub-row, empty", Row: String(row.id) };
      if (s.width) meta.Width = len2(s.width);
      if (s.content_width) meta["Content Width"] = len2(s.content_width);
      if (s.margin) meta.Gutter = len2(s.margin);
      if (s.margin_top) meta["Margin Top"] = len2(s.margin_top);
      if (s.margin_bottom) meta["Margin Bottom"] = len2(s.margin_bottom);
      if (s.background) meta.Background = s.background;
      main.append(WebImporter.Blocks.createBlock(document, { name: "Section Metadata", cells: meta }));
    });
    main.append(WebImporter.Blocks.getMetadataBlock(document, {
      Title: data.tabTitle,
      Template: "hub",
      Theme: data.route,
      Nav: `/${data.route}/nav`,
      Footer: `/${data.route}/footer`,
      "Frontify Portal": `${data.portal.id} (${data.portal.title})`,
      "Original Url": data.originalUrl || `${data.host}/${data.route}`
    }));
    return { main, counts };
  }
  function buildNav(document, data) {
    var _a;
    const div = document.createElement("div");
    const logo = data.assets[data.logoKey];
    const home = data.pagePath === "/index" ? "/" : data.pagePath || `/${data.route}`;
    const rail = data.railHref || `${data.host}/dashboard`;
    div.innerHTML = `<p><a href="${home}"><img src="${logo}" alt="Go to ${data.portal.title}"></a></p><p><a href="${rail}">Back to dashboard</a></p>`;
    div.append(document.createElement("hr"));
    const ul = document.createElement("ul");
    data.navItems.forEach((n) => {
      const li = document.createElement("li");
      if (n.children.length) {
        li.append(document.createTextNode(n.title));
        const sub = document.createElement("ul");
        n.children.forEach((c) => {
          const s = document.createElement("li");
          s.innerHTML = `<a href="${c.href}"></a>`;
          s.firstChild.textContent = c.title;
          sub.append(s);
        });
        li.append(sub);
      } else {
        li.innerHTML = `<a href="${n.href}"></a>`;
        li.firstChild.textContent = n.type === "cover_page" ? "Home" : n.title;
      }
      ul.append(li);
    });
    div.append(ul, document.createElement("hr"));
    const bh = (_a = data.portal.brandHub) == null ? void 0 : _a.url;
    if (bh) {
      const href = resolveLink(bh.startsWith("/") ? data.host + bh : bh, { linkMap: data.linkMap, host: data.host });
      div.insertAdjacentHTML("beforeend", `<ul><li><a href="${href}">:brand-hub: ${data.portal.brandHub.label || "Brand Hub"}</a></li></ul>`);
    }
    return div;
  }
  function buildFooter(document, data) {
    const div = document.createElement("div");
    const f = data.customFooter;
    if (!f) {
      div.innerHTML = "<p></p>";
      return div;
    }
    const src = document.createElement("div");
    src.innerHTML = f.markup.replace(/\\\//g, "/");
    const copy = src.querySelector(".o-tui__copyright");
    const p = document.createElement("p");
    p.textContent = (copy ? copy.textContent : "").trim();
    const ul = document.createElement("ul");
    src.querySelectorAll("a[href]").forEach((a) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = resolveLink(a.getAttribute("href"), { linkMap: data.linkMap, host: data.host });
      link.textContent = a.textContent.trim();
      li.append(link);
      ul.append(li);
    });
    div.append(p, ul);
    return div;
  }
  var import_hub_page_default = {
    onLoad: ({ document }) => {
      payload = null;
      readPayload(document);
    },
    transform: ({ document }) => {
      const data = readPayload(document);
      const notes = [];
      const { main, counts } = buildPage(document, data, notes);
      const footer = buildFooter(document, data);
      return [
        {
          element: main,
          path: data.pagePath || `/${data.route}`,
          report: {
            rows: counts.rows,
            cells: counts.cells,
            notes: JSON.stringify(notes),
            links: Object.keys(data.linkMap).length
          }
        },
        { element: buildNav(document, data), path: `/${data.route}/nav` },
        { element: footer, path: `/${data.route}/footer` }
      ];
    }
  };
  return __toCommonJS(import_hub_page_exports);
})();
