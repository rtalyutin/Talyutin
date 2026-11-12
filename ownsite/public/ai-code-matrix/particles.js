// Perspective code streams and a sampled silhouette of the real, laid-out UI.
// No screenshot service, duplicated copy, external library or remote font.
const letters = '01アイウエオカキクケコサシスセソタチツテト<>/{}+=*';
export const clamp = value => Math.max(0, Math.min(1, value));
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const visible = el => {
  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !el.closest('[hidden],script,canvas');
};
export function sampleInterface(root, hasVolume) {
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
  // WebGL-less devices still assemble the supplied SVG from sampled symbols.
  const cat = root.querySelector('#cat > img');
  if (!hasVolume && cat?.complete && cat.naturalWidth) {
    const r=cat.getBoundingClientRect(); ink.drawImage(cat,r.left-box.left,r.top-box.top,r.width,r.height);
    atoms.push(cat);
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
  return {points:points.filter((_,i)=>i%stride===0),atoms,surfaces};
}
export function createRain(canvas) {
  const ctx=canvas.getContext('2d');
  if(!ctx) throw new Error('Canvas unavailable');
  function resize(){const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.ceil(innerWidth*dpr);canvas.height=Math.ceil(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  resize();
  function clear(){ctx.clearRect(0,0,innerWidth,innerHeight);}
  function rain(time,alpha) {
    ctx.textAlign='center';ctx.textBaseline='middle';
    // Three perspective planes: farther columns are smaller, slower and paler.
    for(let layer=0;layer<3;layer++) {
      const depth=layer*500+80, scale=800/(800+depth), spacing=25*scale;
      const count=Math.ceil(innerWidth/spacing);
      ctx.font=`${Math.round(17*scale)}px monospace`;
      for(let col=0;col<count;col++) {
        const seed=hash(col+layer*127), length=12+Math.floor(seed*10);
        const x=(col+.5)*spacing+Math.sin(time*.00013+seed*6)*5*scale;
        const head=((time*(.18+seed*.12)*scale+seed*(innerHeight+500))%(innerHeight+500))-100;
        for(let j=length-1;j>=0;j--) {
          const y=head-j*20*scale;if(y<0||y>innerHeight)continue;
          ctx.globalAlpha=alpha*(1-j/length)*(.55-layer*.12);
          ctx.fillStyle=j===0?'#398f4b':layer===0?'#66bd59':'#8acb77';
          ctx.fillText(letters[(col*7+j+Math.floor(time/105))%letters.length],x,y);
        }
      }
    }
    ctx.globalAlpha=1;
  }
  function assemble(record,progress) {
    const box=record.element.getBoundingClientRect();
    const fade=1-clamp((progress-.9)/.1);
    ctx.font='7px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    for(const p of record.points) {
      const delay=.25*(p.y/Math.max(1,box.height))+.15*p.seed;
      const local=clamp((progress-delay)/(.82-delay));
      const travel=(1-local)**3;
      const z=(180+p.seed*1200)*travel;
      const scale=850/(850+z);
      const targetX=box.left+p.x, targetY=box.top+p.y;
      const x=innerWidth/2+(targetX-innerWidth/2+(p.seed-.5)*220*travel)*scale;
      const y=innerHeight/2+(targetY-innerHeight/2-(320+p.seed*600)*travel)*scale;
      if(y < -12 || y > innerHeight+12)continue;
      ctx.globalAlpha=fade*(.3+.7*local);
      ctx.fillStyle=local>.93?p.color:'#65b85b';
      ctx.fillText(p.letter,x,y);
    }
    ctx.globalAlpha=1;
  }
  return {resize,clear,rain,assemble};
}
