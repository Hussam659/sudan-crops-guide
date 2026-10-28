import { withTerms, bindTerms } from "./glossary.js";
import { announce } from "./a11y.js";
import { badge } from "./sources.js";
// Value chain view: stage rail + stage panel + search. URL: &stage=1..10&item=<id>
const KIND_ICON = {
  product: '<circle cx="8" cy="8" r="5"/>',
  byproduct: '<path d="M8 2.5 13.5 8 8 13.5 2.5 8Z"/>',
  line: '<rect x="3" y="3" width="10" height="10" rx="1.5"/>',
  buyer: '<path d="M8 2.5 14 13H2Z"/>',
  price: '<path d="M8 1.5v13M11.5 4.5H6.3a2 2 0 0 0 0 4h3.4a2 2 0 0 1 0 4H4"/>',
  risk: '<path d="M8 2 14.5 13.5h-13Z"/><path d="M8 6.5v3M8 11.5v.01"/>',
  place: '<path d="M8 14s5-4.2 5-8A5 5 0 0 0 3 6c0 3.8 5 8 5 8Z"/><circle cx="8" cy="6" r="1.6"/>',
  step: '<circle cx="8" cy="8" r="2.5"/>',
  group: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
};
const kindIcon = k => `<svg class="kind-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${KIND_ICON[k] || KIND_ICON.step}</svg>`;

const stageTitle = s => s.name.replace(/^\d+\s*·\s*/, "");

// Index every node once per crop: id -> {node, stage index, path}
const indexCache = new WeakMap();
function indexCrop(crop) {
  if (indexCache.has(crop)) return indexCache.get(crop);
  const byId = {}, all = [];
  crop.tree.children.forEach((stage, si) => {
    const walk = (n, path, region) => {
      const r = n.r || region;
      const entry = { node: n, si, path, region: r };
      all.push(entry);
      if (n.id) byId[n.id] = entry;
      (n.children || []).forEach(c => walk(c, [...path, n.name], r));
    };
    (stage.children || []).forEach(c => walk(c, [], stage.r));
  });
  const res = { byId, all };
  indexCache.set(crop, res);
  return res;
}

export function renderChain(main, crop, s, ctx) {
  const { t, esc, lang, signal } = ctx;
  const { byId, all } = indexCrop(crop);
  const stages = crop.tree.children;
  let si = Math.min(Math.max((s.stage || 1) - 1, 0), stages.length - 1);
  if (s.item && byId[s.item]) si = byId[s.item].si;
  let q = "";

  const txt = v => withTerms(esc(v));
  const regionName = r => r ? t("region." + r) : "";
  const stageVar = i => `var(--s${i % 10})`;

  main.innerHTML = `
    <header class="page-head chain-head" style="--accent: var(${crop.accent})">
      <a class="eyebrow" data-nav href="${ctx.href({})}">${t("crop.home")}</a>
      <h1>${esc(lang() === "ar" ? crop.ar : crop.name)}<span>${t("nav.chain")}</span></h1>
      <p class="lede" dir="auto">${txt(crop.summary)}</p>
    </header>
    <div class="chain-search">
      <label class="visually-hidden" for="chainQ">${t("chain.search")}</label>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
      <input id="chainQ" type="search" placeholder="${t("chain.searchPlaceholder")}" autocomplete="off">
    </div>
    <nav class="rail" aria-label="${t("chain.stages")}">
      <ol>${stages.map((st, i) => `
        <li><button type="button" class="rail-step" data-stage="${i}" style="--sc: ${stageVar(i)}">
          <span class="rail-num num">${i + 1}</span>
          <span class="rail-text"><span class="rail-title" dir="auto">${esc(stageTitle(st))}</span>
          <span class="rail-when" dir="auto">${esc(st.w || "")}</span></span>
        </button></li>`).join("")}
      </ol>
      <button type="button" class="rail-scroll rail-scroll-l" tabindex="-1" aria-hidden="true">‹</button>
      <button type="button" class="rail-scroll rail-scroll-r" tabindex="-1" aria-hidden="true">›</button>
    </nav>
    <section id="stagePanel" class="stage-panel"></section>`;
  bindTerms(main, esc, signal);

  const panel = main.querySelector("#stagePanel");
  const rail = main.querySelector(".rail");
  const input = main.querySelector("#chainQ");

  // Mouse helpers for the sideways-scrolling rail (keyboard uses arrow keys). Fades show there is more.
  const ol = rail.querySelector("ol");
  const railEdges = () => {
    const max = ol.scrollWidth - ol.clientWidth, x = Math.abs(ol.scrollLeft); // scrollLeft is negative in RTL
    const start = x > 4, end = x < max - 4, rtl = document.documentElement.dir === "rtl";
    rail.classList.toggle("more-l", rtl ? end : start);
    rail.classList.toggle("more-r", rtl ? start : end);
  };
  ol.addEventListener("scroll", railEdges, { passive: true, signal });
  addEventListener("resize", railEdges, { signal });
  rail.querySelector(".rail-scroll-l").addEventListener("click", () => ol.scrollBy({ left: -ol.clientWidth * 0.7, behavior: "smooth" }), { signal });
  rail.querySelector(".rail-scroll-r").addEventListener("click", () => ol.scrollBy({ left: ol.clientWidth * 0.7, behavior: "smooth" }), { signal });

  function related(n) {
    const links = (n.ln || []).map(id => byId[id]).filter(Boolean);
    if (!links.length) return "";
    return `<div class="related"><span class="related-label">${t("chain.related")}</span>${links.map(e =>
      `<button type="button" class="chip chip-link" data-goto="${e.node.id}" style="--sc: ${stageVar(e.si)}"><span class="num">${e.si + 1}</span> <span dir="auto">${esc(e.node.name)}</span></button>`).join("")}</div>`;
  }

  function meta(n, region, parentRegion) {
    const bits = [];
    if (n.w) bits.push(`<span class="chip" dir="auto">${esc(n.w)}</span>`);
    if (n.f) bits.push(`<span class="chip" dir="auto">${esc(n.f)}</span>`);
    if (region && region !== parentRegion) bits.push(`<span class="chip chip-region">${esc(regionName(region))}</span>`);
    if (n.m) bits.push(`<span class="chip chip-money" dir="auto">${esc(n.m)}</span>`);
    if (n.src) bits.push(badge(n.src, t, esc));
    return bits.length ? `<div class="meta">${bits.join("")}</div>` : "";
  }

  function item(n, region, parentRegion, h = 4) { // h3 for loose items, h4 inside a group card
    const k = n.k || "step";
    return `<li class="item kind-${k}" ${n.id ? `id="item-${n.id}"` : ""}>
      <span class="item-icon" title="${t("kind." + k)}">${kindIcon(k)}<span class="visually-hidden">${t("kind." + k)}</span></span>
      <div class="item-body">
        <h${h} dir="auto">${esc(n.name)}</h${h}>
        ${meta(n, region, parentRegion)}
        ${n.t ? `<p dir="auto">${txt(n.t)}</p>` : ""}
        ${related(n)}
      </div></li>`;
  }

  // Consecutive leaf items share one card; items with children get their own card.
  function blocks(kids, stageRegion) {
    const out = []; let loose = [];
    const flush = () => { if (loose.length) out.push(`<ul class="card items loose">${loose.join("")}</ul>`); loose = []; };
    kids.forEach(c => c.children ? (flush(), out.push(block(c, stageRegion))) : loose.push(item(c, c.r || stageRegion, stageRegion, 3)));
    flush();
    return out.join("");
  }

  function block(n, stageRegion) {
    const region = n.r || stageRegion;
    const k = n.k || "group";
    return `<article class="card group kind-${k}" ${n.id ? `id="item-${n.id}"` : ""}>
      <header class="group-head">
        <span class="item-icon">${kindIcon(k)}</span>
        <div>
          ${k === "line" ? `<p class="eyebrow">${t("kind.line")}</p>` : ""}
          <h3 dir="auto">${esc(n.name)}</h3>
          ${meta(n, region, stageRegion)}
          ${n.t ? `<p class="group-text" dir="auto">${txt(n.t)}</p>` : ""}
          ${related(n)}
        </div>
      </header>
      <ul class="items">${n.children.map(c => item(c, c.r || region, region)).join("")}</ul>
    </article>`;
  }

  function showStage(i, { focus = false, item: itemId = null, push = true } = {}) {
    si = i;
    const st = stages[i];
    rail.querySelectorAll(".rail-step").forEach((b, j) => {
      b.toggleAttribute("aria-current", j === i);
      b.tabIndex = j === i ? 0 : -1; // roving tabindex: one tab stop, arrows move
      if (j === i) b.setAttribute("aria-current", "step");
      b.classList.toggle("done", j < i);
    });
    const cur = rail.querySelector(`[data-stage="${i}"]`);
    cur.scrollIntoView({ block: "nearest", inline: "center", behavior: push && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });

    panel.style.setProperty("--sc", stageVar(i));
    panel.classList.remove("enter"); void panel.offsetWidth; panel.classList.add("enter"); // replay fade-in
    panel.innerHTML = `
      <header class="stage-head">
        <p class="eyebrow">${t("chain.stageOf", { n: i + 1, total: stages.length })}</p>
        <h2 tabindex="-1" dir="auto">${esc(stageTitle(st))}</h2>
        ${meta(st, st.r, null)}
        ${st.t ? `<p class="stage-text" dir="auto">${txt(st.t)}</p>` : ""}
      </header>
      <div class="stage-body">${blocks(st.children || [], st.r)}</div>
      ${i === 7 || i === 9 ? `<a class="card see-small" data-nav href="${ctx.href({ crop: crop.id, view: "small" })}"><strong>${t(i === 7 ? "chain.seeBuyers" : "chain.seeCompetitors")}</strong><span>${t("chain.seeSmall")}</span></a>` : ""}
      <nav class="stage-nav" aria-label="${t("chain.stages")}">
        ${i > 0 ? `<button type="button" class="btn" data-stage="${i - 1}"><span aria-hidden="true" class="arrow-back"></span>${t("chain.prev")}: <span dir="auto">${esc(stageTitle(stages[i - 1]))}</span></button>` : "<span></span>"}
        ${i < stages.length - 1 ? `<button type="button" class="btn btn-primary" data-stage="${i + 1}">${t("chain.next")}: <span dir="auto">${esc(stageTitle(stages[i + 1]))}</span><span aria-hidden="true" class="arrow-fwd"></span></button>` : ""}
      </nav>`;

    if (push && !focus && !itemId) announce(`${t("chain.stageOf", { n: i + 1, total: stages.length })}: ${stageTitle(st)}`);
    if (push) {
      const p = new URLSearchParams(location.search);
      p.set("stage", i + 1);
      itemId ? p.set("item", itemId) : p.delete("item");
      history.pushState(null, "", "?" + p);
    }
    if (itemId) {
      const el = panel.querySelector("#item-" + CSS.escape(itemId));
      if (el) { el.classList.add("flash"); el.scrollIntoView({ block: "center" }); el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true }); }
    } else if (focus) {
      panel.querySelector("h2").focus({ preventScroll: true });
      panel.scrollIntoView({ block: "start" });
    }
  }

  function showResults() {
    const needle = q.toLowerCase();
    const hits = all.filter(e => [e.node.name, e.node.t, e.node.f, e.node.m].some(v => v && v.toLowerCase().includes(needle)));
    announce(hits.length ? t("chain.results", { n: hits.length }) : t("chain.noResults"));
    rail.querySelectorAll(".rail-step").forEach(b => b.removeAttribute("aria-current"));
    panel.style.removeProperty("--sc");
    panel.classList.remove("enter"); void panel.offsetWidth; panel.classList.add("enter"); // replay fade-in
    panel.innerHTML = `
      <header class="stage-head"><h2 tabindex="-1">${t("chain.results", { n: hits.length })}</h2></header>
      ${hits.length ? `<ul class="results">${hits.map(e => `
        <li><button type="button" class="result" data-goto="${e.node.id || ""}" data-stage="${e.si}" style="--sc: ${stageVar(e.si)}">
          <span class="rail-num num">${e.si + 1}</span>
          <span><strong dir="auto">${esc(e.node.name)}</strong>
          <span class="result-path" dir="auto">${esc([stageTitle(stages[e.si]), ...e.path].join(" › "))}</span></span>
        </button></li>`).join("")}</ul>` : `<p class="notice">${t("chain.noResults")}</p>`}`;
  }

  // ---------- events ----------
  main.addEventListener("click", e => {
    const goto = e.target.closest("[data-goto]");
    if (goto && goto.dataset.goto && byId[goto.dataset.goto]) {
      clearSearch();
      return showStage(byId[goto.dataset.goto].si, { item: goto.dataset.goto });
    }
    const st = e.target.closest("[data-stage]");
    if (st) { clearSearch(); showStage(+st.dataset.stage, { focus: !st.classList.contains("rail-step") }); }
  }, { signal });

  // Arrow keys move along the rail.
  rail.addEventListener("keydown", e => {
    const b = e.target.closest(".rail-step"); if (!b) return;
    const rtl = document.documentElement.dir === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, Home: -99, End: 99 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const n = Math.min(Math.max(+b.dataset.stage + step, 0), stages.length - 1);
    rail.querySelector(`[data-stage="${n}"]`).focus();
    showStage(n);
  });

  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { q = input.value.trim(); q.length > 1 ? showResults() : showStage(si, { push: false }); }, 150);
  });
  function clearSearch() { if (q) { q = ""; input.value = ""; } }

  showStage(si, { item: s.item && byId[s.item] ? s.item : null, push: false });
  requestAnimationFrame(railEdges);
}
