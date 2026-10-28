import { announce } from "./a11y.js";

// Glossary terms: mark the first mention of each term in a text block, show the definition in a popover.
let termRe = null, termDef = {};

export function setupGlossary(glossary) {
  if (termRe || !glossary) return;
  const terms = glossary.filter(g => g.term.toLowerCase() !== "tonne").sort((a, b) => b.term.length - a.term.length);
  termDef = Object.fromEntries(glossary.map(g => [g.term.toLowerCase(), g]));
  termRe = new RegExp("\\b(" + terms.map(g => g.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?:s|es)?\\b", "gi");
}

// Takes already-escaped HTML text.
export function withTerms(html) {
  if (!termRe) return html;
  const seen = new Set();
  return html.replace(termRe, (m, term) => {
    const key = term.toLowerCase();
    if (seen.has(key) || !termDef[key]) return m;
    seen.add(key);
    return `<button type="button" class="term" data-term="${key}">${m}</button>`;
  });
}

// Wires term buttons inside `container` to one popover appended to it.
// Hover or keyboard focus shows the definition; click (or Enter) pins it and reads it out.
export function bindTerms(container, esc, signal) {
  const pop = document.createElement("div");
  pop.className = "term-pop"; pop.popover = "auto";
  container.append(pop);
  let pinned = false, hideTimer;
  const isOpen = () => pop.matches(":popover-open");

  function show(btn) {
    clearTimeout(hideTimer);
    const g = termDef[btn.dataset.term];
    pop.innerHTML = `<strong dir="auto">${esc(g.term)}</strong><p dir="auto">${esc(g.def)}</p>`;
    if (!isOpen()) pop.showPopover();
    const r = btn.getBoundingClientRect(), w = Math.min(320, innerWidth - 32);
    pop.style.width = w + "px";
    pop.style.left = Math.min(Math.max(16, r.left), innerWidth - w - 16) + "px";
    const below = r.bottom + 8, h = pop.offsetHeight;
    pop.style.top = (below + h > innerHeight - 16 ? Math.max(16, r.top - h - 8) : below) + "px";
    return g;
  }
  // Short delay so the pointer can move from the term onto the popover.
  const hideSoon = () => { if (!pinned) hideTimer = setTimeout(() => isOpen() && pop.hidePopover(), 150); };

  container.addEventListener("click", e => {
    const btn = e.target.closest(".term"); if (!btn) return;
    pinned = true;
    const g = show(btn);
    announce(`${g.term}: ${g.def}`);
  }, { signal });
  container.addEventListener("mouseover", e => { const btn = e.target.closest(".term"); if (btn && !pinned) show(btn); }, { signal });
  container.addEventListener("mouseout", e => { if (e.target.closest(".term")) hideSoon(); }, { signal });
  container.addEventListener("focusin", e => { const btn = e.target.closest(".term"); if (btn && !pinned) show(btn); }, { signal });
  container.addEventListener("focusout", e => { if (e.target.closest(".term")) hideSoon(); }, { signal });
  pop.addEventListener("mouseenter", () => clearTimeout(hideTimer), { signal });
  pop.addEventListener("mouseleave", hideSoon, { signal });
  pop.addEventListener("toggle", e => { if (e.newState === "closed") pinned = false; }, { signal });
  addEventListener("scroll", () => isOpen() && pop.hidePopover(), { passive: true, signal });
}
