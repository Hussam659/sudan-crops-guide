// Screen-reader helpers shared by the views.

// Short polite announcement (e.g. "Stage 4 of 10: Shipping"), instead of making whole panels live regions.
export function announce(text) {
  const el = document.getElementById("sr");
  el.textContent = "";
  setTimeout(() => { el.textContent = text; }, 50);
}

// Data text is English for now; in the Arabic UI mark it lang="en" so screen readers switch voice.
const ARABIC = /[؀-ۿ]/;
export function markLang(root) {
  if (document.documentElement.lang !== "ar") return;
  root.querySelectorAll('[dir="auto"]:not([lang])').forEach(el => {
    if (!ARABIC.test(el.textContent)) el.lang = "en";
  });
}
