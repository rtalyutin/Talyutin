// Sculpted triangle surfaces carry the code particles in world space.
// WebGL and the static SVG share geometry, materials, lighting and occlusion.
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const normalize = (v) => {
  const length = Math.hypot(...v) || 1;
  return v.map((x) => x / length);
};
const clamp = (v, low = 0, high = 1) => Math.min(high, Math.max(low, v));
export const camera = { distance: 5, focal: 3.35, centerY: 0.16 };
export const lightDirection = normalize([-0.75, 0.85, 0.55]);
export const glyphAlphabet = ".·:;01+=*#@89";
export const eyes = [-1, 1].map((side) => ({
  x: side * 0.455,
  y: 0.30,
  z: 0.875,
}));
const materials = {
  fur: ["#123f2c", "#57a146"],
  stripe: ["#153f2d", "#348044"],
  innerEar: ["#164a32", "#3d8150"],
  muzzle: ["#286947", "#88c967"],
  eye: ["#699b47", "#b2d982"],
  iris: ["#347844", "#7ebc4f"],
  pupil: ["#103b2a", "#194b32"],
  nose: ["#103b2a", "#2e7144"],
  mouth: ["#164b32", "#28613c"],
  lid: ["#123b2a", "#245e36"],
  whisker: ["#367a49", "#84b466"],
  glint: ["#c5e6a2", "#ebf7d5"],
};
function shade(normal, material) {
  const amount =
    Math.max(
      0,
      normal.reduce((sum, v, i) => sum + v * lightDirection[i], 0),
    ) ** 0.8;
  const [dark, light] = materials[material];
  const rgb = [1, 3, 5].map((i) =>
    Math.round(
      parseInt(dark.slice(i, i + 2), 16) * (1 - amount) +
        parseInt(light.slice(i, i + 2), 16) * amount,
    ),
  );
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
let cached;
export function createCatModel() {
  if (cached) return cached;
  const triangles = [],
    glyphs = [],
    samples = new Map();
  let seed = 481;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // A small exclusion radius keeps the code legible instead of forming clumps.
  function separated(p, part, spacing) {
    if (!samples.has(part)) samples.set(part, new Map());
    const grid = samples.get(part),
      radius2 = spacing * spacing;
    const key =
      Math.floor(p[0] / spacing) +
      128 +
      (Math.floor(p[1] / spacing) + 128) * 256 +
      (Math.floor(p[2] / spacing) + 128) * 65536;
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const bucket = grid.get(key + x + y * 256 + z * 65536);
          if (bucket)
            for (const q of bucket) {
              const dx = p[0] - q[0],
                dy = p[1] - q[1],
                dz = p[2] - q[2];
              if (dx * dx + dy * dy + dz * dz < radius2) return false;
            }
        }
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
    return true;
  }
  function triangle(a, b, c, part, density = 1600) {
    const face = cross(sub(b.p, a.p), sub(c.p, a.p));
    const area = Math.hypot(...face) / 2;
    if (area < 1e-9) return;
    const normal = normalize(face);
    triangles.push({ vertices: [a, b, c], part });
    const count = area * density;
    const n = Math.floor(count) + (random() < count % 1 ? 1 : 0);
    const offset = random();
    for (let i = 0; i < n; i++) {
      const u = Math.sqrt((i + random()) / n),
        v = (offset + i * 0.61803398875) % 1;
      const weights = [1 - u, u * (1 - v), u * v];
      const p = [0, 1, 2].map(
        (k) => a.p[k] * weights[0] + b.p[k] * weights[1] + c.p[k] * weights[2],
      );
      const norm = normalize(
        [0, 1, 2].map(
          (k) =>
            (a.n || normal)[k] * weights[0] +
            (b.n || normal)[k] * weights[1] +
            (c.n || normal)[k] * weights[2],
        ),
      );
      const fine = [
        "pupil",
        "mouth",
        "nose",
        "lid",
        "whisker",
        "glint",
      ].includes(part);
      if (!separated(p, part, fine ? 0.014 : 0.025)) continue;
      // Three tapered forehead marks and two short cheek marks, following the skull.
      const ax = Math.abs(p[0]);
      const forehead =
        p[2] > 0.25 &&
        p[1] > 0.4 &&
        p[1] < 0.76 &&
        Math.abs(ax - (0.19 + (0.74 - p[1]) * 0.42)) < 0.028 * (p[1] / 0.76);
      const centerMark = p[2] > 0.3 && p[1] > 0.48 && p[1] < 0.8 && ax < 0.025;
      const cheekMark =
        ax > 0.81 &&
        p[2] > 0.13 &&
        p[2] < 0.53 &&
        [0.01, -0.15].some(
          (y) => Math.abs(p[1] - y + (ax - 0.8) * 0.38) < 0.019,
        );
      const stripe = part === "head" && (forehead || centerMark || cheekMark);
      const material = stripe
        ? "stripe"
        : materials[part]
          ? part
          : part === "chin"
            ? "muzzle"
            : "fur";
      const illumination = Math.max(
        0,
        norm.reduce((sum, v, k) => sum + v * lightDirection[k], 0),
      );
      const ramp = ["pupil", "nose", "mouth", "lid"].includes(part)
        ? "0#@"
        : part === "whisker"
          ? ":="
          : stripe
            ? "0#*"
            : illumination > 0.75
              ? "01:"
              : illumination > 0.45
                ? "01+="
                : illumination > 0.22
                  ? "0*#"
                  : "#@8";
      glyphs.push({
        position: p,
        normal: norm,
        char: ramp[Math.floor(random() * ramp.length)],
        color: shade(norm, material),
        part,
        size: fine ? 1 : 1.12 + (1 - illumination) * 0.16,
      });
    }
  }
  // Parametric patches use smooth surface normals, including on curved ears.
  function surface(fn, rows, cols, part, density = 1600, outward = null) {
    const point = (u, v) => {
      const p = fn(u, v),
        delta = 0.0001;
      let n = normalize(
        cross(
          sub(fn(clamp(u + delta), v), fn(clamp(u - delta), v)),
          sub(fn(u, clamp(v + delta)), fn(u, clamp(v - delta))),
        ),
      );
      const direction = outward ? sub(p, outward) : [0, 0, 1];
      if (n.reduce((sum, x, k) => sum + x * direction[k], 0) < 0)
        n = n.map((x) => -x);
      return { p, n };
    };
    const grid = Array.from({ length: rows + 1 }, (_, i) =>
      Array.from({ length: cols + 1 }, (_, j) => point(i / rows, j / cols)),
    );
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        triangle(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], part, density);
        triangle(grid[i][j], grid[i + 1][j + 1], grid[i][j + 1], part, density);
      }
  }
  function ellipsoid(
    center,
    radius,
    part,
    density = 1600,
    deform = (p) => p,
    rows = 22,
    cols = 40,
  ) {
    surface(
      (u, v) => {
        const t = u * Math.PI,
          f = v * Math.PI * 2;
        return deform(
          [
            Math.sin(t) * Math.cos(f),
            Math.cos(t),
            Math.sin(t) * Math.sin(f),
          ].map((n, k) => center[k] + n * radius[k]),
        );
      },
      rows,
      cols,
      part,
      density,
      center,
    );
  }
  function tube(fn, radius, part, segments = 30, density = 3000) {
    surface(
      (u, v) => {
        const p = fn(u),
          tangent = normalize(
            sub(fn(Math.min(1, u + 0.001)), fn(Math.max(0, u - 0.001))),
          );
        const a = normalize(cross(tangent, [0, 0, 1])),
          b = cross(tangent, a),
          angle = v * Math.PI * 2;
        const r = radius * (0.55 + 0.45 * Math.sin(Math.PI * u));
        return p.map(
          (x, k) => x + r * (a[k] * Math.cos(angle) + b[k] * Math.sin(angle)),
        );
      },
      segments,
      6,
      part,
      density,
    );
  }
  ellipsoid(
    [0, -0.10, -0.04],
    [0.94, 0.98, 0.71],
    "head",
    1800,
    (p) => {
      const [x, y, z] = p,
        front = Math.max(0, z + 0.04) / 0.71;
      const bridge =
        0.13 * Math.exp(-((x / 0.22) ** 2) - ((y - 0.07) / 0.43) ** 2);
      const socket =
        0.075 *
        Math.exp(
          -(((Math.abs(x) - 0.455) / 0.28) ** 2) - ((y - 0.12) / 0.22) ** 2,
        );
      return [
        x * (1 + 0.065 * Math.exp(-(((y + 0.16) / 0.36) ** 2))),
        y,
        z + (bridge - socket) * front ** 3,
      ];
    },
    34,
    64,
  );
  for (const side of [-1, 1]) {
    const ear = (u, t, back = false) => {
      const a = u * 2 - 1;
      return [
        side *
          ((0.71 + 0.33 * a) * (1 - t) +
            0.94 * t +
            0.035 * a * Math.sin(Math.PI * t)),
        0.43 + 0.99 * t - 0.12 * a * (1 - t),
        0.11 * (1 - t) -
          0.045 * t +
          (back ? -0.19 * (1 - t) : 0.12 * Math.sin(Math.PI * t) * (1 - a * a)),
      ];
    };
    surface((u, t) => ear(u, t), 18, 24, "ear", 1700);
    surface((u, t) => ear(u, t, true), 18, 24, "ear", 1400, [
      side * 0.78,
      0.7,
      0.2,
    ]);
    surface(
      (u, t) => {
        const p = ear(0.5 + (u - 0.5) * 0.7 * (1 - t), 0.13 + t * 0.72);
        return [p[0], p[1], p[2] + 0.012];
      },
      14,
      22,
      "innerEar",
      2200,
    );
    for (const edge of [0, 1])
      surface(
        (u, t) => {
          const a = ear(edge, t),
            b = ear(edge, t, true);
          return a.map((v, k) => v * (1 - u) + b[k] * u);
        },
        3,
        24,
        "ear",
        1500,
      );
  }
  ellipsoid([0, -0.76, 0.31], [0.47, 0.30, 0.39], "chin", 1500);
  for (const side of [-1, 1])
    ellipsoid(
      [side * 0.235, -0.19, 0.565],
      [0.365, 0.255, 0.335],
      "muzzle",
      1800,
    );
  for (const e of eyes) {
    const side = Math.sign(e.x);
    const eyePoint = (u, v) => [
      e.x + 0.255 * u,
      e.y + 0.145 * (1 - u * u) ** 0.7 * v + 0.038 * u * side,
      0.65 -
        0.125 * u * side +
        0.172 * (1 - u * u) * Math.sqrt(Math.max(0, 1 - v * v)),
    ];
    surface((u, v) => eyePoint(u * 2 - 1, v * 2 - 1), 28, 20, "eye", 2400);
    ellipsoid(
      [e.x, e.y, 0.805],
      [0.082, 0.132, 0.04],
      "iris",
      2400,
      (p) => p,
      18,
      28,
    );
    ellipsoid(
      [e.x, e.y, e.z - 0.026],
      [0.029, 0.109, 0.026],
      "pupil",
      4800,
      (p) => p,
      18,
      24,
    );
    ellipsoid(
      [e.x - 0.018, e.y + 0.054, e.z + 0.003],
      [0.014, 0.022, 0.009],
      "glint",
      6000,
      (p) => p,
      8,
      12,
    );
    for (const upper of [-1, 1])
      tube(
        (t) => {
          const p = eyePoint(t * 2 - 1, upper);
          p[2] += 0.012;
          return p;
        },
        upper > 0 ? 0.013 : 0.009,
        "lid",
        30,
        4000,
      );
  }
  // Softly convex triangular nose: the philtrum and smile follow the muzzle.
  surface(
    (u, v) => {
      const width = 0.125 * (1 - v),
        x = (u * 2 - 1) * width;
      return [
        x,
        -0.04 - v * 0.145,
        0.935 + 0.045 * Math.sin(Math.PI * v) + 0.015 * (1 - (u * 2 - 1) ** 2),
      ];
    },
    16,
    16,
    "nose",
    4300,
  );
  tube(
    (t) => [0, -0.18 - t * 0.1, 0.935 - t * 0.018],
    0.012,
    "mouth",
    12,
    4200,
  );
  for (const side of [-1, 1]) {
    tube(
      (t) => [
        side * (0.005 + t * 0.2),
        -0.28 - 0.018 * Math.sin(t * Math.PI) + 0.045 * t * t,
        0.916 - t * 0.032,
      ],
      0.01,
      "mouth",
      22,
      4500,
    );
    for (const row of [-1, 0, 1])
      tube(
        (t) => [
          side * (0.5 + 0.77 * t),
          -0.20 + row * 0.075 + (row * 0.095 + 0.025) * t - 0.055 * t * t,
          0.86 - 0.42 * t - 0.12 * t * t,
        ],
        0.0055,
        "whisker",
        30,
        3500,
      );
  }
  // Sample the visible sculpt on a regular code grid. Each glyph retains its
  // world-space position, so the portrait still has real parallax and occlusion.
  // Upright characters and deliberate whitespace reproduce the reference's rows.
  const cells = new Map();
  const dx = 0.027, dy = 0.036;
  for (const triangle of triangles) {
    if (triangle.part === "whisker") continue;
    const [a,b,c] = triangle.vertices;
    const den = (b.p[1]-c.p[1])*(a.p[0]-c.p[0])+(c.p[0]-b.p[0])*(a.p[1]-c.p[1]);
    if (Math.abs(den) < 1e-10) continue;
    const left = Math.ceil(Math.min(a.p[0],b.p[0],c.p[0])/dx);
    const right = Math.floor(Math.max(a.p[0],b.p[0],c.p[0])/dx);
    const bottom = Math.ceil(Math.min(a.p[1],b.p[1],c.p[1])/dy);
    const top = Math.floor(Math.max(a.p[1],b.p[1],c.p[1])/dy);
    for(let row=bottom;row<=top;row++) for(let col=left;col<=right;col++) {
      const x=col*dx,y=row*dy;
      const u=((b.p[1]-c.p[1])*(x-c.p[0])+(c.p[0]-b.p[0])*(y-c.p[1]))/den;
      const v=((c.p[1]-a.p[1])*(x-c.p[0])+(a.p[0]-c.p[0])*(y-c.p[1]))/den;
      const w=1-u-v;
      if(u<0||v<0||w<0) continue;
      const z=a.p[2]*u+b.p[2]*v+c.p[2]*w;
      const key=col+','+row;
      if(cells.has(key)&&cells.get(key).position[2]>=z) continue;
      const n=normalize(a.n.map((value,k)=>value*u+b.n[k]*v+c.n[k]*w));
      cells.set(key,{position:[x,y,z], normal:n, part:triangle.part, row,col});
    }
  }
  const portrait = [];
  for(const cell of cells.values()) {
    const {position:p,part,row,col}=cell;
    const ax=Math.abs(p[0]);
    const feature=["pupil","lid","nose","mouth","iris"].includes(part);
    const stripe=part==="head" && (
      (p[1]>.4 && p[1]<.85 && (ax<.045 || Math.abs(ax-(.16+(.8-p[1])*.42))<.05)) ||
      (ax>.6 && [-.02,-.19,-.36].some(y=>Math.abs(p[1]-y+(ax-.65)*.22)<.025))
    );
    const hash=Math.abs(Math.imul(row+104,374761393)^Math.imul(col+101,668265263))>>>0;
    const ramp=feature?'08@0':stripe?'09@8':part==='eye'?'.:·':p[1]<-.50?'.·:':part==='innerEar'?'.:;1':'.:;:01';
    if(part==='glint') continue;
    portrait.push({position:p,normal:[0,0,1],part,
      char:ramp[hash%ramp.length], color:feature||stripe?'#003c27':part==='eye'?'#59806a':'#19553b',
      size: feature?1.06:1.02});
  }
  // Fine whiskers and mouth contours need sub-grid sampling.
  portrait.push(...glyphs.filter(g=>["whisker","mouth","lid"].includes(g.part)).map(g=>({...g,color:'#164b32',size:0.7})));
  cached = {
    triangles,
    glyphs: portrait,
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
    width = 640,
    height = 590,
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
    const lifted = g.position.map((v, k) => v + g.normal[k] * 0.009);
    const p = projectPoint(lifted, width, height),
      x = Math.round(p.x),
      y = Math.round(p.y);
    if (
      x < 0 ||
      x >= width ||
      y < 0 ||
      y >= height ||
      p.z < depth[y * width + x] - 0.008
    )
      return [];
    const reference = Math.abs(g.normal[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0];
    const right = normalize(cross(reference, g.normal)),
      up = cross(g.normal, right);
    const horizontal = projectPoint(
      lifted.map((v, k) => v + (right[k] * g.size) / 240),
      width,
      height,
    );
    const vertical = projectPoint(
      lifted.map((v, k) => v - (up[k] * g.size) / 240),
      width,
      height,
    );
    return [
      {
        x: p.x,
        y: p.y,
        matrix: [
          horizontal.x - p.x,
          horizontal.y - p.y,
          vertical.x - p.x,
          vertical.y - p.y,
          p.x,
          p.y,
        ],
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
  const moving = (p) => ["pupil", "iris", "glint"].includes(p.part);
  const text = (p) =>
    `<text transform="matrix(${p.matrix.map((v) => v.toFixed(3)).join(" ")})" fill="${p.color}">${p.char}</text>`;
  const surface = points
    .filter((p) => !moving(p))
    .map(text)
    .join("");
  const pupils = eyes
    .map(
      (_, i) =>
        `<g data-pupil="${i}">${points
          .filter((p) => moving(p) && (i === 0 ? p.x < 320 : p.x >= 320))
          .map(text)
          .join("")}</g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 590" aria-hidden="true" focusable="false" font-family="monospace" font-size="7.5" font-weight="bold" text-anchor="middle" dominant-baseline="central">${surface}${pupils}</svg>`;
}
