// "Start small" view: the smallest sensible factory for a crop, real companies to learn from,
// Saudi buyers to approach first and who you'd compete with. URL: &view=small
import { calc } from "./plan.js";
import { badge, getSources } from "./sources.js";

let DATA = null;
const load = () => DATA ??= Promise.all(["planner", "examples"].map(f => fetch(`data/${f}.json`).then(r => r.json())));

// Smallest factory: 0.5 t/hour, one shift. Pick the checked route with the lowest investment, plus one "next step".
export function smallPlan(crop, P, srcs) {
  const raws = new Set(P.raws.filter(r => r.crop === crop.name).map(r => r.id));
  const runs = P.routes.map((R, idx) => ({ R, idx })).filter(x => raws.has(x.R.raw)).map(x => ({ ...x, r: calc(x.R, P, 0.5, 1) }));
  const checked = runs.filter(x => srcs[x.R.src] && srcs[x.R.src].conf !== "low");
  const pool = checked.length ? checked : runs;
  const byCost = [...pool].sort((a, b) => a.r.equip - b.r.equip);
  const first = byCost[0];
  const next = byCost.find(x => x !== first && x.r.marginYear[0] > first.r.marginYear[1]) || byCost[1];
  return { first, next, checkedOnly: checked.length > 0 };
}

export async function renderSmall(main, crop, s, ctx) {
  const { t, esc, lang, href } = ctx;
  const [P, X] = await load();
  const L = lang();
  const tr = o => o?.[L] ?? o?.en ?? "";
  const money = k => k >= 1000 ? "$" + (k / 1000).toFixed(k >= 10000 ? 0 : 1) + "m" : "$" + Math.round(k) + "k"; // $k in
  const n = v => Math.round(v).toLocaleString("en-US");
  const yrs = ([a, b]) => `<bdi class="num">${a.toFixed(1)}–${b.toFixed(1)}</bdi>`;
  const ex = X.crops[crop.id] || {};
  const { first, next } = smallPlan(crop, P, getSources());

  const lineCard = (x, label) => x ? `
    <article class="card small-line">
      <p class="eyebrow">${t(label)}</p>
      <h3 dir="auto">${esc(x.R.p)}</h3>
      <dl class="small-kpis">
        <div><dt>${t("plan.k.equip")}</dt><dd class="num">${money(x.r.equip * 0.75)}–${money(x.r.equip * 1.4)}</dd></div>
        <div><dt>${t("plan.k.marginYear")}</dt><dd class="num">${money(x.r.marginYear[0] / 1000)}–${money(x.r.marginYear[1] / 1000)}</dd></div>
        <div><dt>${t("plan.k.payback")}</dt><dd>${t("plan.years", { a: yrs(x.r.payback) })}</dd></div>
        <div><dt>${t("plan.k.area")}</dt><dd class="num">≈ ${n(x.r.area)} m²</dd></div>
        <div><dt>${t("plan.k.staff")}</dt><dd class="num">≈ ${n(x.r.staff)}</dd></div>
        <div><dt>${t("plan.k.out")}</dt><dd class="num">${n(x.r.outYear)} t</dd></div>
      </dl>
      ${badge(x.R.src || "estimate", t, esc, true)}
      <a class="btn" data-nav href="${href({ crop: crop.id, view: "plan" })}&route=${x.idx}&cap=0.5&sh=1">${t("small.openPlan")}</a>
    </article>` : "";

  const company = c => `
    <li class="company">
      <div class="company-head">
        <strong dir="auto">${c.url ? `<a href="${c.url}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}</strong>
        <span class="chip">${esc(c.where)}</span>
        <span class="src src-${c.conf}" title="${t("src." + c.conf)}">${t("src." + c.conf)}</span>
      </div>
      <p dir="auto">${esc(tr(c.what))}</p>
      ${c.lesson ? `<p class="lesson" dir="auto"><strong>${t("small.lesson")}:</strong> ${esc(tr(c.lesson))}</p>` : ""}
    </li>`;
  const list = (items, empty) => items?.length ? `<ul class="card company-list">${items.map(company).join("")}</ul>` : `<p class="notice">${t(empty)}</p>`;

  main.innerHTML = `
    <header class="page-head" style="--accent: var(${crop.accent})">
      <a class="eyebrow" data-nav href="${href({})}">${t("crop.home")}</a>
      <h1>${esc(L === "ar" ? crop.ar : crop.name)}<span>${t("nav.small")}</span></h1>
      <p class="lede">${t("small.lede")}</p>
    </header>

    <section class="small-sec">
      <h2>${t("small.lines")}</h2>
      <p class="sub">${t("small.linesSub")}</p>
      <div class="small-lines">${lineCard(first, "small.first")}${lineCard(next, "small.next")}</div>
    </section>

    ${ex.steps ? `<section class="small-sec">
      <h2>${t("small.steps")}</h2>
      <ol class="card small-steps">${ex.steps.map(st => `<li dir="auto">${esc(tr(st))}</li>`).join("")}</ol>
    </section>` : ""}

    <section class="small-sec">
      <h2>${t("small.buyers")}</h2>
      <p class="sub">${t("small.buyersSub")}</p>
      ${list(ex.buyers, "small.none")}
    </section>

    <section class="small-sec">
      <h2>${t("small.competitors")}</h2>
      ${list(ex.competitors, "small.none")}
    </section>

    <section class="small-sec">
      <h2>${t("small.examples")}</h2>
      <p class="sub">${t("small.examplesSub")}</p>
      ${list(ex.examples, "small.none")}
    </section>

    ${ex.equipment?.length ? `<section class="small-sec">
      <h2>${t("small.equipment")}</h2>
      ${list(ex.equipment, "small.none")}
    </section>` : ""}
    <p class="hint">${t("small.note")}</p>`;
}
