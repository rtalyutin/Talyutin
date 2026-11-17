// One sculpt supplies the live portrait and the server-rendered first frame.
// Coordinates are model-space millimetres: x across, y down, z toward the viewer.
const vertices = {
  crown:[0,-66,15], poll:[42,-61,10], temple:[77,-38,12], brow:[54,-37,39],
  bridge:[0,-35,46], browIn:[20,-26,52], outerEye:[66,-24,36], innerEye:[19,-10,54],
  cheek:[84,1,15], cheekRidge:[59,7,44], cheekTip:[89,18,4], ruff:[68,38,10],
  jaw:[43,56,26], jawBack:[24,65,12], jawMid:[0,68,26], chin:[0,59,53],
  padLower:[22,45,58], padEdge:[39,27,56], padTop:[24,17,64], noseTop:[0,12,66],
  noseCorner:[12,15,67], noseTip:[0,24,72], lip:[0,40,65],
  earTip:[79,-110,-5], earHeel:[84,-45,-11], earRim:[73,-92,1],
  earRoot:[34,-55,17], earFold:[69,-51,12], earPit:[62,-61,1],
  back:[0,-45,-47], sideBack:[74,-18,-24], nape:[45,42,-26], throat:[0,56,-18],
};
const facets = [
  'back poll crown','back earRoot poll','back temple sideBack','back sideBack nape','back nape throat',
  'earHeel temple sideBack','earTip earHeel earRim','earTip earRim earRoot','earRoot earRim earPit','earRim earFold earPit',
  'earRim earHeel earFold','earPit earFold earRoot','earRoot earFold temple','poll earRoot temple',
  'crown poll bridge','poll brow bridge','poll temple brow','bridge brow browIn',
  'brow temple outerEye','brow outerEye browIn','browIn outerEye innerEye',
  'temple sideBack cheek','temple cheek outerEye','outerEye cheek cheekRidge',
  'innerEye outerEye cheekRidge','browIn innerEye bridge','bridge innerEye noseTop',
  'innerEye padTop noseTop','innerEye cheekRidge padTop','cheekRidge padEdge padTop',
  'cheek cheekTip cheekRidge','cheekTip ruff cheekRidge','cheekRidge ruff padEdge',
  'ruff jaw padEdge','jaw padLower padEdge','jaw jawBack padLower','jawBack chin padLower',
  'jawBack jawMid chin','sideBack nape cheekTip','nape ruff cheekTip','nape jawBack ruff',
  'nape throat jawBack','throat jawMid jawBack','noseTop padTop noseCorner',
  'padTop padEdge noseCorner','noseCorner padEdge noseTip','padEdge padLower noseTip',
  'noseTip padLower lip','lip padLower chin','noseTop noseCorner noseTip',
];
const tones = {};
function tone(names, color) { for (const name of names.split('|')) tones[name] = color; }
tone('earRoot earRim earPit|earRim earFold earPit|browIn outerEye innerEye', 'shadow');
tone('earTip earRim earRoot|earRim earHeel earFold|outerEye cheek cheekRidge', 'edge');
tone('noseTop noseCorner noseTip', 'nose');
const mesh = [];
const detail = [];
const mirror = (p, side) => [p[0]*side,p[1],p[2]];
function normal([a,b,c]) {
  const u=b.map((n,i)=>n-a[i]), v=c.map((n,i)=>n-a[i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const len=Math.hypot(...n);
  return n.map(k=>k/len*(n[2]<0?-1:1));
}
for (const side of [-1,1]) {
  for (const names of facets) {
    const points=names.split(' ').map(key=>mirror(vertices[key],side));
    mesh.push({points,normal:normal(points),material:tones[names]||'jade'});
  }
  const mark=(points,fill,stroke='none',width=.6) =>
    detail.push({points:points.map(p=>mirror(p,side)),fill,stroke,width,open:fill==='none'});
  // Almond-shaped eye set back under a raised brow plate.
  mark([[17,-9,56],[24,-21,53],[44,-28,48],[67,-27,39],[60,-12,45],[39,-3,52],[24,-3,55]],'#071912');
  mark([[21,-10,57],[28,-18,55],[44,-23,51],[61,-24,42],[53,-14,49],[37,-7,55],[27,-7,57]],'url(#iris)');
  mark([[39,-21,53],[41,-23,53],[42,-15,54],[39,-8,56],[37,-14,55]],'#102016');
  mark([[29,-17,56],[35,-19,55],[32,-16,56],[28,-15,56]],'#f1ffce');
  mark([[20,-9,57],[31,-7,57],[48,-13,51],[60,-22,43]],'none','#aeeb7b',.65);
  mark([[19,-19,54],[30,-29,51],[51,-34,43],[69,-30,36]],'none','#8ebda5',.8);
  mark([[0,11,72],[13,12,69],[11,17,71],[0,24,74]],'#213c33','#83ae95',.55);
  mark([[0,12,73],[11,12,70],[7,14,72],[0,15,74]],'#779587');
  mark([[4,16,70],[9,16,69],[7,19,70]],'#081811');
  mark([[0,24,73],[0,37,67],[9,40,65],[21,37,62]],'none','#10251d',1.6);
  // Whisker roots and whiskers have independent depth; they stay anchored as the head turns.
  for(const [x,y,z] of [[17,24,68],[22,29,65],[29,25,64],[15,31,67]]) {
    mark([[x-1,y,z],[x,y-1,z],[x+1.2,y,z],[x,y+1.1,z]],'#355c50');
  }
  for(const [y,dy,len] of [[25,-13,119],[29,-3,130],[33,12,117],[36,21,101]]) {
    mark([[26,y,65],[52,y-4,57],[83,y+dy*.38-5,39],[len,y+dy,22]],'none','#8ab9a2',.48);
  }
}
const radians = Math.PI / 180;

function cameraFor(gaze) {
  const yaw = (-13 + gaze.x * 1.55) * radians;
  const pitch = (2 - gaze.y) * radians;
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  function project([x, y, z]) {
    const horizontal = x * cosYaw + z * sinYaw;
    const forward = z * cosYaw - x * sinYaw;
    const vertical = y * cosPitch - forward * sinPitch;
    const depth = forward * cosPitch + y * sinPitch;
    const scale = 1.79 * 600 / (600 - depth);
    return [240 + horizontal * scale, 244 + vertical * scale, depth];
  }
  return { project, cosYaw, sinYaw };
}

function shade(face, camera) {
  if (face.material === 'nose') return '#547f71';
  if (face.material === 'shadow') return '#163c32';
  const [x, y, z] = face.normal;
  const nx = x * camera.cosYaw + z * camera.sinYaw;
  const light = Math.max(0, -.55 * nx - .63 * y + .47 * z);
  const rim = Math.max(0, nx * .8 - y * .15);
  const edge = face.material === 'edge' ? .13 : 0;
  const value = Math.min(1, .09 + .83 * light * light + .18 * rim + edge);
  const low = [2,17,19], high = [188,226,190];
  const rgb = low.map((channel, i) => Math.round(channel + (high[i] - channel) * value));
  return 'rgb(' + rgb.join(',') + ')';
}

function pathData(points, open = false) {
  const [start, ...rest] = points.map(([x, y]) => x.toFixed(2) + ' ' + y.toFixed(2));
  if (open && rest.length === 3) return 'M' + start + 'C' + rest.join(' ');
  return 'M' + start + 'L' + rest.join(' ') + (open ? '' : 'Z');
}

function contours(gaze = {x:0, y:0}) {
  const camera = cameraFor(gaze);
  const faces = mesh.map(face => {
    const points = face.points.map(camera.project);
    return {
      d: pathData(points), depth: points[0][2] + points[1][2] + points[2][2],
      material: face.material, fill: shade(face, camera), stroke: 'rgba(166,224,188,.25)', width: .42
    };
  });
  faces.sort((a, b) => a.depth - b.depth);
  return faces.concat(detail.map(mark => ({
    ...mark, d: pathData(mark.points.map(camera.project), mark.open)
  })));
}

const defs = `<defs>
<linearGradient id="iris" x2=".8" y2="1" gradientUnits="objectBoundingBox">
<stop stop-color="#f2ffa7"/>
<stop offset=".47" stop-color="#d0ff68"/>
<stop offset="1" stop-color="#80c770"/>
</linearGradient>
<pattern id="etch" width="28" height="17" patternUnits="userSpaceOnUse" patternTransform="rotate(-13)">
<path d="M0 1H28M0 3H28" stroke="#042c22" stroke-width=".55" opacity=".45"/>
<text x="1" y="11" font-family="monospace" font-size="5.6" letter-spacing=".55" fill="#d5ffd3" opacity=".29">01/&gt;:</text>
<text x="10" y="16" font-family="monospace" font-size="4.5" fill="#052a1f" opacity=".52">{+}1</text>
</pattern>
</defs>`;
const path = f => '<path d="'+f.d+'" fill="'+f.fill+'" stroke="'+f.stroke+'" stroke-width="'+f.width+'" stroke-linecap="round" stroke-linejoin="round"/>';
function markup(f) {
  if(!f.material) return path(f);
  return '<g>'+path(f)+'<path d="'+f.d+'" fill="url(#etch)"/></g>';
}
export function catPoster() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 410" aria-hidden="true">'+defs+'<g>'+contours().map(markup).join('')+'</g></svg>';
}
export function createMatrixCat(host) {
  const svg=new DOMParser().parseFromString(catPoster(),'image/svg+xml').documentElement;
  const layer=svg.lastElementChild;
  svg.classList.add('matrix-portrait');
  host.append(svg);
  host.classList.add('volume-ready');
  function render(gaze) {
    contours(gaze).forEach((face,index)=>{
      const node=layer.children[index];
      if(face.material) {
        node.firstElementChild.setAttribute('d',face.d);
        node.firstElementChild.setAttribute('fill',face.fill);
        node.lastElementChild.setAttribute('d',face.d);
      } else node.setAttribute('d',face.d);
    });
  }
  return {render,neutral:()=>render({x:0,y:0}),dispose(){svg.remove();host.classList.remove('volume-ready');}};
}
