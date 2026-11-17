// Perspective code streams and a sampled silhouette of the real, laid-out UI.
// No screenshot service, duplicated copy, external library or remote font.
const letters = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン012345789:<>+=';
export const clamp = value => Math.max(0, Math.min(1, value));
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const visible = el => {
  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !el.closest('[hidden],script,canvas');
};
export function sampleInterface(root) {
  const box = root.getBoundingClientRect();
  const mask = document.createElement('canvas');
  mask.width = Math.ceil(box.width); mask.height = Math.ceil(box.height);
  const ink = mask.getContext('2d', { willReadFrequently: true });
  if (!ink) throw new Error('2D canvas unavailable');
  const all = [...root.querySelectorAll('*')].filter(el => !el.closest('#cat') && visible(el));
  const atomSelector = 'h1,h2,h3,h4,p,a,button,summary,dt,dd,.number,.frame-corner';
  const atoms = all.filter(el => el.matches(atomSelector) && !el.parentElement.closest(atomSelector));
  const surfaces = [];
  // Border lines, underlines, button fills, menu bars, frames and CSS icons.
  for (const el of [root, ...all]) {
    if (el.closest('#cat')) continue;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    const x = r.left - box.left, y = r.top - box.top;
    if (el.matches('.button,.mobile-menu summary span')) {
      ink.fillStyle = s.backgroundColor;
      ink.fillRect(x, y, r.width, r.height);
    }
    const borders = [['Top',x,y,r.width,0],['Right',x+r.width,y,0,r.height],['Bottom',x,y+r.height,r.width,0],['Left',x,y,0,r.height]];
    let hasBorder = false;
    for (const [side,bx,by,bw,bh] of borders) {
      const size = parseFloat(s[`border${side}Width`]);
      if (!size || s[`border${side}Style`] === 'none') continue;
      ink.fillStyle = s[`border${side}Color`];
      ink.fillRect(bx-(side==='Right'?size:0),by-(side==='Bottom'?size:0),bw||size,bh||size);
      hasBorder = true;
    }
    if (hasBorder && !atoms.some(atom=>atom===el||atom.contains(el))) surfaces.push(el);
    if (el.matches('.steps li')) {
      if (!surfaces.includes(el)) surfaces.push(el);
      ink.font='11px monospace';ink.fillStyle=s.color;
      ink.fillText(String([...el.parentElement.children].indexOf(el)+1).padStart(2,'0'),x,y+31);
    }
    if (el.matches('.arrow')) {
      ink.strokeStyle = s.color; ink.lineWidth = 1.5;
      ink.beginPath();ink.moveTo(x+2,y+r.height-3);ink.lineTo(x+r.width-2,y+3);
      ink.moveTo(x+r.width*.35,y+3);ink.lineTo(x+r.width-2,y+3);ink.lineTo(x+r.width-2,y+r.height*.65);ink.stroke();
    }
    if (el.matches('.plus')) {
      ink.strokeStyle = s.color;ink.lineWidth=1;ink.beginPath();
      ink.arc(x+r.width/2,y+r.height/2,11,0,Math.PI*2);ink.moveTo(x+8,y+12);ink.lineTo(x+16,y+12);
      if (!el.closest('details[open]')) { ink.moveTo(x+12,y+8);ink.lineTo(x+12,y+16); }
      ink.stroke();
    }
    if (el.matches('.headline-key')) {
      ink.fillStyle = s.textDecorationColor;
      ink.fillRect(x,y+r.height-2,r.width,Math.max(3,parseFloat(s.fontSize)*.12));
    }
  }
  // Actual character ranges preserve wrapping, Cyrillic, type size and alignment.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!node.data.trim() || !visible(parent) || parent.closest('#cat,script,style,canvas')) continue;
    if (!atoms.some(atom => atom === parent || atom.contains(parent))) atoms.push(parent);
    const style = getComputedStyle(parent), size = parseFloat(style.fontSize);
    ink.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    ink.textBaseline = 'alphabetic'; ink.fillStyle = style.color;
    for (let i=0; i<node.length; i++) {
      if (!node.data[i].trim()) continue;
      const range = document.createRange(); range.setStart(node,i);range.setEnd(node,i+1);
      const r = range.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      ink.fillText(node.data[i],r.left-box.left,r.top-box.top+(r.height-size)/2+size*.8);
    }
  }
  // The poster is generated from the live mesh. Sample its actual silhouette so
  // falling code lands on the eyes, ear tips and whiskers seen in the next frame.
  const cat = root.querySelector('#cat');
  if (cat) {
    const poster = cat.querySelector('img');
    if (poster.complete && poster.naturalWidth) {
      const rect = poster.getBoundingClientRect();
      ink.drawImage(poster, rect.left-box.left, rect.top-box.top, rect.width, rect.height);
      atoms.push(cat);
    }
  }
  const data=ink.getImageData(0,0,mask.width,mask.height).data;
  const points = [];
  const cell = innerWidth < 700 ? 11 : 13;
  // Align the sampling lattice with the falling columns, including partially
  // visible sections and the thin outlines between two letter centres.
  const firstX = Math.max(0, Math.floor(box.left / cell));
  const firstY = Math.max(0, Math.floor(box.top / cell));
  const lastX = Math.ceil(Math.min(innerWidth, box.right) / cell);
  const lastY = Math.ceil(Math.min(innerHeight, box.bottom) / cell);
  for (let row = firstY; row < lastY; row++) {
    const top = Math.max(0, Math.ceil(row * cell - box.top));
    const bottom = Math.min(mask.height, Math.ceil((row + 1) * cell - box.top));
    for (let column = firstX; column < lastX; column++) {
      const left = Math.max(0, Math.ceil(column * cell - box.left));
      const right = Math.min(mask.width, Math.ceil((column + 1) * cell - box.left));
      let found = false;
      for (let y = top; y < bottom && !found; y++) {
        for (let x = left; x < right; x++) {
          const i = (y * mask.width + x) * 4;
          if (data[i+3] <= 60) continue;
          const glyph = Math.floor(hash(column * 19 + row * 7) * letters.length);
          points.push({x, y, column, letter: letters[glyph], glyph,
            color: 'rgb(' + data[i] + ',' + data[i+1] + ',' + data[i+2] + ')'});
          found = true;
          break;
        }
      }
    }
  }
  return {points, atoms, surfaces};
}
// A drop is emitted above the viewport, falls in its column, then is captured.
// There is no second particle system moving toward silhouettes from the side.
export function dropPosition(drop, elapsed) {
  const age=elapsed-drop.born;
  if(age<0)return null;
  const y=Math.min(drop.target.y,drop.from+age*drop.speed);
  const captured=y>=drop.target.y;
  const dock=clamp(1-(drop.target.y-y)/18);
  return {x:drop.x+(drop.target.x-drop.x)*dock,y,captured};
}
// Each ribbon is a travelling light on a stationary grid. A glyph keeps its
// address as the head passes it. Only the head and occasional tail cells flip.
export function makeStreams(width, height) {
  const scale = width < 700 ? .89 : 1;
  const planes = [
    {size: 10, pitch: 31, speed: 9, opacity: .38},
    {size: 14, pitch: 34, speed: 14, opacity: .70},
    {size: 18, pitch: 39, speed: 19, opacity: 1},
  ];
  return planes.flatMap((plane, depth) => {
    const pitch = plane.pitch * scale;
    const size = Math.round(plane.size * scale);
    const step = Math.round(size * 1.12);
    const rows = Math.ceil(height / step);
    return Array.from({length: Math.ceil(width / pitch)}, (_, column) => {
      const seed = 1 + column * 113 + depth * 641;
      const length = 7 + Math.floor(hash(seed + 1) * 18);
      const gap = 4 + Math.floor(hash(seed + 2) * 20);
      const period = rows + length + gap;
      return {
        x: Math.round((column + .17 + hash(seed + 3) * .66) * pitch),
        size, step, rows, length, period, seed, opacity: plane.opacity,
        phase: hash(seed + 4) * period,
        rate: plane.speed * (.7 + hash(seed + 5) * .85) / 1000,
      };
    });
  });
}

export function streamHead(stream, time) {
  const travel = stream.phase + time * stream.rate;
  const cycle = Math.floor(travel / stream.period);
  return {row: Math.floor(travel - cycle * stream.period), cycle};
}

// Rasterize each mirrored character once at screen density, including its halo.
// Both themes use the same glyph shapes. The light theme has a dark green core.
function makeAtlas(dpr) {
  const tile = 32;
  const sheet = document.createElement('canvas');
  const colors = ['#007346', '#d1ffb8', '#39e86a', '#e1ffe6'];
  const cell = Math.ceil(tile * dpr);
  sheet.width = cell * letters.length;
  sheet.height = cell * colors.length;
  const ink = sheet.getContext('2d', {willReadFrequently: true});
  ink.font = '600 ' + Math.round(cell * .68) + 'px "MS Gothic","Hiragino Kaku Gothic ProN","Noto Sans Mono CJK JP",monospace';
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  colors.forEach((color, band) => {
    ink.fillStyle = color;
    ink.shadowColor = band === 3 ? '#57ff82' : '#39ce64';
    ink.shadowBlur = band % 2 ? cell * .11 : 0;
    for (let i = 0; i < letters.length; i++) {
      ink.save();
      ink.translate((i + .5) * cell, (band + .52) * cell);
      ink.scale(-.82, 1);
      if (band === 1) {
        ink.lineWidth = cell * .075;
        ink.strokeStyle = '#16713f';
        ink.lineJoin = 'round';
        ink.strokeText(letters[i], 0, 0);
      }
      ink.fillText(letters[i], 0, 0);
      ink.restore();
    }
  });
  return {sheet, cell};
}

function paintGlyph(ctx, atlas, index, band, x, y, size) {
  const extent = size / .68;
  ctx.drawImage(atlas.sheet, index * atlas.cell, band * atlas.cell, atlas.cell, atlas.cell,
    x - extent / 2, y - extent / 2, extent, extent);
}

function inDarkArea(areas, x, y) {
  return areas.some(rect => x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom);
}

function paintStreams(ctx, atlas, streams, time, opacity, dark, areas) {
  for (const stream of streams) {
    const {row: head, cycle} = streamHead(stream, time);
    const first = Math.max(0, head - stream.length + 1);
    const last = Math.min(head, stream.rows);
    for (let row = first; row <= last; row++) {
      const age = head - row;
      const address = stream.seed + cycle * 7499 + row * 89;
      const charged = age === 0;
      // The head writes a new glyph; most deposited glyphs stay still.
      const clock = charged ? Math.floor(time / 80) : address % 9 === 0 ? Math.floor(time / 480) : 0;
      const index = ((address * 31 + clock * 17) >>> 0) % letters.length;
      const y = (row + .5) * stream.step;
      const onDark = dark || inDarkArea(areas, stream.x, y);
      const band = (onDark ? 2 : 0) + Number(charged);
      const strength = charged ? 1 : .86 * (1 - age / stream.length) ** 1.5;
      ctx.globalAlpha = opacity * stream.opacity * strength;
      paintGlyph(ctx, atlas, index, band, stream.x, y, stream.size);
    }
  }
}

// Keep one arriving glyph per grid cell. Runs are separated by blank cells;
// neighbouring columns have different launch times, spacing and velocities.
function planCapture(points, box, height, cell) {
  const lanes = new Map();
  for (const target of points) {
    if (!lanes.has(target.column)) lanes.set(target.column, []);
    lanes.get(target.column).push(target);
  }
  const drops = [];
  for (const [column, targets] of lanes) {
    const speed = Math.max(.38, height / 1450) * (.88 + hash(column + 23) * .47);
    const run = 7 + Math.floor(hash(column + 11) * 9);
    const x = (column + .5) * cell - box.left;
    const from = -box.top - cell;
    let born = hash(column + 71) * 260;
    let index = 0;
    for (const target of targets) {
      const landing = born + (target.y - from) / speed;
      drops.push({id: drops.length, x, from, speed, born, landing, target,
        glyph: target.glyph, age: index % run, run});
      born += cell / speed * (index % run === run - 1 ? 3.5 : 1);
      index++;
    }
  }
  return drops.sort((a,b) => a.landing - b.landing);
}

export function createRain(canvas) {
  // Keep the sprite atlas, captured silhouettes and output on the same CPU
  // raster backend. Hundreds of tiny GPU texture copies stall software GPUs.
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('Canvas unavailable');
  let streams, atlas, density;
  const darkPanels = [...document.querySelectorAll('.cat-stage,#team,#request')];
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.ceil(innerWidth * dpr);
    canvas.height = Math.ceil(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (density !== dpr) atlas = makeAtlas(dpr);
    density = dpr;
    streams = makeStreams(innerWidth, innerHeight);
  }
  resize();
  function clear() { ctx.clearRect(0, 0, innerWidth, innerHeight); }

  function attach(record) {
    const box = record.element.getBoundingClientRect();
    const cell = innerWidth < 700 ? 11 : 13;
    record.drops = planCapture(record.points, box, innerHeight, cell);
    const lastLanding = record.drops.at(-1)?.landing || 0;
    record.duration = Math.max(700, lastLanding / .90 + 100);
    const sheet = document.createElement('canvas');
    const top = Math.max(0, -box.top) - cell;
    sheet.width = Math.ceil(box.width);
    sheet.height = Math.ceil(Math.min(box.height, innerHeight) + 2 * cell);
    const pen = sheet.getContext('2d', {willReadFrequently: true});
    pen.font = '600 ' + Math.round(cell * .78) + 'px monospace';
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    record.capture = {sheet, pen, top, count: 0, cell};
  }

  function drawCapture(record, time, dark, areas) {
    const box = record.element.getBoundingClientRect();
    const elapsed = time - record.start - record.lead;
    const progress = clamp(elapsed / record.duration);
    const fade = 1 - clamp((progress - .92) / .08);
    const {drops, capture} = record;
    while (capture.count < drops.length && drops[capture.count].landing <= elapsed) {
      const target = drops[capture.count++].target;
      capture.pen.fillStyle = target.color;
      capture.pen.save();
      capture.pen.translate(target.x, target.y - capture.top);
      capture.pen.scale(-.82, 1);
      capture.pen.fillText(target.letter, 0, 0);
      capture.pen.restore();
    }
    ctx.globalAlpha = fade;
    ctx.drawImage(capture.sheet, box.left, box.top + capture.top);
    for (let i = capture.count; i < drops.length; i++) {
      const drop = drops[i];
      const p = dropPosition(drop, elapsed);
      if (!p) continue;
      const x = box.left + p.x, y = box.top + p.y;
      if (y < -capture.cell || y > innerHeight + capture.cell) continue;
      const head = drop.age === 0;
      const band = (dark || inDarkArea(areas, x, y) ? 2 : 0) + Number(head);
      ctx.globalAlpha = fade * (head ? .97 : .16 + .5 * (1 - drop.age / drop.run));
      paintGlyph(ctx, atlas, drop.glyph, band, x, y, capture.cell * .82);
    }
    record.element.dataset.matrixCaptured = String(capture.count);
  }

  function draw(time, records) {
    const dark = document.documentElement.dataset.matrixTheme === 'dark';
    const areas = dark ? [] : darkPanels.map(el => el.getBoundingClientRect())
      .filter(rect => rect.bottom > 0 && rect.top < innerHeight);
    const strength = records.reduce((max, r) => {
      const progress = clamp((time - r.start - r.lead) / r.duration);
      return Math.max(max, 1 - clamp((progress - .46) / .45));
    }, records.length ? 0 : 1);
    if (strength > 0) paintStreams(ctx, atlas, streams, time, strength, dark, areas);
    for (const record of records) drawCapture(record, time, dark, areas);
    ctx.globalAlpha = 1;
  }
  return {resize, clear, attach, draw};
}
