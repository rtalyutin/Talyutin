import { alphabet, motion } from "./config.js";
// A single scheduler serves section assembly and gaze; idle and hidden tabs do no work.
export function createScheduler(onError) {
  const tasks = new Set();
  let frame = 0;
  const tick = (time) => {
    frame = 0;
    if (document.hidden) return;
    try {
      for (const task of [...tasks])
        if (task(time) === false) tasks.delete(task);
    } catch (error) {
      tasks.clear();
      onError(error);
    }
    if (tasks.size) frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (!frame && !document.hidden && tasks.size)
      frame = requestAnimationFrame(tick);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else wake();
  });
  return {
    add(task) {
      tasks.add(task);
      wake();
    },
    remove(task) {
      tasks.delete(task);
      if (!tasks.size) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    clear() {
      tasks.clear();
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
export function decorateText(element) {
  element.classList.remove("glyph-ready");
  element.querySelector(".glyph-decoration")?.remove();
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return [];
  const mask = document.createElement("canvas");
  mask.width = Math.ceil(rect.width);
  mask.height = Math.ceil(rect.height);
  const context = mask.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  context.textBaseline = "top";
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const style = getComputedStyle(node.parentElement);
    const size = parseFloat(style.fontSize);
    context.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    context.fillStyle = style.color;
    for (let i = 0; i < node.length; i++) {
      if (!node.data[i].trim()) continue;
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      context.fillText(
        node.data[i],
        r.left - rect.left,
        r.top - rect.top + (r.height - size) * 0.5,
      );
    }
  }
  const image = context.getImageData(0, 0, mask.width, mask.height);
  const points = [];
  const step = parseFloat(getComputedStyle(element).fontSize) > 65 ? 4 : 3;
  const decoration = document.createElement("canvas");
  decoration.className = "glyph-decoration";
  decoration.setAttribute("aria-hidden", "true");
  decoration.width = mask.width * 2;
  decoration.height = mask.height * 2;
  const ink = decoration.getContext("2d");
  ink.scale(2, 2);
  ink.font = `bold ${step + 2}px monospace`;
  ink.textBaseline = "middle";
  for (let y = 1; y < mask.height; y += step)
    for (let x = 1; x < mask.width; x += step) {
      const i = (y * mask.width + x) * 4;
      if (image.data[i + 3] < 100) continue;
      const color = `rgb(${image.data[i]},${image.data[i + 1]},${image.data[i + 2]})`;
      const char = "@#08"[(x * 3 + y * 7) % 4];
      ink.fillStyle = color;
      ink.fillText(char, x, y);
      points.push({ x, y, char, color, size: step + 1 });
    }
  element.append(decoration);
  element.classList.add("glyph-ready");
  element.glyphPoints = points;
  return points;
}
export function decorateSymbol(element) {
  // Render the decorative punctuation through the same glyph sampler as headings.
  element.dataset.glyph = "";
  element.textContent = element.dataset.symbol;
  decorateText(element);
}
export function sectionTargets(section) {
  const box = section.getBoundingClientRect();
  const targets = [];
  for (const element of section.querySelectorAll("[data-glyph]")) {
    const r = element.getBoundingClientRect();
    for (const p of element.glyphPoints || [])
      targets.push({
        ...p,
        x: p.x + r.left - box.left,
        y: p.y + r.top - box.top,
      });
  }
  for (const text of section.querySelectorAll("#cat svg text")) {
    const matrix = text.getCTM();
    const cat = section.querySelector("#cat").getBoundingClientRect();
    const x = Number(text.getAttribute("x")),
      y = Number(text.getAttribute("y"));
    targets.push({
      x: cat.left - box.left + matrix.a * x + matrix.e,
      y: cat.top - box.top + matrix.d * y + matrix.f,
      char: text.textContent,
      color: text.getAttribute("fill"),
      size: Math.max(4, matrix.a * 9),
    });
  }
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (
      !node.data.trim() ||
      node.parentElement.closest('[data-glyph],#cat,[aria-hidden="true"]')
    )
      continue;
    const style = getComputedStyle(node.parentElement);
    for (let i = 0; i < node.length; i++) {
      if (!node.data[i].trim()) continue;
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      targets.push({
        x: r.left - box.left,
        y: r.top - box.top + r.height * 0.75,
        char: node.data[i],
        color: style.color,
        size: parseFloat(style.fontSize),
      });
    }
  }
  const stride = Math.max(1, Math.ceil(targets.length / motion.maxParticles));
  return targets
    .filter((_, i) => i % stride === 0)
    .map((p, i) => ({
      ...p,
      originX: (((i * 137) % 1000) / 1000) * box.width,
      originY:
        -50 + (((i * 83) % 1000) / 1000) * Math.min(box.height, innerHeight),
      delay: (i % 19) / 70,
    }));
}
export function createGlyphRenderer(canvas) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, motion.maxDpr);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  function clear() {
    context.clearRect(0, 0, innerWidth, innerHeight);
  }
  function draw(section, targets, state, progress, time) {
    const r = section.getBoundingClientRect();
    context.save();
    context.beginPath();
    context.rect(r.left, r.top, r.width, r.height);
    context.clip();
    // Sparse column trails become the quiet, static background after assembly.
    context.fillStyle = "#20cb45";
    context.font = "11px monospace";
    for (let x = 18; x < r.width; x += 27) {
      const column = Math.floor(x / 27);
      const head =
        ((time * 0.075 + column * 173) % Math.max(1, r.height + 360)) - 180;
      for (let j = 0; j < 22; j++) {
        const y = head - j * 14;
        if (y < 0 || y > r.height) continue;
        context.globalAlpha =
          (1 - j / 22) *
          (state === "rain" ? 0.65 : 0.18) *
          (1 - progress * 0.7);
        context.fillText(
          alphabet[(column + j) % alphabet.length],
          r.left + x,
          r.top + y,
        );
      }
    }
    context.globalAlpha = 1;
    if (state === "assemble")
      for (const p of targets) {
        const t = Math.max(
          0,
          Math.min(1, (progress - p.delay) / (1 - p.delay)),
        );
        const eased = 1 - (1 - t) ** 3;
        const x = p.originX + (p.x - p.originX) * eased,
          y = p.originY + (p.y - p.originY) * eased;
        if (y + r.top < -20 || y + r.top > innerHeight + 20) continue;
        context.fillStyle = t > 0.75 ? p.color : "#13bb34";
        context.font = `${p.size}px monospace`;
        context.fillText(
          t > 0.8
            ? p.char
            : alphabet[
                (Math.floor(time / 65) + Math.floor(p.originX)) %
                  alphabet.length
              ],
          r.left + x,
          r.top + y,
        );
      }
    context.restore();
  }
  return { resize, clear, draw };
}
