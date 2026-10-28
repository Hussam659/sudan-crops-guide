# Sudan Crops — Redesign Plan (Phase 1: UX & UI)

Reference: https://hussam659.github.io/sudan-crops/ (one 430 KB `index.html`, D3 mind map, all data inline).
Phase 1 = UX/UI. Phase 2 = data accuracy (sources, dates, ranges). Phase 1 must make Phase 2 easy.

---

## 1. Critique of the current site

### What works (keep)
- Clear scope: 4 crops × 10 stages in time order, from the farm in Sudan to buyers.
- Plain-language copy and glossary tooltips (hulling, tahini…).
- The planner idea (raw material → product → machines, layout, cost, margin) is the strongest feature.
- The markets heatmap (product × region) is easy to scan.
- A calm look: good fonts (Schibsted Grotesk / IBM Plex) and a green brand colour.

### Problems

| # | Finding | Severity | Fix in redesign |
|---|---------|----------|-----------------|
| 1 | The mind map is the home screen, but it opens as 10 small pills on the far right with empty space. You have to click small circles to see anything, and 93 items opened at once become unreadable. | 🔴 | Make the main view a **stage timeline** (10 stage cards in order). The detail shows beside it. The map becomes an optional overview. |
| 2 | Mobile: the map is cut off (stage names are off-screen), filters are hidden behind "Show", and the tabs scroll sideways. | 🔴 | Mobile-first layout: vertical timeline, bottom tab bar, filters in a bottom sheet. |
| 3 | Map nodes can't be reached by keyboard, and the SVG is `role="img"`, so screen readers get nothing. | 🔴 | Build the timeline/tree from real HTML (buttons, lists). Any SVG is decoration only. |
| 4 | The "How to read this map" card covers the map, and it's a manual you have to read. | 🟡 | Make the layout self-explanatory. Show a one-line hint only the first time. |
| 5 | The 10 stage colours look alike (pastel purple, blue, teal) and are the only way to tell stages apart. | 🟡 | Use stage numbers and icons as the main cue. Colour is extra. |
| 6 | 11 px monospace labels in the map (dates, durations) are too small. | 🟡 | Smallest text 13 px. Use mono only for numbers. |
| 7 | Arabic names are shown, but there's no Arabic UI and no RTL, even though the users are in Sudan and KSA. | 🟡 | Bilingual EN/AR with full RTL from the start (logical CSS properties). |
| 8 | No dark mode. | 🟢 | Colour tokens + `prefers-color-scheme` + a toggle. |
| 9 | The planner hides its answer (margin, cost) below the form, the flow diagram and a wide table. | 🟡 | Show a **summary of results first**: capex, opex, margin, area, power, staff. The details come after. Inputs stay pinned. |
| 10 | The planner's flow diagram scrolls sideways inside a box, and the machine table is wider than the screen. | 🟡 | A vertical step list on mobile; cards replace table rows on narrow screens. |
| 11 | The three tabs feel like three separate apps. A node in the map doesn't link to the planner or to markets. | 🟡 | Cross-links: stage "Our factory" → opens the planner with that crop already chosen; stage "Who buys" → opens markets filtered to that crop. |
| 12 | No sources, no "last updated" date, and some numbers have no ranges (e.g. margins). | 🟡 (Phase 2) | Space in the UI for each fact's **source + date + confidence** now. Phase 2 fills it in. |
| 13 | State lives in the hash only partly (`#planner`). Picked crop/stage can't be shared. | 🟢 | Put the full state in the URL (`?crop=sesame&stage=4`). |

---

## 2. Target UX

**Audience:** Sudanese/Saudi traders, investors and factory planners. Many use phones, and many prefer Arabic.

**Core questions the site answers (in order):**
1. How does crop X go from Sudan to a buyer? → **Value chain**
2. What would a factory for product Y need and earn? → **Planner**
3. Who buys Y, where, and in what form? → **Markets**

### Information architecture
```
Home (crop picker: 4 big cards with season, main products, main markets)
 └─ Crop page  /?crop=sesame
     ├─ Value chain   (default)  stage timeline + detail panel
     ├─ Factory plan  (planner, crop pre-selected)
     └─ Markets       (heatmap, crop pre-selected)
Glossary (searchable; terms also explained in tooltips)
Global search (crops, stages, products, markets, glossary)
```
The crop becomes the top-level choice. Today it's a sidebar filter.

### Key screens
- **Value chain:** a horizontal row of stage numbers with arrows (desktop) or a vertical timeline (mobile). Each stage card shows the time it takes, where it happens, its main cost, and its risk badge. Clicking one opens a detail panel with sub-steps, numbers, glossary terms, and links to the planner/markets. "Show overview map" opens a cleaner version of the full tree.
- **Planner:** inputs on the left (sticky) or at the top (mobile). Results first as KPI tiles, then the flow, then the machine list, then by-products. "Copy link" / "Print summary".
- **Markets:** the heatmap stays. Clicking a cell opens a side panel with buyer types. On mobile it becomes a list grouped by product, with a region chip row.

---

## 3. Visual system
- Tokens on `:root`: colour, space (4 px scale), radius, type scale, and light/dark.
- Type: keep Schibsted Grotesk (headings) and IBM Plex Sans (body). Add **IBM Plex Sans Arabic** so EN and AR match.
- Colour: a deep green brand colour. One neutral ramp. 4 crop colours (sesame/gum/baobab/hibiscus). Fixed colours for status (good/warn/risk). Every colour pair checked for 4.5:1 contrast.
- Components: Button, Chip, Card, StageCard, KPI tile, Sheet/Drawer, Tabs, Tooltip, Table→Cards, SourceBadge (Phase 2 ready).
- Motion: only for meaning (opening a panel, moving between stages). Respects `prefers-reduced-motion`.

---

## 4. Technical approach
- Static site on GitHub Pages: **plain HTML + CSS + ES modules, no build step**. The app is small, and a framework adds weight without adding value here.
- **Data moved out of the code** into `data/*.json` (crops, stages, machines, markets, glossary). Each fact can carry `source`, `date`, `confidence`. This is the hook for Phase 2.
- D3 is only loaded for the optional overview map.
- i18n: `i18n/en.json`, `i18n/ar.json`. `dir` switches on `<html>`.
- URL holds the full state, so links can be shared.

```
index.html
css/tokens.css  css/app.css
js/app.js  js/chain.js  js/planner.js  js/markets.js  js/i18n.js
data/crops.json  data/machines.json  data/markets.json  data/glossary.json
i18n/en.json  i18n/ar.json
```

---

## 5. Build order (Phase 1)
1. **Data extraction:** pull the inline data out of the reference `index.html` into JSON, unchanged. Same content, new home.
2. **Design tokens + base components:** light/dark, LTR/RTL, and a component sheet page to check them.
3. **Shell:** header, crop home, tabs/bottom nav, URL state, language and theme toggles.
4. **Value chain:** stage timeline + detail panel + glossary tooltips + optional overview map.
5. **Planner:** same calculations as the reference, new layout with results first.
6. **Markets:** heatmap + side panel + mobile list.
7. **Cross-links + global search.**
7b. **Compare crops** (added): pick 2–4 crops, quick answers, table side by side, pros/cons with reasons (`data/compare.json`, EN+AR). Done.
8. **QA:** accessibility review (WCAG 2.1 AA: keyboard, screen reader, contrast), check at 375/768/1280 px in both languages and both themes, design critique pass.

## 6. Phase 2 (later): data accuracy
Priority: the planner's halawa margin ($1,700–1,900/t on 1.53 t output per t raw) gives ~$15m/year at 1.5 t/h, which drives the "highest yearly margin" answer in Compare. Check this first. Also check `data/compare.json` pros/cons and ratings.
Audit every number against sources (FAO, ITC Trade Map, Sudan customs, SFDA/EU rules, machine supplier quotes). Show prices as ranges with dates. Fill in SourceBadge.

## Open decisions
- Arabic in Phase 1, or English first with RTL-ready CSS?
- Brand: keep the current name and green, or rename/rebrand?
- Hosting: a new GitHub repo of your own, or contribute to `hussam659/sudan-crops`?
