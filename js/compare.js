// Compare 2–4 crops side by side. URL: ?view=compare&crops=sesame,gum
import { calc } from "./plan.js";
import { badge, getSources } from "./sources.js";
import { announce } from "./a11y.js";

let DATA = null;
const load = () => DATA ??= Promise.all(["planner", "markets", "compare"].map(f => fetch(`data/${f}.json`).then(r => r.json())));

// Numbers per crop, from the planner at a common size (1.5 t/hour, 2 shifts) so crops are comparable.
function metrics(crop, P, M) {
  const raws = new Set(P.raws.filter(r => r.crop === crop.name).map(r => r.id));
  const routes = P.routes.filter(r => raws.has(r.raw));
  const runs = routes.map(R => ({ R, r: calc(R, P, 1.5, 2) }));
  // Prefer lines whose margin has been checked; fall back to estimates only when a crop has none.
  const checked = runs.filter(x => getSources()[x.R.src]?.conf && getSources()[x.R.src].conf !== "low");
  const pool = checked.length ? checked : runs;
  const best = pool.reduce((a, b) => (b.R.m[0] + b.R.m[1]) * b.r.outYear > (a.R.m[0] + a.R.m[1]) * a.r.outYear ? b : a);
  const cheap = runs.reduce((a, b) => b.r.equip < a.r.equip ? b : a);
  const main = [...new Set(M.markets.filter(m => m.crop === crop.name && m.level === 3).map(m => m.r))];
  return {
    season: crop.tree.children[0].w || "",
    products: routes.length,
    marginT: [Math.min(...routes.map(r => r.m[0])), Math.max(...routes.map(r => r.m[1]))],
    equip: [cheap.r.equip * 0.75, Math.max(...runs.map(x => x.r.equip)) * 1.4],
    cheapest: cheap.R.p,
    best: { name: best.R.p, year: best.r.marginYear, idx: P.routes.indexOf(best.R), src: best.R.src || "estimate", skipped: runs.length - pool.length, checked: checked.length > 0 },
    markets: main,
  };
}

export async function renderCompare(main, s, ctx) {
  const { t, esc, lang, crops, signal } = ctx;
  const [P, M, C] = await load();
  const L = lang();
  const tr = o => o?.[L] ?? o?.en ?? "";
  const money = k => k >= 1000 ? "$" + (k / 1000).toFixed(k >= 10000 ? 0 : 1) + "m" : "$" + Math.round(k) + "k"; // $k in
  const name = c => L === "ar" ? c.ar : c.name;
  const all = Object.fromEntries(crops.map(c => [c.id, { c, m: metrics(c, P, M), d: C.crops[c.id] }]));

  let picked = (s.p.get("crops") || "").split(",").filter(id => all[id]);
  if (picked.length < 2) picked = crops.map(c => c.id);

  main.innerHTML = `
    <header class="page-head">
      <a class="eyebrow" data-nav href="${ctx.href({})}">${t("crop.home")}</a>
      <h1>${t("cmp.title")}</h1>
      <p class="lede">${t("cmp.lede")}</p>
    </header>
    <fieldset class="picker" id="picker">
      <legend>${t("cmp.pick")}</legend>
      ${crops.map(c => `<label class="pick" style="--accent: var(${c.accent})"><input type="checkbox" value="${c.id}"${picked.includes(c.id) ? " checked" : ""}><span>${esc(name(c))}</span></label>`).join("")}
    </fieldset>
    <div id="cmpOut"></div>`;

  const out = main.querySelector("#cmpOut"), picker = main.querySelector("#picker");
  const saveOrder = () => { const q = new URLSearchParams(location.search); q.set("crops", picked.join(",")); history.replaceState(null, "", "?" + q); };
  picker.addEventListener("change", () => {
    const on = [...picker.querySelectorAll("input:checked")].map(i => i.value);
    picked = [...picked.filter(id => on.includes(id)), ...on.filter(id => !picked.includes(id))]; // keep column order
    saveOrder(); draw();
  }, { signal });

  // Column move buttons: arrows are visual, so in RTL "left" means later in the list.
  out.addEventListener("click", e => {
    const b = e.target.closest("[data-move]"); if (!b) return;
    const rtl = document.documentElement.dir === "rtl";
    const i = picked.indexOf(b.dataset.id), j = i + (b.dataset.move === "left" ? (rtl ? 1 : -1) : (rtl ? -1 : 1));
    if (j < 0 || j >= picked.length) return;
    [picked[i], picked[j]] = [picked[j], picked[i]];
    saveOrder(); draw();
    const again = out.querySelector(`[data-move="${b.dataset.move}"][data-id="${b.dataset.id}"]`);
    (again && !again.disabled ? again : out.querySelector(`[data-id="${b.dataset.id}"]:not(:disabled)`))?.focus();
  }, { signal });

  // Drag a column header (mouse or touch) and drop it on another column's place.
  let drag = null;
  out.addEventListener("pointerdown", e => {
    const th = e.target.closest("th.col-drag");
    if (!th || e.target.closest("button") || e.button > 0) return;
    drag = { id: th.dataset.col, x0: e.clientX, on: false, target: null };
    th.setPointerCapture(e.pointerId);
  }, { signal });
  out.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    if (!drag.on && Math.abs(dx) < 6) return;
    drag.on = true;
    out.querySelectorAll(`[data-col="${drag.id}"]`).forEach(c => { c.classList.add("col-dragging"); c.style.transform = `translateX(${dx}px)`; });
    const heads = [...out.querySelectorAll("th.col-drag")];
    const over = heads.reduce((a, h) => { const r = h.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2)); return d < a.d ? { h, d } : a; }, { h: null, d: Infinity }).h;
    heads.forEach(h => h.classList.toggle("col-drop", h === over && h.dataset.col !== drag.id));
    drag.target = over?.dataset.col;
  }, { signal });
  const endDrag = () => {
    if (!drag) return;
    const { id, on, target } = drag; drag = null;
    if (!on) return;
    if (target && target !== id) {
      const to = picked.indexOf(target);
      picked.splice(picked.indexOf(id), 1);
      picked.splice(to, 0, id);
      saveOrder();
      announce(t("cmp.moved", { c: name(all[id].c), n: picked.indexOf(id) + 1 }));
    }
    draw();
  };
  out.addEventListener("pointerup", endDrag, { signal });
  out.addEventListener("pointercancel", endDrag, { signal });

  const meter = (v, goodHigh) => {
    const label = t(["cmp.low", "cmp.med", "cmp.high"][v - 1]);
    const tone = goodHigh ? ["bad", "mid", "good"][v - 1] : ["good", "mid", "bad"][v - 1];
    return `<span class="meter ${tone}" aria-label="${label}">${[1, 2, 3].map(i => `<i${i <= v ? ' class="on"' : ""}></i>`).join("")}<b>${label}</b></span>`;
  };

  function draw() {
    // Keep at least 2 crops picked: lock the last two checkboxes.
    picker.querySelectorAll("input").forEach(i => { i.disabled = i.checked && picked.length <= 2; });
    const sel = picked.map(id => all[id]);
    // All crops sharing the best score (ties are shown together).
    const pick = (score, better) => { const top = sel.reduce((a, b) => better(score(b), score(a)) ? b : a); return sel.filter(x => score(x) === score(top)); };
    const R = k => x => x.d.ratings[k][0];
    const usd = v => "$" + v.toLocaleString("en-US");
    // Only crops with a checked margin can win "highest yearly margin"; estimate-only crops are named instead.
    const marginPool = sel.some(x => x.m.best.checked) ? sel.filter(x => x.m.best.checked) : sel;
    const left = sel.filter(x => !marginPool.includes(x));
    const pickFrom = (list, score, better) => { const top = list.reduce((a, b) => better(score(b), score(a)) ? b : a); return list.filter(x => score(x) === score(top)); };
    const answers = [
      ["cmp.a.margin", pickFrom(marginPool, x => x.m.best.year[0] + x.m.best.year[1], (a, b) => a > b), x => `${money(x.m.best.year[0] / 1000)}–${money(x.m.best.year[1] / 1000)} / ${t("plan.year")} · ${x.m.best.name}`],
      ["cmp.a.cheap", pick(x => x.m.equip[0], (a, b) => a < b), x => `${money(x.m.equip[0])}+ · ${x.m.cheapest}`],
      ["cmp.a.safe", pick(R("supplyRisk"), (a, b) => a < b), x => tr(x.d.ratings.supplyRisk[1])],
      ["cmp.a.market", pick(R("marketSize"), (a, b) => a > b), x => tr(x.d.ratings.marketSize[1])],
      ["cmp.a.easy", pick(R("easeOfStart"), (a, b) => a > b), x => tr(x.d.ratings.easeOfStart[1])],
    ];
    const cell = f => sel.map(x => `<td data-col="${x.c.id}" style="--accent: var(${x.c.accent})">${f(x)}</td>`).join("");
    const rtl = document.documentElement.dir === "rtl";
    const maxYear = Math.max(...sel.map(x => x.m.best.year[1])), maxEquip = Math.max(...sel.map(x => x.m.equip[1]));
    const bestYear = pickFrom(marginPool, x => x.m.best.year[0] + x.m.best.year[1], (a, b) => a > b), cheapest = pick(x => x.m.equip[0], (a, b) => a < b);
    const bar = (lo, hi, max) => `<span class="rbar" aria-hidden="true"><i style="inset-inline-start:${(lo / max * 100).toFixed(1)}%;width:${Math.max(2, (hi - lo) / max * 100).toFixed(1)}%"></i></span>`;
    const tag = (on, k) => on ? `<span class="best-tag">${t(k)}</span>` : "";
    const edge = (i, dir) => (dir === "left") === !rtl ? i === 0 : i === sel.length - 1;
    const moveBtn = (x, i, dir) => `<button type="button" class="col-move" data-move="${dir}" data-id="${x.c.id}"${edge(i, dir) ? " disabled" : ""}
      aria-label="${t(dir === "left" ? "cmp.moveLeft" : "cmp.moveRight", { c: name(x.c) })}">${dir === "left" ? "‹" : "›"}</button>`;
    const why = (x, k) => `<span class="why" dir="auto">${esc(tr(x.d.ratings[k][1]))}</span>`;

    out.innerHTML = `
      <section class="answers" aria-label="${t("cmp.quick")}">
        <h2>${t("cmp.quick")}</h2>
        <div class="answer-grid">${answers.map(([k, xs, f]) => `
          <div class="card answer" style="--accent: var(${xs[0].c.accent})">
            <span class="answer-q">${t(k)}</span>
            <strong>${xs.map(x => esc(name(x.c))).join(" · ")}</strong>
            <span class="answer-why" dir="auto">${esc(f(xs[0]))}</span>
            ${k === "cmp.a.margin" ? badge(xs[0].m.best.src, t, esc, true) + (left.length ? `<span class="answer-note">${t("cmp.leftOut", { c: left.map(x => name(x.c)).join(", ") })}</span>` : "") : ""}
          </div>`).join("")}</div>
        <p class="hint">${t("cmp.ties")}</p>
      </section>

      <section class="card cmp-table-wrap">
        <h2 class="visually-hidden">${t("cmp.table")}</h2>
        <div class="table-scroll" tabindex="0" role="region" aria-label="${t("cmp.table")}">
        <table class="cmp-table">
          <thead><tr><th scope="col"><span class="visually-hidden">${t("cmp.table")}</span></th>${sel.map((x, i) => `<th scope="col" class="col-drag" data-col="${x.c.id}" title="${t("cmp.dragHint")}" style="--accent: var(${x.c.accent})"><div class="col-head"><span class="col-name"><span class="grip" aria-hidden="true">⠿</span>${esc(name(x.c))}</span><span class="col-moves">${moveBtn(x, i, "left")}${moveBtn(x, i, "right")}</span></div></th>`).join("")}</tr></thead>
          <tbody>
            <tr><th scope="row">${t("cmp.r.verdict")}</th>${cell(x => `<span dir="auto">${esc(tr(x.d.verdict))}</span>`)}</tr>
            <tr><th scope="row">${t("cmp.r.marginT")}</th>${cell(x => `<span class="figure"><span class="num">${usd(x.m.marginT[0])}–${usd(x.m.marginT[1])}</span> <span class="unit">/ t</span></span>`)}</tr>
            <tr><th scope="row">${t("cmp.r.best")}<span class="why">${t("cmp.r.bestSub")}</span><span class="why">${t("cmp.r.bestChecked")}</span></th>${cell(x => `<span dir="auto">${esc(x.m.best.name)}</span><span class="figure"><span class="num">${money(x.m.best.year[0] / 1000)}–${money(x.m.best.year[1] / 1000)}</span> <span class="unit">/ ${t("plan.year")}</span></span>${bar(x.m.best.year[0], x.m.best.year[1], maxYear)}${tag(bestYear.includes(x), "cmp.tagHigh")}${badge(x.m.best.src, t, esc, true)}`)}</tr>
            <tr><th scope="row">${t("cmp.r.equip")}</th>${cell(x => `<span class="figure"><span class="num">${money(x.m.equip[0])}–${money(x.m.equip[1])}</span></span>${bar(x.m.equip[0], x.m.equip[1], maxEquip)}${tag(cheapest.includes(x), "cmp.tagLow")}`)}</tr>
            <tr><th scope="row">${t("cmp.r.raw")}</th>${cell(x => `<span dir="auto">${esc(tr(x.d.rawPrice))}</span>${badge(x.d.rawPrice.src || "estimate", t, esc, true)}`)}</tr>
            <tr><th scope="row">${t("cmp.r.supply")}</th>${cell(x => meter(x.d.ratings.supplyRisk[0], false) + why(x, "supplyRisk"))}</tr>
            <tr><th scope="row">${t("cmp.r.market")}</th>${cell(x => meter(x.d.ratings.marketSize[0], true) + why(x, "marketSize"))}</tr>
            <tr><th scope="row">${t("cmp.r.ease")}</th>${cell(x => meter(x.d.ratings.easeOfStart[0], true) + why(x, "easeOfStart"))}</tr>
            <tr><th scope="row">${t("cmp.r.markets")}</th>${cell(x => x.m.markets.map(r => `<span class="chip">${t("mregion." + r)}</span>`).join(" "))}</tr>
            <tr><th scope="row">${t("cmp.r.products")}</th>${cell(x => `<span class="num">${x.m.products}</span>`)}</tr>
            <tr><th scope="row">${t("cmp.r.season")}</th>${cell(x => `<span dir="auto">${esc(x.m.season)}</span>`)}</tr>
          </tbody>
        </table></div>
      </section>

      <section class="proscons" aria-label="${t("cmp.pc")}">
        <h2>${t("cmp.pc")}</h2>
        <div class="pc-grid">${sel.map(x => `
          <article class="card pc" style="--accent: var(${x.c.accent})">
            <h3>${esc(name(x.c))}</h3>
            <h4 class="pc-h good">${t("cmp.pros")}</h4>
            <ul class="pc-list">${x.d.pros.map(p => { const [a, b] = p[L] || p.en; return `<li class="pro"><strong dir="auto">${esc(a)}</strong><span dir="auto">${t("cmp.why")}: ${esc(b)}</span></li>`; }).join("")}</ul>
            <h4 class="pc-h bad">${t("cmp.cons")}</h4>
            <ul class="pc-list">${x.d.cons.map(p => { const [a, b] = p[L] || p.en; return `<li class="con"><strong dir="auto">${esc(a)}</strong><span dir="auto">${t("cmp.why")}: ${esc(b)}</span></li>`; }).join("")}</ul>
            <div class="pc-actions">
              <a class="btn" data-nav href="${ctx.href({ crop: x.c.id })}">${t("nav.chain")}</a>
              <a class="btn" data-nav href="${ctx.href({ crop: x.c.id, view: "plan" })}&route=${x.m.best.idx}">${t("nav.plan")}</a>
            </div>
          </article>`).join("")}</div>
        <p class="hint">${t("cmp.draft")}</p>
      </section>`;
  }
  draw();
}
