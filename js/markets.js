// Markets view: product × region heatmap for one crop + buyer panel. URL: &view=markets&p=<product>&r=<region>&b=<buyer type>
import { withTerms, bindTerms } from "./glossary.js";
import { announce } from "./a11y.js";

let DATA = null;
const load = () => DATA ??= fetch("data/markets.json").then(r => r.json());

export async function renderMarkets(main, crop, s, ctx) {
  const { t, esc, lang, href, signal } = ctx;
  const M = await load();
  const regions = M.regions.map(([id]) => id);
  const rows = M.markets.filter(m => m.crop === crop.name);
  const products = [...new Set(rows.map(m => m.p))];
  const types = [...new Set(rows.map(m => m.b))];
  const txt = v => withTerms(esc(v));
  const levelName = l => t(["mk.l0", "mk.l1", "mk.l2", "mk.l3"][l]);

  let b = types.includes(s.p.get("b")) ? s.p.get("b") : "all";
  let sel = { p: s.p.get("p"), r: s.p.get("r") };

  main.innerHTML = `
    <header class="page-head" style="--accent: var(${crop.accent})">
      <a class="eyebrow" data-nav href="${href({})}">${t("crop.home")}</a>
      <h1>${esc(lang() === "ar" ? crop.ar : crop.name)}<span>${t("nav.markets")}</span></h1>
      <p class="lede">${t("mk.lede")}</p>
    </header>
    <div class="mk-filter">
      <label class="field"><span>${t("mk.type")}</span>
        <select id="mkType"><option value="all">${t("mk.allTypes")}</option>
          ${types.map(k => `<option value="${k}" dir="auto">${esc(M.buyerTypes[k].n)}</option>`).join("")}</select></label>
      <ul class="mk-legend" aria-label="${t("mk.legend")}">${[3, 2, 1, 0].map(l => `<li><span class="lv lv${l}"><span class="pips">${"<i></i>".repeat(l)}</span></span>${levelName(l)}</li>`).join("")}</ul>
    </div>
    <section class="card mk-grid-wrap"><div id="mkGrid"></div></section>
    <section id="mkPanel" class="mk-panel"></section>`;
  bindTerms(main, esc, signal);

  const grid = main.querySelector("#mkGrid"), panel = main.querySelector("#mkPanel"), typeSel = main.querySelector("#mkType");
  typeSel.value = b;

  const pass = m => b === "all" || m.b === b;
  const cellRows = (p, r) => rows.filter(m => m.p === p && m.r === r && pass(m));

  function setURL() {
    const q = new URLSearchParams(location.search);
    sel.p ? q.set("p", sel.p) : q.delete("p");
    sel.r ? q.set("r", sel.r) : q.delete("r");
    b !== "all" ? q.set("b", b) : q.delete("b");
    history.replaceState(null, "", "?" + q);
  }

  function drawGrid() {
    // Default to the strongest cell so the panel is never empty.
    if (!sel.p || !cellRows(sel.p, sel.r).length) {
      const best = rows.filter(pass).sort((x, y) => y.level - x.level)[0];
      sel = best ? { p: best.p, r: best.r } : { p: null, r: null };
    }
    grid.innerHTML = `
      <table class="mk-table">
        <caption class="visually-hidden">${t("mk.caption")}</caption>
        <thead><tr><th scope="col">${t("mk.product")}</th>${regions.map(r => `<th scope="col">${t("mregion." + r)}</th>`).join("")}</tr></thead>
        <tbody>${products.map(p => {
          const cells = regions.map(r => {
            const list = cellRows(p, r), lv = list.length ? Math.max(...list.map(m => m.level)) : 0;
            if (!lv) return `<td class="no-mk" data-r="${t("mregion." + r)}"><span class="lv lv0" title="${levelName(0)}"><span class="visually-hidden">${levelName(0)}</span></span></td>`;
            const on = sel.p === p && sel.r === r;
            return `<td data-r="${t("mregion." + r)}"><button type="button" class="lv lv${lv}${on ? " on" : ""}" data-p="${esc(p)}" data-r="${r}" aria-pressed="${on}"
              aria-label="${esc(p)}, ${t("mregion." + r)}: ${levelName(lv)}, ${t("mk.nTypes", { n: list.length })}">
              <span class="lv-region" aria-hidden="true">${t("mregion." + r)}</span><span class="pips" aria-hidden="true">${"<i></i>".repeat(lv)}</span></button></td>`;
          }).join("");
          return `<tr><th scope="row" dir="auto">${esc(p)}</th>${cells}</tr>`;
        }).join("")}</tbody>
      </table>`;
  }

  function drawPanel() {
    const list = sel.p ? cellRows(sel.p, sel.r).sort((x, y) => y.level - x.level) : [];
    if (!list.length) { panel.innerHTML = `<p class="notice">${t("mk.none")}</p>`; return; }
    panel.innerHTML = `
      <header class="mk-panel-head">
        <p class="eyebrow">${t("mregion." + sel.r)}</p>
        <h2 tabindex="-1"><span dir="auto">${esc(sel.p)}</span></h2>
        <p class="sub">${t("mk.panelSub", { n: list.length })}</p>
      </header>
      <div class="buyers">${list.map(m => {
        const bt = M.buyerTypes[m.b];
        return `<article class="card buyer">
          <header><h3 dir="auto">${esc(bt.n)}</h3><span class="lv-badge lv${m.level}">${levelName(m.level)}</span></header>
          <dl class="facts">
            <div><dt>${t("mk.where")}</dt><dd dir="auto">${esc(m.where)}</dd></div>
            <div><dt>${t("mk.form")}</dt><dd dir="auto">${esc(m.form)}</dd></div>
            <div><dt>${t("mk.examples")}</dt><dd dir="auto">${esc(m.ex)}</dd></div>
          </dl>
          ${m.note ? `<p class="buyer-note" dir="auto">${txt(m.note)}</p>` : ""}
          <details class="bt-more"><summary>${t("mk.howBuy")}</summary>
            <dl class="facts">
              <div><dt>${t("mk.nature")}</dt><dd dir="auto">${txt(bt.nature)}</dd></div>
              <div><dt>${t("mk.cares")}</dt><dd dir="auto">${txt(bt.cares)}</dd></div>
              ${bt.pay ? `<div><dt>${t("mk.pay")}</dt><dd dir="auto">${txt(bt.pay)}</dd></div>` : ""}
            </dl></details>
        </article>`;
      }).join("")}</div>`;
  }

  grid.addEventListener("click", e => {
    const c = e.target.closest("button[data-p]"); if (!c) return;
    sel = { p: c.dataset.p, r: c.dataset.r };
    drawGrid(); drawPanel(); setURL();
    announce(`${sel.p}, ${t("mregion." + sel.r)}: ${t("mk.nTypes", { n: cellRows(sel.p, sel.r).length })}`);
    grid.querySelector(`button[data-p="${CSS.escape(sel.p)}"][data-r="${sel.r}"]`)?.focus();
    if (panel.getBoundingClientRect().top > innerHeight - 120) panel.scrollIntoView({ block: "start", behavior: "smooth" });
  }, { signal });
  typeSel.addEventListener("change", () => { b = typeSel.value; drawGrid(); drawPanel(); setURL(); }, { signal });

  drawGrid(); drawPanel();
}
