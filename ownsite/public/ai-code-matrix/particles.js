import { catGlyphs } from '../ai-code/motion/cat-model.js';
// Perspective code streams and a sampled silhouette of the real, laid-out UI.
// No screenshot service, duplicated copy, external library or remote font.
let catSurface;
const letters = '01アイウエオカキクケコサシスセソタチツテト<>/{}+=*';
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
  const all = [...root.querySelectorAll('*')].filter(visible);
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
  // Project the same depth-tested cat surface into the shared rain target set.
  // Its native WebGL canvas stays hidden until these rain drops have landed.
  const cat = root.querySelector('#cat');
  const catPoints=[];
  if(cat) {
    atoms.push(cat);
    const r=cat.getBoundingClientRect(), scale=r.height/590;
    for(const g of (catSurface ||= catGlyphs())) catPoints.push({
      x:r.left-box.left+r.width/2+(g.x-320)*scale,
      y:r.top-box.top+g.y*scale,
      color:g.color,seed:hash(g.x+g.y*13),letter:g.char,
      size:Math.max(1.5,7.5*Math.hypot(g.matrix[0],g.matrix[1])*scale),
    });
  }
  const data=ink.getImageData(0,0,mask.width,mask.height).data;
  const points=[];
  const step=innerWidth<700?4:5;
  for(let y=0;y<mask.height;y+=step) for(let x=0;x<mask.width;x+=step) {
    // Sample each cell, including one-pixel borders that lie between grid points.
    let sample=-1, sx=x, sy=y;
    for(let dy=0;dy<step&&y+dy<mask.height&&sample<0;dy++)
      for(let dx=0;dx<step&&x+dx<mask.width;dx++) {
        const i=((y+dy)*mask.width+x+dx)*4;
        if(data[i+3]>60){sample=i;sx=x+dx;sy=y+dy;break;}
      }
    if(sample<0)continue;
    points.push({x:sx,y:sy,color:`rgb(${data[sample]},${data[sample+1]},${data[sample+2]})`,seed:hash(x+y*13),letter:letters[(x+y)%letters.length]});
  }
  // Bound work on long disclosures while distributing samples across all content.
  const stride=Math.max(1,Math.ceil(points.length/14000));
  return {points:[...points.filter((_,i)=>i%stride===0),...catPoints],atoms,surfaces};
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
export function createRain(canvas) {
  const ctx=canvas.getContext('2d');
  if(!ctx) throw new Error('Canvas unavailable');
  let ambient=[],lastTime;
  function resize(){
    const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.ceil(innerWidth*dpr);canvas.height=Math.ceil(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    ambient=[];
    for(let layer=0;layer<3;layer++) {
      const scale=800/(800+layer*500+80),spacing=26*scale;
      for(let col=0;col<innerWidth/spacing;col++) {
        const seed=hash(col+layer*127);
        for(let row=0;row<14;row++)ambient.push({
          x:(col+.5)*spacing,y:seed*(innerHeight+320)-row*20*scale,
          speed:(.17+seed*.13)*scale,size:Math.round(15*scale),
          alpha:(1-row/14)*(.48-layer*.1),letter:letters[(col*7+row)%letters.length],
          color:row===0?'#62b963':layer===0?'#84cf76':'#aadf9e',
        });
      }
    }
    lastTime=undefined;
  }
  resize();
  function clear(){ctx.clearRect(0,0,innerWidth,innerHeight);}
  function attach(record) {
    const box=record.element.getBoundingClientRect(),columns=new Map();
    for(const target of record.points) {
      // Only the viewport needs particles. Native content below it retains layout.
      if(box.top+target.y<0||box.top+target.y>innerHeight)continue;
      const column=Math.round((box.left+target.x)/6);
      if(!columns.has(column))columns.set(column,[]);
      columns.get(column).push(target);
    }
    const maxCount=Math.max(1,...[...columns.values()].map(list=>list.length));
    const interval=Math.min(26,1400/maxCount);
    const speed=Math.max(.5,innerHeight/1800);
    const drops=[];let lastLanding=0;
    for(const [column,targets] of columns) {
      targets.sort((a,b)=>a.y-b.y);
      const x=column*6-box.left;
      targets.forEach((target,index)=>{
        const born=record.lead+hash(column)*180+index*interval;
        const from=-box.top-18;
        const landing=born+(target.y-from)/speed;
        drops.push({id:drops.length,x,from,speed,born,landing,target});
        lastLanding=Math.max(lastLanding,landing);
      });
    }
    record.drops=drops;
    record.duration=Math.max(500,lastLanding-record.lead+400);
  }
  function draw(time,records) {
    const delta=lastTime===undefined?0:Math.min(80,time-lastTime);lastTime=time;
    ctx.textAlign='center';ctx.textBaseline='middle';
    const rainAlpha=records.length?Math.max(...records.map(r=>1-clamp(((time-r.start-r.lead)/r.duration-.75)/.25))):.8;
    // Every symbol retains its identity while falling; ambient columns share the
    // same lifetime and palette as the streams that are captured by the UI.
    for(const drop of ambient) {
      drop.y+=delta*drop.speed;
      if(drop.y>innerHeight+20)drop.y=-20;
      if(drop.y<0)continue;
      ctx.globalAlpha=drop.alpha*rainAlpha;ctx.fillStyle=drop.color;ctx.font=`${drop.size}px monospace`;
      ctx.fillText(drop.letter,drop.x,drop.y);
    }
    for(const record of records) {
      const box=record.element.getBoundingClientRect(),elapsed=time-record.start;
      const progress=clamp((elapsed-record.lead)/record.duration);
      const fade=1-clamp((progress-.92)/.08);
      let captured=0;
      for(const drop of record.drops||[]) {
        const p=dropPosition(drop,elapsed);if(!p)continue;
        if(p.captured)captured++;
        const y=box.top+p.y;if(y< -12||y>innerHeight+12)continue;
        const settle=clamp((elapsed-drop.landing)/150);
        ctx.globalAlpha=fade*(.45+.55*settle);
        ctx.fillStyle=p.captured?drop.target.color:'#7bc96e';
        const fallingSize=drop.target.size?Math.max(2.5,Math.min(6,drop.target.size*2)):7;
        const size=fallingSize+((drop.target.size||6)-fallingSize)*settle;
        ctx.font=`${size}px monospace`;
        // The same character falls, stops and becomes the final contour.
        ctx.fillText(drop.target.letter,box.left+p.x,y);
      }
      record.element.dataset.matrixCaptured=String(captured);
      record.element.dataset.matrixDrops=String(record.drops.length);
    }
    ctx.globalAlpha=1;
  }
  return {resize,clear,attach,draw};
}
