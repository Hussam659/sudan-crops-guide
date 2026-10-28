// Factory planner: pick raw material, product, size, shifts -> results first, then machines.
// URL: &view=plan&route=<index>&cap=1.5&sh=2
import { withTerms, bindTerms } from "./glossary.js";
import { announce } from "./a11y.js";
import { badge } from "./sources.js";

const CAPS = [0.5, 1, 1.5, 2, 3], SHIFTS = [1, 2, 3];
let DATA = null;
const load = () => DATA ??= fetch("data/planner.json").then(r => r.json());

// Same formulas as the reference site, so the numbers match.
// Station cost `c` is in $ thousands. 300 days/year at 70% of full speed.
export function calc(route, D, cap, sh) {
  const rawYear = cap * sh * 8 * 300 * 0.7, outYear = rawYear * route.y, storeF = rawYear / 3360;
  const sts = route.s.map((id, i) => {
    const b = D.stations[id];
    return { id, i, b, area: b.store ? b.a * Math.max(0.4, storeF) : b.a * cap ** 0.7, kw: b.kw * cap ** 0.9, op: b.op * Math.max(1, cap) ** 0.5, cost: b.c * cap ** 0.65 };
  });
  const needs = { lab: 1, air: 1, hyg: sts.some(s => s.b.z === "clean"), boiler: sts.some(s => s.b.st), water: sts.some(s => s.b.wet) };
  const sup = Object.keys(needs).filter(k => needs[k]).map(k => {
    const b = D.support[k];
    return { id: k, b, area: b.a * cap ** 0.5, kw: b.kw * cap ** 0.7, op: b.op, cost: b.c * cap ** 0.5 };
  });
  const all = sts.concat(sup), sum = f => all.reduce((a, s) => a + s[f], 0);
  const equip = sum("cost"), marginYear = [route.m[0] * outYear, route.m[1] * outYear];
  // Payback in years: installed machines (equipment range × 1.35) ÷ yearly margin. Best case pairs low cost with high margin.
  const installed = [equip * 0.75 * 1.35 * 1000, equip * 1.4 * 1.35 * 1000];
  return {
    rawYear, outYear, sts, sup, boiler: needs.boiler,
    area: sum("area") * 1.4 + 80, kw: sum("kw"), staff: Math.ceil(sum("op")), equip,
    marginYear, payback: [installed[0] / marginYear[1], installed[1] / marginYear[0]],
  };
}

export async function renderPlan(main, crop, s, ctx) {
  const { t, esc, lang, href, signal, crops } = ctx;
  const D = await load();
  const raws = D.raws.filter(r => r.crop === crop.name);
  const p = s.p;
  let routeIdx = +p.get("route");
  if (!(D.routes[routeIdx] && raws.some(r => r.id === D.routes[routeIdx].raw))) routeIdx = D.routes.findIndex(r => r.raw === raws[0].id);
  let cap = CAPS.includes(+p.get("cap")) ? +p.get("cap") : 1.5;
  let sh = SHIFTS.includes(+p.get("sh")) ? +p.get("sh") : 2;

  // Western digits in both languages: standard in Gulf/Sudan trade documents.
  const n = v => Math.round(v).toLocaleString("en-US");
  const money = k => k >= 1000 ? "$" + (k / 1000).toFixed(k >= 10000 ? 0 : 1) + "m" : "$" + Math.round(k) + "k"; // input in $k
  const txt = v => withTerms(esc(v));
  // Number isolated as LTR so the unit word sits on the correct side in Arabic.
  const years = ([a, b]) => { const m = b < 1; const range = m ? `${Math.max(1, Math.round(a * 12))}–${Math.round(b * 12)}` : `${a.toFixed(1)}–${b.toFixed(1)}`;
    return t(m ? "plan.months" : "plan.years", { a: `<bdi class="num">${range}</bdi>` }); };
  const zone = Object.fromEntries(D.zones.map(([id, label, , color]) => [id, { label, color }]));
  const byCrop = Object.fromEntries(crops.map(c => [c.id, c]));

  main.innerHTML = `
    <header class="page-head" style="--accent: var(${crop.accent})">
      <a class="eyebrow" data-nav href="${href({})}">${t("crop.home")}</a>
      <h1>${esc(lang() === "ar" ? crop.ar : crop.name)}<span>${t("nav.plan")}</span></h1>
      <p class="lede">${t("plan.lede")}</p>
    </header>
    <div class="plan">
      <form class="card plan-form" id="planForm">
        <label class="field"><span>${t("plan.raw")}</span>
          <select name="raw">${raws.map(r => `<option value="${r.id}" dir="auto">${esc(r.name)}</option>`).join("")}</select>
          <small class="hint" id="rawNote" dir="auto"></small></label>
        <label class="field"><span>${t("plan.product")}</span><select name="route"></select></label>
        <fieldset class="field"><legend>${t("plan.cap")}</legend>
          <div class="seg">${CAPS.map(c => `<label><input type="radio" name="cap" value="${c}"><span class="num">${c}</span></label>`).join("")}</div>
          <small class="hint">${t("plan.capUnit")}</small></fieldset>
        <fieldset class="field"><legend>${t("plan.shifts")}</legend>
          <div class="seg">${SHIFTS.map(c => `<label><input type="radio" name="sh" value="${c}"><span>${t("plan.shiftN", { n: c })}</span></label>`).join("")}</div></fieldset>
        <p class="hint">${t("plan.assume")}</p>
      </form>
      <div id="planOut" class="plan-out"></div>
    </div>`;
  bindTerms(main, esc, signal);

  const form = main.querySelector("#planForm"), out = main.querySelector("#planOut");
  const fillRoutes = () => {
    const raw = form.raw.value;
    form.route.innerHTML = D.routes.map((r, i) => r.raw === raw ? `<option value="${i}" dir="auto">${esc(r.p)}</option>` : "").join("");
    main.querySelector("#rawNote").innerHTML = txt(raws.find(r => r.id === raw).note);
  };
  form.raw.value = D.routes[routeIdx].raw; fillRoutes();
  form.route.value = routeIdx; form.cap.value = cap; form.sh.value = sh;

  form.addEventListener("change", e => {
    if (e.target.name === "raw") { fillRoutes(); }
    routeIdx = +form.route.value; cap = +form.cap.value; sh = +form.sh.value;
    const q = new URLSearchParams(location.search);
    q.set("route", routeIdx); q.set("cap", cap); q.set("sh", sh);
    history.replaceState(null, "", "?" + q);
    draw();
    announce([...out.querySelectorAll(".kpi-hero")].map(k => k.querySelector(".kpi-label").textContent + ": " + k.querySelector(".kpi-value").textContent).join(". "));
  }, { signal });

  function draw() {
    const R = D.routes[routeIdx], r = calc(R, D, cap, sh);
    const lineCrop = R.map && byCrop[{ ses: "sesame", gum: "gum", bao: "baobab", hib: "hibiscus" }[R.map.split("-")[0]]];
    const kpi = (label, value, sub, cls = "") => `<div class="kpi ${cls}"><span class="kpi-label">${label}</span><span class="kpi-value num">${value}</span>${sub ? `<span class="kpi-sub">${sub}</span>` : ""}</div>`;
    const stationCard = (st, num) => {
      const z = zone[st.b.z] || { label: t("plan.support"), color: "var(--muted)" };
      const bps = (R.bp || []).filter(b => b.from === st.id);
      return `<li class="station" style="--zc:${z.color}">
        <span class="station-num num">${num}</span>
        <div class="station-body">
          <h5 dir="auto">${esc(st.b.n)}</h5>
          <p dir="auto">${txt(st.b.d)}</p>
          <div class="meta">
            <span class="chip num">${n(st.area)} m²</span><span class="chip num">${n(st.kw)} kW</span><span class="chip num">${money(st.cost)}</span></div>
          ${bps.map(b => `<p class="bp-tag" dir="auto">↳ ${esc(b.n)}: ${esc(b.use)}</p>`).join("")}
        </div></li>`;
    };
    // Consecutive stations in the same hygiene zone are shown together, in flow order.
    const zoneGroups = r.sts.reduce((g, st) => { const last = g[g.length - 1]; last && last.z === st.b.z ? last.list.push(st) : g.push({ z: st.b.z, list: [st] }); return g; }, []);
    out.innerHTML = `
      <section class="plan-summary">
        <p class="eyebrow" dir="auto">${esc(D.raws.find(x => x.id === R.raw).name)} →</p>
        <h2 dir="auto">${esc(R.p)}</h2>
        <p class="plan-why" dir="auto">${txt(R.why + (R.add ? " " + R.add + "." : ""))}</p>
        <div class="plan-actions">
          <span class="chip"><span class="num">${cap} t/h</span> · ${t("plan.shiftN", { n: sh })}</span>
          <button type="button" class="btn" id="printBtn">${t("plan.print")}</button>
        </div>
      </section>
      <div class="kpis">
        ${kpi(t("plan.k.marginYear"), `${money(r.marginYear[0] / 1000)}–${money(r.marginYear[1] / 1000)}`, t("plan.k.marginYearSub"), "kpi-hero")}
        ${kpi(t("plan.k.equip"), `${money(r.equip * 0.75)}–${money(r.equip * 1.4)}`, t("plan.k.equipSub"), "kpi-hero")}
        ${kpi(t("plan.k.payback"), years(r.payback), t("plan.k.paybackSub"), "kpi-hero kpi-payback")}
        ${kpi(t("plan.k.marginT"), `$${n(R.m[0])}–${n(R.m[1])}`, t("plan.k.marginTSub"))}
        ${kpi(t("plan.k.out"), `${n(r.outYear)} t`, R.y >= 1 ? t("plan.k.yieldAdd", { y: R.y.toFixed(2) }) : t("plan.k.yield", { y: Math.round(R.y * 100) }))}
        ${kpi(t("plan.k.raw"), `${n(r.rawYear)} t`, `${cap} t/h × ${sh * 8} h × 300 × 70%`)}
        ${kpi(t("plan.k.area"), `≈ ${n(r.area)} m²`, "")}
        ${kpi(t("plan.k.power"), `≈ ${n(r.kw)} kW`, r.boiler ? t("plan.k.boiler") : "")}
        ${kpi(t("plan.k.staff"), `≈ ${n(r.staff)}`, t("plan.k.staffSub"))}
      </div>
      <p class="notice price-note"><strong>${t("plan.price")}:</strong> <span dir="auto">${esc(R.price)}</span> ${badge(R.src || "estimate", t, esc)}</p>

      <section class="card plan-sec">
        <h3>${t("plan.machines")}</h3>
        <p class="sub">${t("plan.machinesSub", { n: r.sts.length, cap })}</p>
        ${zoneGroups.map(g => { const z = zone[g.z]; const first = r.sts.indexOf(g.list[0]) + 1; return `
          <div class="zone-group" style="--zc:${z.color}">
            <h4 class="zone-title" dir="auto">${esc(z.label)}</h4>
            <ol class="stations" start="${first}">${g.list.map((st, i) => stationCard(st, first + i)).join("")}</ol>
          </div>`; }).join("")}
        <h4 class="support-title">${t("plan.support")}</h4>
        <ul class="stations support">${r.sup.map(st => stationCard(st, "+")).join("")}</ul>
      </section>

      ${(R.bp || []).length ? `<section class="card plan-sec">
        <h3>${t("plan.byproducts")}</h3>
        <ul class="bp-list">${R.bp.map(b => `<li><div><strong dir="auto">${esc(b.n)}</strong><span class="sub" dir="auto">${esc(D.stations[b.from]?.n || "—")}</span></div>
          <span class="num">${n(b.pct * r.rawYear)} t/${t("plan.year")}</span><p dir="auto">${txt(b.use)}</p></li>`).join("")}</ul>
      </section>` : ""}

      <section class="card plan-sec">
        <h3>${t("plan.certs")}</h3>
        <div class="meta">${(R.cert || []).map(c => `<span class="chip">${txt(c)}</span>`).join("")}</div>
        <p class="sub">${lang() === "ar" ? t("plan.before") : txt(t("plan.before"))}</p>
        ${lineCrop ? `<a class="btn" data-nav href="${href({ crop: lineCrop.id, view: "chain", item: R.map })}">${t("plan.onChain")}</a>` : ""}
      </section>`;
  }
  out.addEventListener("click", e => { if (e.target.closest("#printBtn")) print(); }, { signal });
  draw();
}
