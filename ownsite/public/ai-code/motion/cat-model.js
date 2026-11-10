// Actual triangle geometry in model space. No painted silhouette or opaque face texture.
// The neutral SVG fallback is projected from this same mesh and surface samples.
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const normalize = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};
export const camera = { distance: 5, focal: 3.6, centerY: 0.22 };
export const eyes = [
  { x: -0.46, y: 0.1, z: 0.76 },
  { x: 0.46, y: 0.1, z: 0.76 },
];
let cached;
export function createCatModel() {
  if (cached) return cached;
  const triangles = [],
    glyphs = [];
  let seed = 481;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  function triangle(a, b, c, part, density = 430) {
    const normal = normalize(cross(sub(b.p, a.p), sub(c.p, a.p)));
    const area = Math.hypot(...cross(sub(b.p, a.p), sub(c.p, a.p))) / 2;
    triangles.push({ vertices: [a, b, c], part });
    const count = area * density * 2.0;
    const n = Math.floor(count) + (random() < count % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const u = Math.sqrt(random()),
        v = random(),
        w = [1 - u, u * (1 - v), u * v];
      const p = [0, 1, 2].map(
        (k) => a.p[k] * w[0] + b.p[k] * w[1] + c.p[k] * w[2],
      );
      const norm = normalize(
        [0, 1, 2].map(
          (k) =>
            (a.n || normal)[k] * w[0] +
            (b.n || normal)[k] * w[1] +
            (c.n || normal)[k] * w[2],
        ),
      );
      const light = Math.max(
        0,
        norm[0] * -0.45 + norm[1] * 0.6 + norm[2] * 0.7,
      );
      const stripe =
        part === "head" &&
        ((Math.abs(Math.sin(p[1] * 19 + p[0] * p[0] * 4)) < 0.23 &&
          p[1] > 0.22) ||
          (Math.abs(p[0]) > 0.65 &&
            Math.abs(Math.sin(p[1] * 21 + Math.abs(p[0]) * 5)) < 0.25));
      const dark = ["pupil", "nose", "mouth"].includes(part) || stripe;
      const ramp = dark
        ? "@#8"
        : light > 0.7
          ? "01:"
          : light > 0.35
            ? "+*0"
            : "@#8";
      const shade = dark
        ? "#064509"
        : light > 0.65
          ? "#1de100"
          : light > 0.25
            ? "#139c0b"
            : "#085213";
      glyphs.push({
        position: p,
        normal: norm,
        char: ramp[Math.floor(random() * ramp.length)],
        color: shade,
        part,
      });
    }
  }
  function ellipsoid(
    center,
    radius,
    part,
    density = 430,
    rows = 26,
    cols = 48,
  ) {
    const point = (i, j) => {
      const t = (i / rows) * Math.PI,
        f = (j / cols) * Math.PI * 2;
      const n = [
        Math.sin(t) * Math.cos(f),
        Math.cos(t),
        Math.sin(t) * Math.sin(f),
      ];
      return {
        p: n.map((v, k) => center[k] + v * radius[k]),
        n: normalize(n.map((v, k) => v / radius[k])),
      };
    };
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        const a = point(i, j),
          b = point(i + 1, j),
          c = point(i + 1, j + 1),
          d = point(i, j + 1);
        triangle(a, b, c, part, density);
        triangle(a, c, d, part, density);
      }
  }
  function subdivide(a, b, c, part, n = 16, center = [0, 0, 0]) {
    let normal = normalize(cross(sub(b, a), sub(c, a)));
    const outward = a.map((v, k) => (v + b[k] + c[k]) / 3 - center[k]);
    if (normal.reduce((sum, v, k) => sum + v * outward[k], 0) < 0)
      normal = normal.map((v) => -v);
    const point = (i, j) => ({
      p: a.map((v, k) => v + ((b[k] - v) * i) / n + ((c[k] - v) * j) / n),
      n: normal,
    });
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n - i; j++) {
        triangle(point(i, j), point(i + 1, j), point(i, j + 1), part, 600);
        if (i + j < n - 1)
          triangle(
            point(i + 1, j),
            point(i + 1, j + 1),
            point(i, j + 1),
            part,
            600,
          );
      }
  }
  ellipsoid([0, -0.04, 0], [1.08, 0.88, 0.65], "head");
  // Ears have front, back and side faces, not screen-space triangles.
  for (const side of [-1, 1]) {
    const a = [side * 0.98, 1.4, -0.02],
      b = [side * 1.01, 0.38, 0.02],
      c = [side * 0.34, 0.62, 0.24],
      back = [side * 0.77, 0.72, -0.28];
    subdivide(a, b, c, "ear", 16, [side * 0.77, 0.78, -0.02]);
    subdivide(a, c, back, "ear", 16, [side * 0.77, 0.78, -0.02]);
    subdivide(a, back, b, "ear", 16, [side * 0.77, 0.78, -0.02]);
    subdivide(b, back, c, "ear", 16, [side * 0.77, 0.78, -0.02]);
  }
  ellipsoid([0, -0.61, 0.3], [0.62, 0.31, 0.48], "chin", 350);
  ellipsoid([-0.28, -0.34, 0.57], [0.43, 0.3, 0.37], "muzzle", 500);
  ellipsoid([0.28, -0.34, 0.57], [0.43, 0.3, 0.37], "muzzle", 500);
  for (const e of eyes) {
    ellipsoid([e.x, e.y, 0.56], [0.32, 0.205, 0.205], "eye", 110);
    ellipsoid([e.x, e.y, e.z], [0.048, 0.14, 0.026], "pupil", 1700, 18, 24);
  }
  // A raised nose wedge and narrow mouth tubes sit in front of the muzzle.
  subdivide(
    [-0.14, -0.2, 0.96],
    [0.14, -0.2, 0.96],
    [0, -0.36, 1.035],
    "nose",
    8,
  );
  subdivide([-0.14, -0.2, 0.96], [0, -0.36, 1.035], [0, -0.2, 0.82], "nose", 8);
  subdivide([0.14, -0.2, 0.96], [0, -0.2, 0.82], [0, -0.36, 1.035], "nose", 8);
  ellipsoid([0, -0.4, 0.94], [0.018, 0.095, 0.02], "mouth", 1400, 12, 12);
  for (const side of [-1, 1])
    for (let i = 0; i < 9; i++) {
      const x = side * (0.025 + i * 0.022),
        y = -0.47 + 0.055 * (i / 8) ** 2;
      ellipsoid([x, y, 0.91], [0.025, 0.014, 0.018], "mouth", 1100, 6, 8);
    }
  cached = {
    triangles,
    glyphs,
    material: { transparent: true, opacity: 0, depthWrite: true },
    atlas: { transparent: true },
  };
  return cached;
}
export function transformPoint(p, yaw = 0, pitch = 0) {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cx = Math.cos(pitch),
    sx = Math.sin(pitch);
  const x = p[0] * cy + p[2] * sy,
    z = -p[0] * sy + p[2] * cy;
  return [x, p[1] * cx - z * sx, p[1] * sx + z * cx];
}
export function projectPoint(p, width = 640, height = 590) {
  const d = camera.distance - p[2],
    scale = (height * 0.5 * camera.focal) / d;
  return {
    x: width / 2 + p[0] * scale,
    y: height / 2 - (p[1] - camera.centerY) * scale,
    z: p[2],
    scale,
  };
}
export function catGlyphs() {
  const model = createCatModel(),
    width = 320,
    height = 295,
    depth = new Float32Array(width * height).fill(-Infinity);
  // A small software depth buffer gives the no-WebGL fallback the same occlusion as the mesh.
  for (const triangle of model.triangles) {
    const p = triangle.vertices.map((v) => projectPoint(v.p, width, height));
    const minX = Math.max(0, Math.floor(Math.min(...p.map((v) => v.x)))),
      maxX = Math.min(width - 1, Math.ceil(Math.max(...p.map((v) => v.x))));
    const minY = Math.max(0, Math.floor(Math.min(...p.map((v) => v.y)))),
      maxY = Math.min(height - 1, Math.ceil(Math.max(...p.map((v) => v.y))));
    const [a, b, c] = p,
      den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(den) < 1e-8) continue;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / den,
          v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / den,
          w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const z = a.z * u + b.z * v + c.z * w;
        depth[y * width + x] = Math.max(depth[y * width + x], z);
      }
  }
  return model.glyphs.flatMap((g) => {
    const p = projectPoint(g.position, width, height),
      x = Math.round(p.x),
      y = Math.round(p.y);
    if (
      x < 0 ||
      x >= width ||
      y < 0 ||
      y >= height ||
      p.z < depth[y * width + x] - 0.035
    )
      return [];
    return [
      {
        x: p.x * 2,
        y: p.y * 2,
        char: g.char,
        color: g.color,
        part: g.part,
        z: g.position[2],
      },
    ];
  });
}
export function catSvg() {
  const points = catGlyphs();
  const text = points
    .filter((p) => p.part !== "pupil")
    .map(
      (p) =>
        `<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" fill="${p.color}">${p.char}</text>`,
    )
    .join("");
  const pupils = eyes
    .map(
      (_, i) =>
        `<g data-pupil="${i}">${points
          .filter(
            (p) => p.part === "pupil" && (i === 0 ? p.x < 320 : p.x >= 320),
          )
          .map(
            (p) =>
              `<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" fill="${p.color}">${p.char}</text>`,
          )
          .join("")}</g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 590" aria-hidden="true" focusable="false" font-family="monospace" font-size="7.5" text-anchor="middle">${text}${pupils}</svg>`;
}
