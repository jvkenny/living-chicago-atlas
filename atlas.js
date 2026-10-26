/* Living Chicago Atlas: one MapLibre map, one shared base, one plate open at a time.
   Plates (story layers) are folders with a layer.json manifest; see README.md for the format.
   In a single-file preview, window.ATLAS_BUNDLE carries every file and the map stays offline. */
(async function () {
  const BUNDLE = window.ATLAS_BUNDLE || null;
  const OFFLINE = !!(BUNDLE && BUNDLE.offline);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);
  if (params.has("embed")) document.body.classList.add("embed");

  async function getJSON(path) {
    if (BUNDLE && BUNDLE.files[path]) return BUNDLE.files[path];
    const r = await fetch(path);
    if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
    return r.json();
  }
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  // "{mw:,} MW" -> "1,803 MW"
  const fill = (tpl, props) => tpl.replace(/\{([^}:]+)(:,)?\}/g, (_, k, comma) => {
    const v = props[k];
    if (v == null) return "–";
    return comma && typeof v === "number" ? v.toLocaleString("en-US") : String(v);
  });

  const atlas = await getJSON("atlas.json");
  const P = atlas.base.palette;
  const plates = [];
  for (const id of atlas.layers) {
    const m = await getJSON(`layers/${id}/layer.json`);
    m.dir = `layers/${id}/`;
    plates.push(m);
  }
  plates.sort((a, b) => a.plate - b.plate);
  const byId = Object.fromEntries(plates.map((p) => [p.id, p]));

  /* ---------- Base style ---------- */
  const base = {};
  for (const n of ["land", "lakes", "rivers", "urban", "counties", "states", "roads"]) base[n] = await getJSON(`base/${n}.geojson`);
  const labels = await getJSON("base/labels.json");
  const detail = atlas.base.detail_tiles;
  const useDetail = detail && detail.enabled && !OFFLINE;
  const dz = useDetail ? detail.minzoom : 99;
  const cls = (list) => ["match", ["get", "class"], list, true, false];

  const style = {
    version: 8,
    sources: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { type: "geojson", data: v }])),
    layers: [
      { id: "bg", type: "background", paint: { "background-color": P.land } },
      { id: "urban", type: "fill", source: "urban", paint: { "fill-color": P.urban, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.9, 11, 0.3] } },
      { id: "counties", type: "line", source: "counties", minzoom: 7, paint: { "line-color": P.county, "line-width": 0.7, "line-dasharray": [4, 2] } }
    ]
  };
  if (useDetail) {
    style.glyphs = detail.glyphs;
    style.sources.detail = { type: "vector", url: detail.url, attribution: detail.attribution };
    style.layers.push(
      { id: "d-park", type: "fill", source: "detail", "source-layer": "park", minzoom: dz, paint: { "fill-color": "#DFE3CB", "fill-opacity": 0.55 } },
      { id: "d-water", type: "fill", source: "detail", "source-layer": "water", minzoom: dz, paint: { "fill-color": P.water } },
      { id: "d-waterway", type: "line", source: "detail", "source-layer": "waterway", minzoom: 10, paint: { "line-color": P.water_line, "line-width": 0.7, "line-opacity": 0.6 } },
      { id: "d-building", type: "fill", source: "detail", "source-layer": "building", minzoom: 14, paint: { "fill-color": "#E4DCC5" } },
      { id: "d-rail", type: "line", source: "detail", "source-layer": "transportation", minzoom: 11, filter: cls(["rail"]), paint: { "line-color": "#B7AE9E", "line-width": 0.8, "line-dasharray": [3, 2] } },
      { id: "d-minor", type: "line", source: "detail", "source-layer": "transportation", minzoom: 12, filter: cls(["minor", "service"]), paint: { "line-color": "#FBF8EE", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.4, 15, 2.6] } },
      { id: "d-major", type: "line", source: "detail", "source-layer": "transportation", minzoom: dz, filter: cls(["primary", "secondary", "tertiary", "trunk"]), paint: { "line-color": "#FDFBF4", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 15, 4.5] } },
      { id: "d-motorway", type: "line", source: "detail", "source-layer": "transportation", minzoom: dz, filter: cls(["motorway"]), paint: { "line-color": P.road_major, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.9, 15, 5] } }
    );
  }
  style.layers.push(
    { id: "states", type: "line", source: "states", paint: { "line-color": P.state, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 10, 1.8], "line-dasharray": [6, 2, 1, 2] } },
    { id: "lakes", type: "fill", source: "lakes", paint: { "fill-color": P.water } },
    { id: "shore", type: "line", source: "lakes", paint: { "line-color": P.water_line, "line-width": 0.6, "line-opacity": 0.7 } },
    { id: "rivers", type: "line", source: "rivers", maxzoom: useDetail ? dz + 1 : 24, paint: { "line-color": P.water_line, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1.4], "line-opacity": 0.75 } },
    { id: "roads", type: "line", source: "roads", maxzoom: useDetail ? dz + 0.5 : 24, paint: { "line-color": ["match", ["get", "expressway"], 1, P.road_major, P.road], "line-width": ["interpolate", ["linear"], ["zoom"], 6, ["match", ["get", "expressway"], 1, 0.9, 0.5], 11, ["match", ["get", "expressway"], 1, 2.6, 1.4]] } },
  );
  if (useDetail) {
    style.layers.push(
      { id: "d-road-name", type: "symbol", source: "detail", "source-layer": "transportation_name", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 10.5 },
        paint: { "text-color": P.muted, "text-halo-color": P.halo, "text-halo-width": 1.2 } },
      { id: "d-hood", type: "symbol", source: "detail", "source-layer": "place", minzoom: 11.5, filter: cls(["suburb", "neighbourhood", "quarter"]),
        layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 11.5, "text-transform": "uppercase", "text-letter-spacing": 0.08 },
        paint: { "text-color": P.muted, "text-halo-color": P.halo, "text-halo-width": 1.4 } }
    );
  }

  const [W, S, E, N] = atlas.extent;
  const narrow = () => window.matchMedia("(max-width: 860px)").matches;
  const map = new maplibregl.Map({
    container: "map", style, center: atlas.home.center, zoom: atlas.home.zoom,
    minZoom: 5.5, maxZoom: atlas.max_zoom, maxBounds: [[W - 0.6, S - 0.4], [E + 0.6, N + 0.4]],
    attributionControl: false, dragRotate: false, pitchWithRotate: false, fadeDuration: 0
  });
  window.atlasMap = map;
  // If the street tiles cannot be reached, keep the Natural Earth roads and rivers at every zoom.
  map.on("error", (e) => {
    if (e.sourceId !== "detail" || map._detailDown) return;
    map._detailDown = true;
    for (const id of ["roads", "rivers"]) map.setLayerZoomRange(id, 0, 24);
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-left");
  map.addControl(new maplibregl.ScaleControl({ unit: "imperial", maxWidth: 110 }), "bottom-left");
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: [atlas.base.attribution] }), "bottom-right");

  /* ---------- Hand-placed labels (HTML, so they use the atlas typefaces and need no glyph server) ---------- */
  const ICONS = {
    "cooling-tower": (c = "#3E3B34") => `<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M2 1h10c-2.2 4.5-2.2 9 0 14H2c2.2-5 2.2-9.5 0-14z" fill="${c}" stroke="#FBFBF8" stroke-width=".8"/></svg>`,
    "dot": (c = "#1F1D18") => `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="${c}" stroke="#FBFBF8"/></svg>`,
    "square": (c = "#1F1D18") => `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" fill="${c}" stroke="#FBFBF8"/></svg>`,
    "triangle": (c = "#1F1D18") => `<svg width="12" height="11" viewBox="0 0 12 11" aria-hidden="true"><path d="M6 1l5 9H1z" fill="${c}" stroke="#FBFBF8"/></svg>`
  };
  const placeMin = (r) => (r <= 1 ? 4 : r <= 3 ? 6 : r <= 6 ? 6.4 : r <= 7 ? 6.8 : r <= 8 ? 7.2 : r <= 9 ? 8.4 : 9.4);
  const allLabels = []; // {marker, node, min, max, prio, group}
  function addLabel({ lngLat, html, text, cls, min = 0, max = 99, prio = 5, anchor = "center", rotate = 0, group = "base", offset }) {
    const node = el("div", `lbl ${cls}`);
    if (html) node.innerHTML = html; else node.textContent = text;
    if (rotate) node.style.transform = `rotate(${rotate}deg)`;
    const wrap = el("div");
    wrap.appendChild(node);
    const marker = new maplibregl.Marker({ element: wrap, anchor, offset: offset || [0, 0] }).setLngLat(lngLat).addTo(map);
    const item = { marker, node, min, max, prio, group, on: true };
    allLabels.push(item);
    return item;
  }
  for (const p of labels.places) {
    const r = p.rank <= 1 ? "r1" : p.rank <= 3 ? "r3" : "";
    addLabel({ lngLat: [p.lon, p.lat], text: p.name, cls: `place ${r}`, min: placeMin(p.rank), prio: 20 + p.rank, anchor: "left", offset: [-2, 0] });
  }
  for (const w of labels.water) addLabel({ lngLat: [w.lon, w.lat], text: w.name, cls: `water ${w.name.startsWith("Lake") ? "big" : ""}`, min: w.minzoom, prio: 15, rotate: w.rotate });
  for (const g of labels.regions) addLabel({ lngLat: [g.lon, g.lat], text: g.name, cls: "region", min: g.minzoom, max: g.maxzoom, prio: 40 });

  // Greedy collision: higher priority (lower number) claims its box first.
  function placeLabels() {
    const z = map.getZoom();
    const taken = [];
    const sorted = allLabels.filter((l) => l.on).sort((a, b) => a.prio - b.prio);
    for (const l of allLabels) if (!l.on) l.node.parentElement.hidden = true;
    for (const l of sorted) {
      const wrap = l.node.parentElement;
      const inRange = z >= l.min && z < l.max;
      wrap.hidden = !inRange;
      if (!inRange) continue;
      l.node.classList.remove("hide");
      const b = l.node.getBoundingClientRect();
      const box = [b.left - 3, b.top - 2, b.right + 3, b.bottom + 2];
      const hit = taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1]);
      if (hit && l.prio >= 10) l.node.classList.add("hide");
      else taken.push(box);
    }
  }
  map.on("zoom", () => { const z = map.getZoom(); for (const l of allLabels) if (l.on) l.node.parentElement.hidden = !(z >= l.min && z < l.max); });
  map.on("moveend", placeLabels);

  /* ---------- Plates ---------- */
  const OPACITY = { fill: ["fill-opacity"], line: ["line-opacity"], circle: ["circle-opacity", "circle-stroke-opacity"], "fill-extrusion": ["fill-extrusion-opacity"], heatmap: ["heatmap-opacity"], symbol: ["text-opacity", "icon-opacity"] };
  const state = { active: null, overlays: new Set() };

  await new Promise((res) => map.once("load", res));

  for (const p of plates) {
    p.mapLayers = [];
    p.labels = [];
    for (const d of p.draw) {
      const src = `${p.id}:${d.id}`;
      map.addSource(src, { type: "geojson", data: await getJSON(p.dir + d.data) });
      const layer = { id: src, type: d.type, source: src, layout: Object.assign({ visibility: "none" }, d.layout || {}), paint: d.paint || {} };
      if (d.filter) layer.filter = d.filter;
      if (d.minzoom != null) layer.minzoom = d.minzoom;
      // Area washes sit under the lakes and shoreline so they never tint the water.
      map.addLayer(layer, d.type === "fill" || d.type === "heatmap" ? "lakes" : undefined);
      const base = {};
      for (const prop of OPACITY[d.type] || []) base[prop] = (d.paint || {})[prop] ?? 1;
      p.mapLayers.push({ id: src, base, popup: d.popup });
      if (d.popup) {
        map.on("click", src, (e) => {
          if (state.active !== p.id) return;
          const f = e.features[0];
          const box = el("div", "pop");
          box.appendChild(el("h3", null, fill(d.popup.title, f.properties)));
          const t = el("table");
          for (const [k, v] of d.popup.rows || []) {
            const tr = el("tr");
            tr.append(el("td", null, k), el("td", null, fill(v, f.properties)));
            t.appendChild(tr);
          }
          box.appendChild(t);
          if (d.popup.note) box.appendChild(el("p", null, d.popup.note));
          new maplibregl.Popup({ maxWidth: "300px" }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
        });
        map.on("mouseenter", src, () => { if (state.active === p.id) map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", src, () => { map.getCanvas().style.cursor = ""; });
      }
    }
    for (const mk of p.markers || []) {
      const gj = await getJSON(p.dir + mk.data);
      for (const f of gj.features) {
        const icon = (ICONS[mk.icon] || ICONS.dot)(mk.color);
        const sub = mk.sublabel ? `<small>${fill(mk.sublabel, f.properties)}</small>` : "";
        const item = addLabel({ lngLat: f.geometry.coordinates, html: `${icon}<span>${fill(mk.label, f.properties)}${sub}</span>`,
          cls: "marker", min: mk.minzoom ?? 0, prio: 2, anchor: "left", offset: [-7, 0], group: p.id });
        item.on = false;
        p.labels.push(item);
      }
    }
    for (const a of p.annotations || []) {
      const item = addLabel({ lngLat: [a.lon, a.lat], text: a.text, cls: "note", min: a.minzoom ?? 0, max: a.maxzoom ?? 99, prio: 1, anchor: a.anchor || "center", group: p.id });
      item.on = false;
      p.labels.push(item);
    }
  }

  function setPlateLook(p, mode) { // mode: "active" | "overlay" | "off"
    for (const L of p.mapLayers) {
      map.setLayoutProperty(L.id, "visibility", mode === "off" ? "none" : "visible");
      for (const [prop, v] of Object.entries(L.base)) {
        if (typeof v === "number") map.setPaintProperty(L.id, prop, mode === "overlay" ? v * 0.35 : v);
      }
    }
    for (const item of p.labels) item.on = mode === "active";
  }

  function frame(p) {
    const v = p.view;
    const opts = { center: v.center, zoom: narrow() && v.mobile_zoom ? v.mobile_zoom : v.zoom };
    if (reduceMotion) map.jumpTo(opts); else map.flyTo(Object.assign({ duration: 1400, essential: false }, opts));
  }

  function openPlate(id, { move = true } = {}) {
    const p = byId[id] || plates[plates.length - 1];
    state.active = p.id;
    state.overlays.delete(p.id);
    for (const q of plates) setPlateLook(q, q.id === p.id ? "active" : state.overlays.has(q.id) ? "overlay" : "off");
    document.documentElement.style.setProperty("--accent", p.accent || "#B95A1F");
    renderIndex();
    renderStory(p);
    document.getElementById("map").setAttribute("aria-label", `Map. ${p.alt || p.title}`);
    if (history.replaceState) history.replaceState(null, "", `${location.pathname}${location.search}#${p.id}`);
    if (move) frame(p);
    placeLabels();
  }

  /* ---------- Column ---------- */
  const causeLabel = Object.fromEntries(atlas.causes.map((c) => [c.id, c.label]));
  const fmtDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  document.getElementById("atlas-name").textContent = atlas.title;
  document.getElementById("atlas-sub").textContent = atlas.subtitle;
  document.getElementById("plate-count").textContent = `${plates.length} so far`;
  document.title = atlas.title;

  function renderIndex() {
    const ul = document.getElementById("plates");
    ul.replaceChildren();
    for (const p of [...plates].reverse()) {
      const li = el("li", `plate${p.id === state.active ? " active" : ""}`);
      li.appendChild(el("span", "no", String(p.plate).padStart(2, "0")));
      const b = el("button", "open", p.title);
      b.type = "button";
      b.setAttribute("aria-current", p.id === state.active ? "true" : "false");
      b.addEventListener("click", () => openPlate(p.id));
      li.appendChild(b);
      const lab = el("label", "overlay");
      const cb = el("input");
      cb.type = "checkbox"; cb.id = `overlay-${p.id}`; cb.checked = state.overlays.has(p.id);
      cb.addEventListener("change", () => {
        if (cb.checked) state.overlays.add(p.id); else state.overlays.delete(p.id);
        setPlateLook(p, cb.checked ? "overlay" : "off");
        placeLabels();
      });
      lab.append(cb, el("span", null, "Overlay"));
      li.appendChild(lab);
      li.appendChild(el("span", "meta", `${causeLabel[p.cause] || p.cause} · ${fmtDate(p.added)}${p.status === "draft" ? " · draft" : ""}`));
      ul.appendChild(li);
    }
    if (plates.length < 2) for (const n of ul.querySelectorAll(".overlay")) n.hidden = true;
  }

  function legendSwatch(item) {
    const ns = "http://www.w3.org/2000/svg";
    if (item.symbol === "icon") { const s = el("span"); s.innerHTML = (ICONS[item.icon] || ICONS.dot)(item.color); return s; }
    const svg = document.createElementNS(ns, "svg");
    const add = (tag, attrs) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.appendChild(n); return n; };
    if (item.symbol === "circle-sizes") {
      const max = Math.max(...item.values), R = 15;
      svg.setAttribute("width", 40); svg.setAttribute("height", 2 * R + 2);
      for (const v of [...item.values].sort((a, b) => b - a)) {
        const r = R * Math.sqrt(v / max);
        add("circle", { cx: 16, cy: 2 * R + 1 - r, r, fill: "none", stroke: "currentColor", "stroke-width": 0.9 });
      }
      svg.style.color = "var(--ink-2)";
      return svg;
    }
    svg.setAttribute("width", 34); svg.setAttribute("height", 16);
    if (item.symbol === "circle") add("circle", { cx: 17, cy: 8, r: 6.5, fill: item.fill, stroke: item.stroke || "none", "stroke-width": 1.4 });
    if (item.symbol === "line") add("line", { x1: 2, y1: 8, x2: 32, y2: 8, stroke: item.color, "stroke-width": item.width || 2.2, "stroke-linecap": "round", "stroke-dasharray": item.dash || "" });
    if (item.symbol === "fill") add("rect", { x: 3, y: 2, width: 28, height: 12, fill: item.fill, "fill-opacity": item.opacity ?? 1, stroke: item.stroke || "none" });
    return svg;
  }

  function renderStory(p) {
    const s = document.getElementById("story");
    s.replaceChildren();
    s.appendChild(el("p", "kicker", `Plate ${String(p.plate).padStart(2, "0")} · ${p.kicker}`));
    s.appendChild(el("h1", null, p.title));
    s.appendChild(el("p", "takeaway", p.takeaway));
    for (const para of p.story || []) s.appendChild(el("p", "body", para));
    if (p.peg) {
      const peg = el("p", "peg", "Pegged to ");
      const a = el("a", null, `“${p.peg.headline}”`);
      a.href = p.peg.url; a.target = "_blank"; a.rel = "noopener";
      peg.append(a, `, ${p.peg.author}, ${p.peg.outlet}, ${fmtDate(p.peg.date)}.`);
      s.appendChild(peg);
    }

    const leg = el("section");
    leg.appendChild(el("h2", "section-label", "Key"));
    const ul = el("ul", "legend");
    for (const item of p.legend || []) { const li = el("li"); li.append(legendSwatch(item), el("span", null, item.label)); ul.appendChild(li); }
    leg.appendChild(ul);
    s.appendChild(leg);

    for (const fig of p.figures || []) {
      if (fig.type !== "bars") continue;
      const f = el("section", "figure");
      f.appendChild(el("h2", "section-label", fig.title));
      const g = el("div", "bars");
      const max = Math.max(...fig.rows.map((r) => r.value));
      for (const r of fig.rows) {
        g.appendChild(el("span", `lab${r.highlight ? " hi" : ""}`, r.label));
        const tr = el("span", "track");
        const bar = el("span", `bar${r.highlight ? " hi" : ""}`);
        bar.style.width = `calc((100% - 3.5em) * ${r.value / max})`;
        tr.append(bar, el("span", "val", r.value.toLocaleString("en-US")));
        g.appendChild(tr);
      }
      f.appendChild(g);
      if (fig.note) f.appendChild(el("p", "note", fig.note));
      s.appendChild(f);
    }

    const about = el("details", "about");
    about.open = !narrow();
    about.appendChild(el("summary", null, "Sources, method and caveats"));
    const dl = el("dl");
    const row = (term, node) => { const w = el("div"); w.append(el("dt", null, term)); const dd = el("dd"); dd.append(node); w.append(dd); dl.append(w); };
    row("Data as of", p.data_as_of);
    const src = el("ol");
    for (const x of p.sources) {
      const li = el("li");
      li.append(`${x.publisher}, ${x.name}. ${x.date}. `);
      if (x.url) { const a = el("a", null, "Source"); a.href = x.url; a.target = "_blank"; a.rel = "noopener"; li.append(a); }
      src.append(li);
    }
    row("Sources", src);
    const meth = el("ul"); for (const m of p.method || []) meth.append(el("li", null, m)); row("Method", meth);
    const cav = el("ul"); for (const c of p.caveats || []) cav.append(el("li", null, c)); row("Caveats", cav);
    row("Projection", `${p.projection} ${atlas.display_projection.split(".")[0]}.`);
    if (p.downloads && !OFFLINE) {
      const d = el("ul");
      for (const x of p.downloads) { const li = el("li"); const a = el("a", null, `${x.label} (${x.file.split("/").pop()})`); a.href = p.dir + x.file; li.append(a); d.append(li); }
      row("Data", d);
    } else if (p.downloads) {
      row("Data", `${p.downloads.map((x) => x.label).join(", ")}. GeoJSON files ship with the published atlas.`);
    }
    row("Description", p.alt);
    const cite = el("div", "cite");
    const citeText = `${p.credit}. “${p.title}.” ${atlas.title}, plate ${p.plate}, ${fmtDate(p.added)}.`;
    const code = el("code", null, citeText);
    const btn = el("button", "btn", "Copy");
    btn.type = "button";
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(citeText).then(() => { btn.textContent = "Copied"; }, () => {
        const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); btn.textContent = "Selected";
      });
    });
    cite.append(code, btn);
    row("Cite this plate", cite);
    about.appendChild(dl);
    s.appendChild(about);

    const mt = document.getElementById("map-title");
    mt.replaceChildren(el("b", null, `${atlas.title} · Plate ${p.plate}`), document.createTextNode(p.title));
  }

  document.getElementById("colophon").textContent =
    `${atlas.base.attribution}.${useDetail ? " " + detail.attribution + "." : ""} Map by ${atlas.author}. Built with MapLibre GL JS.`;
  document.getElementById("home").addEventListener("click", () => state.active && frame(byId[state.active]));
  window.addEventListener("hashchange", () => { const id = location.hash.slice(1); if (byId[id] && id !== state.active) openPlate(id); });

  const first = byId[location.hash.slice(1)] ? location.hash.slice(1) : plates[plates.length - 1].id;
  openPlate(first, { move: false });
  const v = byId[first].view;
  map.jumpTo({ center: v.center, zoom: narrow() && v.mobile_zoom ? v.mobile_zoom : v.zoom });
  placeLabels();
})().catch((err) => {
  const s = document.getElementById("story");
  if (s) s.textContent = `The atlas could not load: ${err.message}`;
  console.error(err);
});
