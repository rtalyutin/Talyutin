import {
  createScheduler,
  createGlyphRenderer,
  decorateText,
  decorateSymbol,
} from "./motion/glyph-renderer.js";
import { createSections } from "./motion/sections.js";
import { createCatGaze } from "./motion/cat-gaze.js";
let scheduler, controller, gaze;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
function staticMode() {
  controller?.finishAll();
  gaze?.stop();
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
