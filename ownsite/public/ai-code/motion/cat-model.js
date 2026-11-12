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
export const camera = { distance: 5, focal: 3.65, centerY: 0.23 };
export const lightDirection = normalize([-0.75, 0.85, 0.55]);
export const glyphAlphabet = ".·:;01+=*#@89";
export const eyes = [-1, 1].map((side) => ({
  x: side * 0.43,
  y: 0.16,
  z: 0.718,
}));
const materials = {
  fur: ["#0b3c29", "#468467"],
  stripe: ["#153f2d", "#348044"],
  innerEar: ["#13442f", "#658f76"],
  muzzle: ["#205a40", "#60927a"],
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
    if(typeof part === "function") part=part(a.p.map((v,k)=>(v+b.p[k]+c.p[k])/3));
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
      4,
      part,
      density,
    );
  }
  // One smooth implicit sculpt joins the skull, cheeks, whisker pads and chin.
  // Radial root-finding gives a closed surface, with no intersecting facial blobs.
  const volumes=[
    [[0,-.04,-.08],[.91,.71,.67]],
    [[-.63,-.16,.02],[.29,.34,.48]], [[.63,-.16,.02],[.29,.34,.48]],
    [[-.205,-.30,.60],[.30,.225,.31]], [[.205,-.30,.60],[.30,.225,.31]],
    [[0,-.53,.43],[.38,.19,.27]],
  ];
  const distance=(p,c,r)=>{
    const x=(p[0]-c[0])/r[0],y=(p[1]-c[1])/r[1],z=(p[2]-c[2])/r[2];
    const a=Math.sqrt(x*x+y*y+z*z);
    const b=Math.sqrt((x/r[0])**2+(y/r[1])**2+(z/r[2])**2);
    return b>1e-8?a*(a-1)/b:-Math.min(...r);
  };
  const field=p=>{
    let a=distance(p,...volumes[0]);
    for(let i=1;i<volumes.length;i++) {
      const b=distance(p,...volumes[i]);
      const h=Math.max(.13-Math.abs(a-b),0)/.13;
      a=Math.min(a,b)-h*h*.13*.25;
    }
    return a;
  };
  const sculpt=direction=>{
    let lo=0,hi=1.65;
    for(let i=0;i<20;i++) {
      const t=(lo+hi)/2;
      const p=direction.map((v,k)=>v*t+(k===1?-.04:0));
      if(field(p)<0) lo=t; else hi=t;
    }
    const p=direction.map((v,k)=>v*(lo+hi)/2+(k===1?-.04:0));
    const [x,y,z]=p;
    const front=Math.max(0,z)/.8;
    const bridge=.085*Math.exp(-((x/.17)**2)-((y-.02)/.31)**2);
    const socket=.095*Math.exp(-(((Math.abs(x)-.43)/.23)**2)-((y-.16)/.19)**2);
    p[2]+=(bridge-socket)*Math.min(1,front)**2;
    return p;
  };
  ellipsoid([0,0,0],[1,1,1],p=>p[1]<-.46&&Math.abs(p[0])<.42?"chin":p[1]<-.13&&Math.abs(p[0])<.5&&p[2]>.6?"muzzle":"head",1800,sculpt,40,72);
  // Curved, thick pinnae. Rounded tips, a recessed concha and rolled rims.
  for(const side of [-1,1]) {
    const ear=(u,t,back=false)=>{
      const a=2*u-1;
      return [side*(.57+.25*t+.25*a*(1-t)**.62),
        .30+.78*t-.15*a*(1-t),
        .09+.17*(1-t)-.20*(1-t)**3+(back?-.12*(1-t)**.45:
          .11*a*a*Math.sin(Math.PI*t)-.12*(1-a*a)*Math.sin(Math.PI*t))];
    };
    surface((u,t)=>ear(u,t),18,22,"ear",1700);
    surface((u,t)=>ear(u,t,true),18,22,"ear",1400,[side*.7,.7,.3]);
    surface((u,t)=>{
      const p=ear(.5+(u-.5)*.70,.12+t*.74);
      return [p[0],p[1],p[2]+.012];
    },14,22,"innerEar",2000);
    for(const edge of [0,1]) {
      surface((u,t)=>{
        const a=ear(edge,t),b=ear(edge,t,true);
        return a.map((n,k)=>n*(1-u)+b[k]*u);
      },3,28,"ear",1400);
      tube(t=>ear(edge,t),.022,"ear",34,2600);
    }
  }

  for(const e of eyes) {
    const side=Math.sign(e.x);
    const eyePoint=(u,v)=>[
      e.x+.285*u,
      e.y+.15*(1-u*u)**.65*v+.035*u*side,
      .50-.10*u*side+.16*(1-u*u)*Math.sqrt(Math.max(0,1-v*v))
    ];
    surface((u,v)=>eyePoint(u*2-1,v*2-1),32,28,"eye",2200);
    // The iris is a convex cap on the eyeball; its large area makes the gaze
    // readable at the landing page's real size. Pupils stay in front of it.
    ellipsoid([e.x,e.y,.65],[.163,.134,.044],"iris",2800,p=>p,18,28);
    ellipsoid([e.x,e.y,.70],[.060,.118,.018],"pupil",4800,p=>p,18,24);
    ellipsoid([e.x-.040,e.y+.048,.722],[.025,.029,.008],"glint",6000,p=>p,12,18);
    ellipsoid([e.x+.032,e.y-.052,.721],[.011,.015,.006],"glint",6000,p=>p,8,12);
    for(const upper of [-1,1]) tube(t=>{
      const p=eyePoint(t*2-1,upper); p[2]+=.018; return p;
    },upper>0?.019:.012,"lid",36,4200);
  }
  surface((u,v)=>{
    const x=(u*2-1)*.136*(1-v)**.75;
    return [x,-.145-v*.14,.965+.035*Math.sin(Math.PI*v)+.018*(1-(u*2-1)**2)];
  },20,22,"nose",4300);
  tube(t=>[0,-.285-t*.10,.97-.027*t],.012,"mouth",18,4200);
  for(const side of [-1,1]) {
    tube(t=>[side*(.005+.215*t),-.385-.018*Math.sin(Math.PI*t)+.06*t*t,.943-.045*t],.011,"mouth",28,4500);
    // Whisker follicles and long, smoothly curved whiskers emerge from pads.
    for(const row of [0,1]) for(const col of [0,1,2])
      ellipsoid([side*(.16+col*.068),-.265-row*.075,.918-col*.012],[.009,.009,.006],"mouth",5000,p=>p,6,8);
    for(const row of [-1.5,-.5,.5,1.5]) tube(t=>[
      side*(.31+1.03*t),-.31+row*.055+row*.095*t-.065*t*t,
      .91-.48*t-.14*t*t
    ],.004,"whisker",42,4000);
  }
  // Ray-sample the projected mesh, rather than orthographic XY coordinates:
  // regular screen-space code rows now agree with the perspective depth pass.
  const cells = new Map();
  const dx=4.8,dy=6.5;
  for(const triangle of triangles) {
    if(["whisker","mouth","lid"].includes(triangle.part)) continue;
    const v=triangle.vertices;
    const [a,b,c]=v.map(q=>projectPoint(q.p));
    const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(den)<1e-10) continue;
    const left=Math.ceil(Math.min(a.x,b.x,c.x)/dx),right=Math.floor(Math.max(a.x,b.x,c.x)/dx);
    const top=Math.ceil(Math.min(a.y,b.y,c.y)/dy),bottom=Math.floor(Math.max(a.y,b.y,c.y)/dy);
    for(let row=top;row<=bottom;row++) for(let col=left;col<=right;col++) {
      const x=col*dx,y=row*dy;
      const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
      const w=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;
      if(u<0||w<0||u+w>1) continue;
      const weights=[u/(camera.distance-a.z),w/(camera.distance-b.z),(1-u-w)/(camera.distance-c.z)];
      const total=weights.reduce((a,b)=>a+b,0);
      const bary=weights.map(q=>q/total);
      const p=[0,1,2].map(k=>v.reduce((sum,q,i)=>sum+q.p[k]*bary[i],0));
      const key=col+','+row;
      if(cells.has(key)&&cells.get(key).position[2]>=p[2]) continue;
      const normal=normalize([0,1,2].map(k=>v.reduce((sum,q,i)=>sum+q.n[k]*bary[i],0)));
      cells.set(key,{position:p,normal,part:triangle.part,row,col});
    }
  }
  const portrait=[];
  for(const cell of cells.values()) {
    const {position:p,normal,part,row,col}=cell;
    const ax=Math.abs(p[0]);
    const illumination=Math.max(0,normal.reduce((sum,v,k)=>sum+v*lightDirection[k],0));
    // M-shaped tabby marking, not a set of broad painted stripes.
    const stripe=part==="head"&&(
      (p[1]>.30&&p[1]<.64&&Math.abs(ax-(.08+(.64-p[1])*.55))<.025)||
      (ax>.66&&[-.02,-.19].some(y=>Math.abs(p[1]-y+(ax-.66)*.35)<.026))
    );
    const hash=Math.abs(Math.imul(row+104,374761393)^Math.imul(col+101,668265263))>>>0;
    const ramp=part==='pupil'?'@#8':part==='nose'?'08@':stripe?'08':part==='iris'?'0*+':part==='eye'?'.:':part==='glint'?'@':part==='innerEar'?':;01':illumination>.7?'.:;':illumination>.35?':;10':'08*';
    const color=part==='pupil'?'#003521':part==='glint'?'#ffffff':part==='iris'?'#367554':part==='eye'?'#759786':part==='nose'||stripe?'#003b27':shade(normal,part==='chin'?'muzzle':materials[part]?part:'fur');
    const tangentNormal=normalize([normal[0]*.3,normal[1]*.3,Math.max(.5,normal[2])]);
    portrait.push({position:p,normal,tangentNormal,part,char:ramp[hash%ramp.length],color,
      size:part==='pupil'?1.12:part==='glint'?1.2:part==='iris'?1.02:.88});
  }
  // Sub-grid curves keep eyelids, whiskers and the mouth smooth and connected.
  portrait.push(...glyphs.filter(g=>["whisker","mouth","lid"].includes(g.part)).map(g=>({...g,color:'#164b32',size:g.part==='lid'?.85:.7})));
  // The rear and grazing-angle surfaces retain code too, so turning the
  // head reveals an actual covered volume rather than the edge of a portrait.
  portrait.push(...glyphs.filter(g => g.normal[2] < .25 && g.position[2] < .5 && !["whisker","mouth","lid"].includes(g.part)));
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
    const tangent = g.tangentNormal || g.normal;
    const reference = Math.abs(tangent[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0];
    const right = normalize(cross(reference, tangent)),
      up = cross(tangent, right);
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
