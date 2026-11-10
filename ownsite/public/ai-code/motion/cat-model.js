// A transparent glyph model, not a filled silhouette. Coordinates use a 640 × 590 viewBox.
const ellipse = (x, y, cx, cy, rx, ry) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
const inTriangle = (x, y, a, b, c) => {
  const sign = (p, q) =>
    (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
  const d = [sign(a, b), sign(b, c), sign(c, a)];
  return d.every((v) => v >= 0) || d.every((v) => v <= 0);
};
export function catGlyphs() {
  const points = [];
  for (let y = 22; y < 570; y += 8)
    for (let x = 30; x < 620; x += 6) {
      const head = ellipse(x, y, 320, 349, 282, 210);
      const ear =
        inTriangle(x, y, [88, 280], [103, 28], [272, 193]) ||
        inTriangle(x, y, [387, 190], [551, 15], [554, 282]);
      if (head > 1 && !ear) continue;
      const leftEye = ellipse(x, y, 214, 308, 65, 33),
        rightEye = ellipse(x, y, 427, 304, 65, 33);
      if (leftEye < 1 || rightEye < 1) continue;
      const muzzle = ellipse(x, y, 320, 410, 125, 68);
      const nose = inTriangle(x, y, [287, 359], [353, 359], [320, 393]);
      let dark = nose || Math.abs(head - 0.94) < 0.035;
      // Curved forehead stripes and the bridge create relief without a solid surface.
      for (let j = 0; j < 3; j++)
        dark ||=
          Math.abs(y - (193 + j * 29 + 0.0018 * (x - 320) ** 2)) < 6 &&
          Math.abs(x - 320) < 142 - j * 13;
      dark ||= y > 260 && y < 355 && Math.abs(x - 320) < 19 + (y - 260) * 0.12;
      dark ||= leftEye < 1.4 || rightEye < 1.4;
      dark ||= Math.abs(muzzle - 1) < 0.12 && y > 405;
      dark ||= y > 390 && y < 431 && Math.abs(x - 320) < 5;
      for (let j = 0; j < 3; j++)
        dark ||=
          Math.abs(y - (370 + j * 28 + 0.15 * Math.abs(x - 320))) < 4 &&
          Math.abs(x - 320) > 110 &&
          Math.abs(x - 320) < 246;
      dark ||=
        Math.abs(y - (485 + 0.0019 * (x - 320) ** 2)) < 5 &&
        Math.abs(x - 320) < 154;
      const innerEar =
        inTriangle(x, y, [112, 226], [119, 74], [228, 195]) ||
        inTriangle(x, y, [419, 191], [533, 63], [532, 231]);
      dark ||= innerEar && Math.floor((x + y) / 16) % 3 === 0;
      const n = (x * 17 + y * 31) % 97;
      if (!dark && n % 4 === 0) continue;
      points.push({
        x,
        y,
        char: dark ? "@#8%0"[n % 5] : "01:;+".charAt(n % 5),
        color: dark ? "#064b0d" : n % 3 ? "#18d900" : "#79e969",
      });
    }
  return points;
}
export const eyes = [
  { x: 214, y: 307 },
  { x: 427, y: 303 },
];
export function catSvg() {
  const text = catGlyphs()
    .map(
      (p) => `<text x="${p.x}" y="${p.y}" fill="${p.color}">${p.char}</text>`,
    )
    .join("");
  const pupils = eyes
    .map(
      (p, i) =>
        `<g data-pupil="${i}">${Array.from({ length: 21 }, (_, n) => `<text x="${p.x + ((n % 3) - 1) * 6}" y="${p.y + (Math.floor(n / 3) - 3) * 6}" fill="#064b0d">${n % 2 ? "@" : "#"}</text>`).join("")}</g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 590" aria-hidden="true" focusable="false" font-family="monospace" font-size="9" text-anchor="middle">${text}${pupils}</svg>`;
}
