import { clamp, motion } from "./config.js";
export function gazeTarget(pointer, rect) {
  if (!pointer) return { x: 0, y: 0 };
  return {
    x:
      clamp(
        (pointer.x - (rect.left + rect.width / 2)) / (rect.width / 2),
        -1,
        1,
      ) * motion.gazeLimitX,
    y:
      clamp(
        (pointer.y - (rect.top + rect.height / 2)) / (rect.height / 2),
        -1,
        1,
      ) * motion.gazeLimitY,
  };
}
export function createCatGaze(cat, scheduler, isReady) {
  const pupils = [...cat.querySelectorAll("[data-pupil]")];
  let pointer = null,
    current = { x: 0, y: 0 },
    visible = true,
    enabled = true;
  const fine = matchMedia("(pointer: fine)");
  const task = () => {
    if (!enabled || !visible || !fine.matches || !isReady()) return false;
    const target = gazeTarget(pointer, cat.getBoundingClientRect());
    current.x += (target.x - current.x) * motion.gazeEase;
    current.y += (target.y - current.y) * motion.gazeEase;
    for (const pupil of pupils)
      pupil.setAttribute("transform", `translate(${current.x} ${current.y})`);
    return (
      Math.abs(current.x - target.x) + Math.abs(current.y - target.y) > 0.05
    );
  };
  const wake = () => scheduler.add(task);
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      pointer = { x: e.clientX, y: e.clientY };
      wake();
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => {
    pointer = null;
    wake();
  });
  window.addEventListener("blur", () => {
    pointer = null;
    wake();
  });
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", wake);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) wake();
    else scheduler.remove(task);
  }).observe(cat);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });
  return {
    wake,
    stop() {
      enabled = false;
      scheduler.remove(task);
      for (const pupil of pupils) pupil.removeAttribute("transform");
    },
  };
}
