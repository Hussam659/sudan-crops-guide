// Source badges: a small chip showing where a fact comes from and how much to trust it.
let SRC = {};
export const setSources = s => { SRC = s; };
export const getSources = () => SRC;

// short: show only the trust level; the full source is in the tooltip and accessible name.
export function badge(id, t, esc, short = false) {
  const s = SRC[id];
  if (!s) return "";
  const full = `${t("src." + s.conf)} · ${esc(s.label)}${s.date ? " · " + esc(s.date) : ""}`;
  const text = short ? t("src." + s.conf) : full;
  const icon = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${
    s.conf === "high" ? '<path d="M3 8.5 6.5 12 13 4.5"/>' : s.conf === "med" ? '<circle cx="8" cy="8" r="5"/>' : '<path d="M8 4v5M8 12v.01"/>'}</svg>`;
  return s.url
    ? `<a class="src src-${s.conf}" href="${s.url}" target="_blank" rel="noopener" title="${full}">${icon}<span>${text}</span><span class="visually-hidden">${short ? ": " + full : ""} (${t("src.opens")})</span></a>`
    : `<span class="src src-${s.conf}" title="${full}">${icon}<span>${text}</span>${short ? `<span class="visually-hidden">: ${full}</span>` : ""}</span>`;
}
