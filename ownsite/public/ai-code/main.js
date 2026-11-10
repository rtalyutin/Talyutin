import {
  createScheduler,
  createGlyphRenderer,
  decorateText,
  decorateSymbol,
} from "./motion/glyph-renderer.js";
import { createSections } from "./motion/sections.js";
import { createCatGaze } from "./motion/cat-gaze.js";
import { createCatVolume } from "./motion/cat-volume.js";
let scheduler, controller, gaze, volume;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
function staticMode() {
  controller?.finishAll();
  gaze?.stop();
  volume?.neutral();
  scheduler?.clear();
  document.documentElement.classList.remove("boot-intro");
  for (const section of document.querySelectorAll("section")) {
    section.classList.remove("motion-pending", "motion-active");
    section.dataset.state = "ready";
  }
  document
    .querySelector("#code-layer")
    .getContext("2d")
    ?.clearRect(0, 0, innerWidth * 2, innerHeight * 2);
}
function decorate() {
  for (const element of document.querySelectorAll("[data-symbol]"))
    decorateSymbol(element);
  for (const element of document.querySelectorAll(
    "[data-glyph]:not([data-symbol])",
  ))
    decorateText(element);
}
try {
  decorate();
  try {
    volume = createCatVolume(document.querySelector("#cat"));
  } catch {
    /* Neutral SVG stays available if WebGL cannot initialize. */
  }
  if (!reduced.matches && window.IntersectionObserver) {
    scheduler = createScheduler(staticMode);
    const renderer = createGlyphRenderer(document.querySelector("#code-layer"));
    controller = createSections(
      [...document.querySelectorAll("main>section")],
      renderer,
      scheduler,
      () => gaze?.wake(),
    );
    gaze = createCatGaze(
      document.querySelector("#cat"),
      scheduler,
      () => controller.records[0].state === "ready",
      volume,
    );
  } else staticMode();
  let resizeTimer;
  window.addEventListener("resize", () => {
    controller?.resize();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      try {
        decorate();
      } catch {
        staticMode();
      }
    }, 150);
  });
  reduced.addEventListener("change", (event) => {
    if (event.matches) staticMode();
  });
} catch {
  staticMode();
}

// Event names are fixed; no form values or personal data enter analytics.
const eventNames = Object.freeze({ cta: 'cta_click', telegram: 'tg_click', case: 'case_open', details: 'details_open' });
function track(name, params) {
  const counter = window.aiCodeMetrikaId;
  if (counter && typeof window.ym === 'function') window.ym(counter, 'reachGoal', name, params);
}
let anchorOpening = null;
function openAnchor() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (target instanceof HTMLDetailsElement && !target.open) {
    anchorOpening = target;
    target.open = true;
    if (target.dataset.case) track(eventNames.case, { code: target.dataset.case, source: 'direct_anchor' });
    else if (target.dataset.detail) track(eventNames.details, { code: target.dataset.detail });
  }
}
document.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  if (link.dataset.cta) track(eventNames.cta, { block: link.closest('section')?.id, target: link.dataset.cta });
  if ('telegram' in link.dataset) track(eventNames.telegram, { block: link.closest('section')?.id });
});
document.querySelectorAll('details').forEach((details) => details.addEventListener('toggle', () => {
  if (anchorOpening === details) { anchorOpening = null; return; }
  if (!details.open) return;
  if (details.dataset.case) track(eventNames.case, { code: details.dataset.case, source: 'user' });
  if (details.dataset.detail) track(eventNames.details, { code: details.dataset.detail });
}));
window.addEventListener('hashchange', openAnchor);
openAnchor();
