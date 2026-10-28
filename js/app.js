// App shell: routing via URL params, language, theme, home and crop pages.
// URL: ?crop=sesame&view=chain|plan|markets&lang=ar (+ view-specific params, e.g. &stage=3&item=id)
import { renderChain } from "./chain.js";
import { renderPlan } from "./plan.js";
import { renderMarkets } from "./markets.js";
import { renderSmall } from "./small.js";
import { renderCompare } from "./compare.js";
import { setupGlossary } from "./glossary.js";
import { markLang, announce } from "./a11y.js";
import { setSources, badge, getSources } from "./sources.js";

const root = document.documentElement;
const main = document.getElementById("main");
new MutationObserver(() => markLang(main)).observe(main, { childList: true, subtree: true });
const tabs = document.getElementById("tabs");
const langBtn = document.getElementById("langBtn");
const themeBtn = document.getElementById("themeBtn");
const cmpBtn = document.getElementById("cmpBtn");
const shareBtn = document.getElementById("shareBtn");
const backTop = document.getElementById("backTop");

// Copy the current view's link (it holds crop, stage, filters and language). Phones get the native share sheet.
shareBtn.addEventListener("click", async () => {
  const url = location.href;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: document.title, url });
    else { await navigator.clipboard.writeText(url); announce(t("share.copied")); shareBtn.classList.add("done"); setTimeout(() => shareBtn.classList.remove("done"), 1500); }
  } catch (e) { /* share sheet closed */ }
});
addEventListener("scroll", () => { backTop.hidden = scrollY < Math.max(600, innerHeight); }, { passive: true });
backTop.addEventListener("click", () => { scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); main.focus({ preventScroll: true }); });

const VIEWS = ["chain", "small", "plan", "markets"];
const ICON = {
  chain: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  plan: '<path d="M2 20V9l6 4V9l6 4V4h8v16Z"/><path d="M6 17h2M12 17h2M18 17h2"/>',
  markets: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  small: '<path d="M12 20v-8"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6Z"/><path d="M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
};
const icon = (k, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- i18n ----------
const strings = {};
const lang = () => root.lang === "ar" ? "ar" : "en";
const t = (k, vars) => (strings[lang()]?.[k] ?? strings.en?.[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars?.[v] ?? "");
async function loadStrings(l) {
  if (!strings[l]) strings[l] = await fetch(`i18n/${l}.json`).then(r => r.json());
}

// ---------- data ----------
let CROPS = [];
const loadJSON = f => fetch(`data/${f}.json`).then(r => { if (!r.ok) throw new Error(f); return r.json(); });

// ---------- state <-> URL ----------
function readState() {
  const p = new URLSearchParams(location.search);
  const crop = CROPS.find(c => c.id === p.get("crop")) ? p.get("crop") : null;
  const view = VIEWS.includes(p.get("view")) || ["compare", "sources"].includes(p.get("view")) ? p.get("view") : "chain";
  return { crop, view, stage: +p.get("stage") || 1, item: p.get("item"), p };
}
function href(s) {
  const p = new URLSearchParams();
  if (s.crop) p.set("crop", s.crop);
  if (["compare", "sources"].includes(s.view) || (s.crop && s.view && s.view !== "chain")) p.set("view", s.view);
  if (s.crop && s.view === "chain" && s.stage > 1) p.set("stage", s.stage);
  if (s.crop && s.view === "chain" && s.item) p.set("item", s.item);
  if (lang() === "ar") p.set("lang", "ar");
  const q = p.toString();
  return q ? `?${q}` : location.pathname;
}
function go(url) { history.pushState(null, "", url); render(); main.focus({ preventScroll: true }); scrollTo(0, 0); }
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-nav]");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  e.preventDefault(); go(a.getAttribute("href"));
});
addEventListener("popstate", render);

// ---------- toggles ----------
async function setLang(l) {
  await loadStrings(l);
  root.lang = l; root.dir = l === "ar" ? "rtl" : "ltr";
  try { localStorage.setItem("lang", l); } catch (e) {}
  const q = new URLSearchParams(location.search);
  l === "ar" ? q.set("lang", "ar") : q.delete("lang");
  history.replaceState(null, "", q.size ? "?" + q : location.pathname);
  render();
}
langBtn.addEventListener("click", () => setLang(lang() === "ar" ? "en" : "ar"));

const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
themeBtn.addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  renderChrome();
});

// ---------- render ----------
const cropName = c => lang() === "ar" ? c.ar : c.name;
const cropAlt = c => lang() === "ar" ? c.name : c.ar;

function renderChrome() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  langBtn.textContent = t("lang.switch");
  langBtn.lang = lang() === "ar" ? "en" : "ar";
  langBtn.setAttribute("aria-label", t("lang.switchLabel"));
  themeBtn.innerHTML = icon(isDark() ? "sun" : "moon");
  themeBtn.setAttribute("aria-label", t(isDark() ? "theme.toLight" : "theme.toDark"));
  document.querySelector(".brand").setAttribute("href", href({}));
  cmpBtn.setAttribute("href", href({ view: "compare" }));
  cmpBtn.querySelector("span").textContent = t("cmp.short");
  cmpBtn.setAttribute("aria-label", t("cmp.title"));
  shareBtn.setAttribute("aria-label", t("share.label")); shareBtn.title = t("share.label");
  backTop.setAttribute("aria-label", t("share.top"));
  document.getElementById("footer").innerHTML = `<p><strong>${t("foot.checked")}</strong> · <a data-nav href="${href({ view: "sources" })}">${t("foot.sources")}</a></p><p>${t("foot.disclaimer")}</p>`;
}

function renderTabs(s) {
  tabs.hidden = !s.crop;
  document.body.classList.toggle("has-tabs", !!s.crop);
  if (!s.crop) return;
  tabs.setAttribute("aria-label", cropName(CROPS.find(c => c.id === s.crop)));
  tabs.innerHTML = VIEWS.map(v => `<a class="tab" data-nav href="${href({ ...s, view: v })}"${v === s.view ? ' aria-current="page"' : ""}>${icon(v)}<span>${t("nav." + v)}</span></a>`).join("");
}

const SKELETON = document.querySelector(".skeleton").outerHTML;

function renderSources() {
  document.title = `${t("foot.sources")} · ${t("app.name")}`;
  const S = getSources();
  const groups = ["high", "med", "low"].map(c => [c, Object.entries(S).filter(([k, v]) => !k.startsWith("_") && v.conf === c)]);
  main.innerHTML = `
    <header class="page-head">
      <a class="eyebrow" data-nav href="${href({})}">${t("crop.home")}</a>
      <h1>${t("foot.sources")}</h1>
      <p class="lede">${t("srcpage.lede")}</p>
    </header>
    ${groups.map(([c, list]) => `
      <section class="src-group">
        <h2 class="src-h src-${c}">${t("srcpage." + c)}</h2>
        <ul class="card src-list">${list.map(([, v]) => `
          <li><span lang="en">${v.url ? `<a href="${v.url}" target="_blank" rel="noopener">${esc(v.label)}</a>` : esc(v.label)}</span>
            <span class="sub">${esc(v.date || "")}</span></li>`).join("")}</ul>
      </section>`).join("")}`;
}

function renderHome() {
  document.title = t("app.name");
  main.innerHTML = `
    <section class="hero">
      <p class="eyebrow">${t("home.eyebrow")}</p>
      <h1>${t("home.title")}</h1>
      <p class="lede">${t("home.lede")}</p>
      <div><a class="btn btn-primary" data-nav href="${href({ view: "compare" })}">${t("home.compare")}</a></div>
    </section>
    <section class="facts-strip" aria-label="${t("facts.title")}">
      ${[["48%", "facts.saudiShare", "wits23s"], ["289,000 t", "facts.sesameExp", "cbos25"], ["62,500 t", "facts.gumExp", "cbos25"], ["28.6%", "facts.halwani", "halwani25"]].map(([v, k, src]) => `
        <div class="fact"><span class="fact-value num">${v}</span><span class="fact-label">${t(k)}</span>${badge(src, t, esc, true)}</div>`).join("")}
    </section>
    <div class="crop-grid">
      ${CROPS.map(c => `
        <a class="card crop-card" data-nav href="${href({ crop: c.id })}" style="--accent: var(${c.accent})">
          <h2>${esc(cropName(c))} <span class="alt" lang="${lang() === "ar" ? "en" : "ar"}">${esc(cropAlt(c))}</span></h2>
          <p lang="en" dir="auto">${esc(c.summary)}</p>
          <span class="chip">${t("home.stages", { n: c.tree.children.length })}</span>
          <span class="go">${t("home.explore")}</span>
        </a>`).join("")}
    </div>
    <section class="route" aria-labelledby="routeTitle">
      <h2 id="routeTitle">${t("route.title")}</h2>
      <ol class="route-steps">
        ${["farm", "port", "sea", "factory", "buyers"].map((k, i) => `
          <li class="route-step"><span class="route-dot num">${i + 1}</span>
            <span class="route-text"><strong>${t("route." + k)}</strong><span>${t("route." + k + "Sub")}</span></span></li>`).join("")}
      </ol>
    </section>
    <section class="how" aria-label="${t("home.eyebrow")}">
      ${VIEWS.map(v => `
        <div class="card"><span class="how-icon">${icon(v)}</span>
          <h3>${t(`how.${v}.title`)}</h3><p>${t(`how.${v}.text`)}</p></div>`).join("")}
    </section>`;
}

let ac; // aborts the previous view's listeners on main/window
function renderCrop(s) {
  const c = CROPS.find(x => x.id === s.crop);
  document.title = `${cropName(c)} · ${t("nav." + s.view)} · ${t("app.name")}`;
  ac?.abort(); ac = new AbortController();
  const ctx = { t, esc, lang, href, signal: ac.signal, crops: CROPS };
  main.innerHTML = SKELETON; // replaced at once by the value chain, after data loads for the others
  if (s.view === "chain") return renderChain(main, c, s, ctx);
  if (s.view === "plan") return renderPlan(main, c, s, ctx);
  if (s.view === "small") return renderSmall(main, c, s, ctx);
  return renderMarkets(main, c, s, ctx);
}

function render() {
  const s = readState();
  renderChrome();
  renderTabs(s);
  if (s.view === "sources") {
    tabs.hidden = true; document.body.classList.remove("has-tabs"); ac?.abort();
    return renderSources();
  }
  if (s.view === "compare") {
    tabs.hidden = true; document.body.classList.remove("has-tabs");
    ac?.abort(); ac = new AbortController();
    main.innerHTML = SKELETON;
    document.title = `${t("cmp.title")} · ${t("app.name")}`;
    return renderCompare(main, s, { t, esc, lang, href, signal: ac.signal, crops: CROPS });
  }
  if (s.crop) return renderCrop(s);
  ac?.abort();
  renderHome();
}

// ---------- boot ----------
try {
  await Promise.all([loadStrings("en"), loadStrings(lang())]);
  let glossary, sources;
  [CROPS, glossary, sources] = await Promise.all([loadJSON("crops"), loadJSON("glossary"), loadJSON("sources")]);
  setupGlossary(glossary);
  setSources(sources);
  render();
} catch (e) {
  renderChrome();
  main.innerHTML = `<div class="card empty"><p>${t("error.load")}</p></div>`;
  console.error(e);
}
