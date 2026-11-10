import { phase } from "./config.js";
import { sectionTargets } from "./glyph-renderer.js";
export function createSections(sections, renderer, scheduler, onReady) {
  const records = sections.map((element) => ({
    element,
    state: "pending",
    start: 0,
    targets: [],
  }));
  const finish = (record) => {
    record.state = "ready";
    record.element.dataset.state = "ready";
    record.element.classList.remove("motion-pending", "motion-active");
    renderer.release?.(record.element);
    record.targets = [];
    onReady(record.element);
  };
  const task = (time) => {
    renderer.clear();
    let running = false;
    for (const record of records) {
      if (record.state === "pending" || record.state === "ready") continue;
      const r = record.element.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight) {
        finish(record);
        continue;
      }
      const next = phase(time - record.start, record.element.id === "intro");
      record.state = next.state;
      record.element.dataset.state = next.state;
      if (next.state === "ready") {
        finish(record);
        continue;
      }
      renderer.draw(
        record.element,
        record.targets,
        next.state,
        next.progress,
        time,
      );
      running = true;
    }
    return running;
  };
  const start = (record) => {
    if (record.state !== "pending") return;
    record.targets = sectionTargets(record.element);
    record.start = performance.now();
    record.state = "rain";
    record.element.dataset.state = "rain";
    record.element.classList.remove("motion-pending");
    record.element.classList.add("motion-active");
    scheduler.add(task);
  };
  const completeTarget = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const record = records.find((r) => r.element.id === id);
    if (record) finish(record);
    renderer.clear();
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const record = records.find((r) => r.element === entry.target);
        if (entry.isIntersecting) start(record);
        else if (record.state !== "pending" && record.state !== "ready")
          finish(record);
      }
    },
    { threshold: 0 },
  );
  for (const record of records) {
    record.element.classList.add("motion-pending");
    record.element.dataset.state = "pending";
    observer.observe(record.element);
  }
  document.addEventListener("focusin", (event) => {
    const record = records.find((r) => r.element.contains(event.target));
    if (record) {
      finish(record);
      renderer.clear();
    }
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link) {
      const record = records.find((r) => r.element.id === link.hash.slice(1));
      if (record) finish(record);
    }
  });
  window.addEventListener("hashchange", completeTarget);
  completeTarget();
  if (!location.hash) start(records[0]);
  document.documentElement.classList.remove("boot-intro");
  clearTimeout(window.aiBootTimeout);
  return {
    finishAll() {
      observer.disconnect();
      for (const record of records) finish(record);
      scheduler.remove(task);
      renderer.clear();
    },
    resize() {
      for (const record of records)
        if (record.state !== "pending" && record.state !== "ready")
          finish(record);
      renderer.resize();
      renderer.clear();
    },
    records,
  };
}
