import { alphabet, motion, columnStart, captureProgress } from "./config.js";
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
  mask.width = Math.ceil(rect.width) * 2;
  mask.height = Math.ceil(rect.height) * 2;
  const context = mask.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  context.scale(2, 2);
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
  decoration.width = mask.width;
  decoration.height = mask.height;
  const ink = decoration.getContext("2d");
  ink.scale(2, 2);
  ink.font = `bold ${step + 2}px monospace`;
  ink.textBaseline = "middle";
  for (let y = 1; y < mask.height / 2; y += step)
    for (let x = 1; x < mask.width / 2; x += step) {
      const i = (y * 2 * mask.width + x * 2) * 4;
      if (image.data[i + 3] < 100) continue;
      const color = `rgb(${image.data[i]},${image.data[i + 1]},${image.data[i + 2]})`;
      const char = "@#08"[(x * 3 + y * 7) % 4];
      ink.fillStyle = color;
      ink.fillText(char, x, y);
      points.push({
        x,
        y,
        char,
        color,
        size: step + 2,
        weight: "bold",
        baseline: "middle",
      });
    }
  if (element.matches("h1, h2, h3")) {
    // Keep ASCII texture inside the letter silhouettes, with a quiet ink layer
    // beneath the gaps. Assembly still captures ASCII; only the resting text
    // becomes less ragged, especially at mobile heading sizes.
    ink.globalCompositeOperation = "destination-in";
    ink.drawImage(mask, 0, 0, mask.width / 2, mask.height / 2);
    ink.globalCompositeOperation = "destination-over";
    ink.globalAlpha = motion.headingInkOpacity;
    ink.drawImage(mask, 0, 0, mask.width / 2, mask.height / 2);
    ink.globalAlpha = 1;
    ink.globalCompositeOperation = "source-over";
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
  for (const text of section.querySelectorAll("svg text")) {
    const matrix = text.getCTM();
    const cat = text.ownerSVGElement.getBoundingClientRect();
    const style = getComputedStyle(text);
    const x = Number(text.getAttribute("x")),
      y = Number(text.getAttribute("y"));
    targets.push({
      x: cat.left - box.left + matrix.a * x + matrix.e,
      y: cat.top - box.top + matrix.d * y + matrix.f,
      char: text.textContent,
      color: text.getAttribute("fill"),
      size: Math.max(2, matrix.a * parseFloat(style.fontSize)),
      weight: style.fontWeight,
      align:
        style.textAnchor === "middle"
          ? "center"
          : style.textAnchor === "end"
            ? "right"
            : "left",
    });
  }
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.data.trim() || node.parentElement.closest("[data-glyph],svg"))
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
  // Keep every target, including all decorative glyphs. Captured symbols are
  // cached once, so adding fidelity does not mean redrawing all text every frame.
  return targets
    .map((p) => ({ ...p, captureAt: captureProgress(p.x, p.y, box.height) }))
    .sort((a, b) => a.captureAt - b.captureAt);
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
  const captures = new WeakMap();
  function captureLayer(section, targets, r) {
    let layer = captures.get(section);
    if (!layer || layer.targets !== targets) {
      const sheet = document.createElement("canvas");
      const dpr = Math.min(devicePixelRatio || 1, motion.maxDpr);
      sheet.width = Math.ceil(r.width * dpr);
      sheet.height = Math.ceil(r.height * dpr);
      const ink = sheet.getContext("2d");
      if (!ink) throw new Error("Canvas unavailable");
      ink.scale(dpr, dpr);
      layer = {
        sheet,
        ink,
        index: 0,
        targets,
        width: r.width,
        height: r.height,
      };
      captures.set(section, layer);
    }
    return layer;
  }
  function draw(section, targets, state, progress, time) {
    const r = section.getBoundingClientRect();
    context.save();
    context.beginPath();
    context.rect(r.left, r.top, r.width, r.height);
    context.clip();
    // Rain continues at full strength until the final target has been captured.
    // These are always vertical streams; no particle flies across the composition.
    context.fillStyle = "#20cb45";
    context.font = `${motion.rainFontSize}px monospace`;
    context.textBaseline = "alphabetic";
    const columnCount = Math.ceil(r.width / motion.rainColumnWidth);
    for (let column = 0; column < columnCount; column++) {
      const x = column * motion.rainColumnWidth + motion.rainColumnWidth / 2;
      const tail = 30 * motion.rainRowHeight;
      const head = (time * motion.rainSpeed + column * 173) % (r.height + tail);
      for (let j = 0; j < 30; j++) {
        const y = head - j * motion.rainRowHeight;
        if (
          y < 0 ||
          y > r.height ||
          y + r.top < -15 ||
          y + r.top > innerHeight + 15
        )
          continue;
        context.globalAlpha = (1 - j / 30) * motion.rainOpacity;
        context.fillText(
          alphabet[(column + j + Math.floor(time / 110)) % alphabet.length],
          r.left + x,
          r.top + y,
        );
      }
      if (state === "assemble") {
        const front =
          ((progress - columnStart(column)) / motion.captureSweep) * r.height;
        if (front >= 0 && front <= r.height) {
          for (let j = 0; j < 12; j++) {
            const y = front - j * motion.rainRowHeight;
            if (y < 0 || y > r.height) continue;
            context.globalAlpha = (1 - j / 12) * motion.rainOpacity;
            context.fillText(
              alphabet[(column + j) % alphabet.length],
              r.left + x,
              r.top + y,
            );
          }
        }
      }
    }
    context.globalAlpha = 1;
    if (state === "assemble") {
      const layer = captureLayer(section, targets, r);
      while (
        layer.index < targets.length &&
        targets[layer.index].captureAt <= progress
      ) {
        const p = targets[layer.index++];
        layer.ink.fillStyle = p.color;
        layer.ink.font = `${p.weight || "normal"} ${p.size}px monospace`;
        layer.ink.textBaseline = p.baseline || "alphabetic";
        layer.ink.textAlign = p.align || "left";
        layer.ink.fillText(p.char, p.x, p.y);
      }
      context.drawImage(layer.sheet, r.left, r.top, layer.width, layer.height);
    }
    context.restore();
  }
  return {
    resize,
    clear,
    draw,
    release(section) {
      captures.delete(section);
    },
  };
}
