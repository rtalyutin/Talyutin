'use strict';
const referenceHero=document.querySelector('.hero');
const referenceScene=document.querySelector('.reference-scene');
function sizeReferenceHero(){referenceScene.style.transform='scale('+(referenceHero.getBoundingClientRect().width/1150)+')';referenceScene.classList.add('ready');}
sizeReferenceHero();
if(typeof ResizeObserver!=='undefined'){new ResizeObserver(sizeReferenceHero).observe(referenceHero);}else{window.addEventListener('resize',sizeReferenceHero);}

// INTRO_CONTRACT v1: selected "Impossible assembly", once on first appearance.
// ~3.5s, CSS planes only. No pointer effect, looping, storage or external assets.
// The original DOM is never transformed/reparented; finish/cancel removes the copy.
// Browser motion/paint remains a separate acceptance check from JS/static checks.
(() => {
  const scene = document.querySelector('.reference-scene');
  const artwork = scene.querySelector('.reference-art');
  const hero = scene.closest('.hero');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || typeof Element.prototype.animate !== 'function' ||
      !window.CSS || !CSS.supports('perspective', '1750px') ||
      !CSS.supports('transform-style', 'preserve-3d')) return;

  // Bounds are derived from the existing CSS polygons, in reference-scene pixels.
  // Adjacent crops partition letters; counters and color inserts stay with them.
  const plates = [
    {"name":"bar-red","sources":["bar-red"],"box":[0,0,101,59],"pivot":[50,50],"layer":0,"delay":140,"from":[-237,14,-580,-72,76,-23]},
    {"name":"bar-black-1","sources":["bar-black"],"box":[89,0,141,59],"pivot":[50,50],"layer":0,"delay":36,"from":[-141,-77,-360,44,-84,32]},
    {"name":"bar-black-2","sources":["bar-black"],"box":[230,0,106,59],"pivot":[50,50],"layer":0,"delay":72,"from":[-252,-127,-700,84,58,-37]},
    {"name":"bar-blue","sources":["bar-blue"],"box":[333,0,173,59],"pivot":[50,50],"layer":0,"delay":248,"from":[-47,-13,260,-48,-66,18]},
    {"name":"t-red","sources":["t-red"],"box":[302,56,49,39],"pivot":[50,50],"layer":0,"delay":284,"from":[-164,-1,-450,58,88,28]},
    {"name":"letter-t","sources":["letter-t"],"box":[331,56,100,139],"pivot":[50,50],"layer":0,"delay":180,"from":[-179,-99,190,-28,-51,-16]},
    {"name":"letter-a-1","sources":["letter-a","a-counter","a-hatch"],"box":[432,0,98,162],"pivot":[50,50],"layer":0,"delay":216,"from":[-12,-59,-580,-72,76,-23]},
    {"name":"letter-a-2","sources":["letter-a","a-counter","a-hatch"],"box":[530,0,48,162],"pivot":[50,50],"layer":0,"delay":0,"from":[-155,29,-360,44,-84,32]},
    {"name":"letter-a-3","sources":["letter-a","a-counter","a-hatch"],"box":[578,0,55,162],"pivot":[50,50],"layer":0,"delay":36,"from":[-28,-64,-700,84,58,-37]},
    {"name":"letter-l-diagonal-1","sources":["letter-l-diagonal","l-red"],"box":[546,0,225,192],"pivot":[90,5],"layer":0,"delay":212,"from":[-8,-105,260,44,-82,-24]},
    {"name":"letter-l-diagonal-2","sources":["letter-l-diagonal","l-red"],"box":[546,192,225,138],"pivot":[10,95],"layer":0,"delay":248,"from":[-124,58,-450,-44,82,24]},
    {"name":"letter-l-stem","sources":["letter-l-stem"],"box":[758,0,58,229],"pivot":[50,50],"layer":0,"delay":144,"from":[85,8,190,-28,-51,-16]},
    {"name":"l-bottom","sources":["l-bottom"],"box":[793,175,23,65],"pivot":[50,50],"layer":0,"delay":320,"from":[-41,-75,-580,-72,76,-23]},
    {"name":"letter-yu-stem","sources":["letter-yu-stem"],"box":[819,22,52,194],"pivot":[50,50],"layer":0,"delay":216,"from":[-2,-45,-360,44,-84,32]},
    {"name":"letter-yu-cross","sources":["letter-yu-cross"],"box":[857,93,63,51],"pivot":[50,50],"layer":0,"delay":0,"from":[105,40,-700,84,58,-37]},
    {"name":"red-center","sources":["red-center"],"box":[696,163,49,79],"pivot":[50,50],"layer":0,"delay":176,"from":[-112,-30,260,-48,-66,18]},
    {"name":"blue-center","sources":["blue-center"],"box":[781,221,93,83],"pivot":[50,50],"layer":0,"delay":212,"from":[70,-54,-450,58,88,28]},
    {"name":"letter-t-bottom-1","sources":["letter-t-bottom"],"box":[696,241,181,69],"pivot":[50,0],"layer":0,"delay":108,"from":[3,-110,190,-86,-51,-16]},
    {"name":"letter-t-bottom-2","sources":["letter-t-bottom"],"box":[696,310,181,108],"pivot":[50,0],"layer":0,"delay":144,"from":[-65,-10,-580,74,76,-23]},
    {"name":"letter-t-bottom-3","sources":["letter-t-bottom"],"box":[696,418,181,108],"pivot":[50,0],"layer":0,"delay":180,"from":[89,90,-360,-65,-84,32]},
    {"name":"blue-bottom-1","sources":["blue-bottom"],"box":[615,300,115,110],"pivot":[50,50],"layer":0,"delay":356,"from":[-107,28,-700,84,58,-37]},
    {"name":"blue-bottom-2","sources":["blue-bottom"],"box":[615,410,115,116],"pivot":[50,50],"layer":0,"delay":140,"from":[-26,145,260,-48,-66,18]},
    {"name":"letter-i-1","sources":["letter-i","i-red"],"box":[816,245,54,257],"pivot":[50,50],"layer":0,"delay":176,"from":[68,19,-450,58,88,28]},
    {"name":"letter-i-2","sources":["letter-i","i-red"],"box":[870,245,57,257],"pivot":[50,50],"layer":0,"delay":212,"from":[-53,-20,190,-28,-51,-16]},
    {"name":"letter-i-3","sources":["letter-i","i-red"],"box":[927,245,50,257],"pivot":[50,50],"layer":0,"delay":248,"from":[130,96,-580,-72,76,-23]},
    {"name":"letter-n-left-1","sources":["letter-n-left"],"box":[981,262,108,93],"pivot":[50,50],"layer":0,"delay":144,"from":[51,62,-360,44,-84,32]},
    {"name":"letter-n-left-2","sources":["letter-n-left"],"box":[981,355,108,117],"pivot":[50,50],"layer":0,"delay":180,"from":[41,-15,-700,84,58,-37]},
    {"name":"red-right","sources":["red-right"],"box":[1030,76,120,226],"pivot":[50,50],"layer":2,"delay":356,"from":[179,-19,260,-48,-66,18]},
    {"name":"blue-right","sources":["blue-right"],"box":[977,0,173,302],"pivot":[50,50],"layer":2,"delay":140,"from":[3,50,-450,58,88,28]},
    {"name":"red-right-bottom","sources":["red-right-bottom"],"box":[1026,352,124,183],"pivot":[50,50],"layer":2,"delay":176,"from":[137,38,190,-28,-51,-16]},
    {"name":"letter-n-right-1","sources":["letter-n-right"],"box":[1113,236,37,154],"pivot":[50,50],"layer":2,"delay":72,"from":[132,-36,-580,-72,76,-23]},
    {"name":"letter-n-right-2","sources":["letter-n-right"],"box":[1113,390,37,145],"pivot":[50,50],"layer":2,"delay":108,"from":[34,124,-360,44,-84,32]},
    {"name":"fine-diagonal","sources":["fine-diagonal"],"box":[601,0,164,277],"pivot":[50,50],"layer":0,"delay":144,"from":[54,9,-700,84,58,-37]},
    {"name":"yu-ring","sources":["yu-ring"],"box":[849,4,258,260],"pivot":[50,50],"layer":1,"delay":180,"from":[70,-28,-510,16,89,-34]},
    {"name":"lane-center","sources":["lane-center"],"box":[569,45,266,452],"pivot":[75,10],"layer":4,"delay":326,"from":[-110,80,280,-24,62,-18]},
    {"name":"lane-right","sources":["lane-right"],"box":[952,0,184,273],"pivot":[75,10],"layer":4,"delay":110,"from":[-110,80,280,-24,62,-18]}
  ];
  const animations = [];
  let stage = null;
  let observer = null;
  let state = 'waiting';
  let watchdog = 0;
  const ease = 'cubic-bezier(.22,.72,.16,1)';
  const neutral = 'translate3d(0px,0px,0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)';
  const pose = (x,y,z,rx,ry,rz) =>
    `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;

  function settle() {
    if (state === 'settled') return;
    state = 'settled';
    clearTimeout(watchdog);
    if (observer) observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', settle);
    if (motion.removeEventListener) motion.removeEventListener('change', onMotion);
    else if (motion.removeListener) motion.removeListener(onMotion);
    // Reveal the untouched original in the same task that removes the 3D copy.
    scene.classList.remove('is-assembling');
    if (stage) stage.remove();
    for (const animation of animations) animation.cancel();
    animations.length = 0;
    stage = null;
  }

  function track(element, frames, timing) {
    const animation = element.animate(frames, {fill:'both', ...timing});
    animations.push(animation);
    // cancel() rejects finished; bind both handlers immediately, even during setup.
    animation.finished.then(() => {}, settle);
    return animation;
  }

  function start() {
    if (state !== 'waiting' || document.hidden) return;
    if (motion.matches) { settle(); return; }
    state = 'assembling';
    if (observer) observer.disconnect();
    try {
      stage = document.createElement('div');
      stage.className = 'reference-art assembly-art';
      stage.setAttribute('aria-hidden', 'true');
      const rig = document.createElement('div');
      rig.className = 'assembly-rig';
      stage.appendChild(rig);

      plates.forEach((part, i) => {
        const [x,y,width,height] = part.box;
        const plate = document.createElement('div');
        plate.className = 'assembly-plate';
        plate.dataset.part = part.name;
        Object.assign(plate.style, {
          left:x+'px', top:y+'px', width:width+'px', height:height+'px',
          transformOrigin:part.pivot[0]+'% '+part.pivot[1]+'%', zIndex:String(part.layer)
        });
        const surface = document.createElement('div');
        surface.className = 'assembly-surface';
        surface.style.left = -x+'px';
        surface.style.top = -y+'px';
        for (const selector of part.sources) {
          const source = artwork.querySelector('.'+selector);
          if (!source) throw new Error('Missing intro fragment: '+selector);
          surface.appendChild(source.cloneNode(true));
        }
        plate.appendChild(surface);
        rig.appendChild(plate);
        const [dx,dy,dz,rx,ry,rz] = part.from;
        const bend = i % 2 ? 1 : -1;
        const lag = part.delay;
        track(plate, [
          {offset:0, transform:pose(dx,dy,dz,rx,ry,rz), opacity:0},
          {offset:.07, transform:pose(dx*.94,dy*.96,dz,rx*.97,ry*.98,rz), opacity:1, easing:'cubic-bezier(.42,0,.3,1)'},
          {offset:.43, transform:pose(dx*.47+bend*24,dy*.52-18,dz*.66,rx*.58,ry*.67,rz*.42), opacity:1, easing:ease},
          {offset:.76, transform:pose(dx*.09-bend*8,dy*.12,dz*.17,rx*-.12,ry*.2,rz*-.08), opacity:1, easing:ease},
          {offset:.92, transform:pose(bend*1.2,-.7,2,rx*.012,ry*-.018,0), opacity:1, easing:'cubic-bezier(.2,0,.2,1)'},
          {offset:1, transform:neutral, opacity:1}
        ], {duration:3500-lag, delay:lag});
      });

      track(rig, [
        {offset:0, transform:pose(55,-12,-160,9,-17,-3), easing:'cubic-bezier(.4,0,.3,1)'},
        {offset:.46, transform:pose(-18,8,-65,-4,7,1), easing:ease},
        {offset:.87, transform:pose(0,0,-3,.4,-.6,0), easing:ease},
        {offset:1, transform:neutral}
      ], {duration:3500});

      scene.insertBefore(stage, scene.querySelector('.hero-copy'));
      scene.classList.add('is-assembling');
      // A single shared start keeps every plate and the camera on the same clock.
      const epoch = document.timeline.currentTime;
      if (typeof epoch === 'number') {
        for (const animation of animations) animation.startTime = epoch;
      }
      Promise.all(animations.map(animation => animation.finished)).then(settle, settle);
      // Restore a useful static page if a host interrupts the animation timeline.
      watchdog = setTimeout(settle, 4500);
    } catch (error) {
      settle();
      console.warn('Surname intro skipped; the static artwork is available.', error);
    }
  }

  function tryStart() {
    if (document.hidden || state !== 'waiting') return;
    const rect = hero.getBoundingClientRect();
    if (rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight) start();
  }
  function onVisibility() {
    if (document.hidden && state === 'assembling') settle();
    else tryStart();
  }
  function onMotion(event) { if (event.matches) settle(); }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', settle);
  if (motion.addEventListener) motion.addEventListener('change', onMotion);
  else if (motion.addListener) motion.addListener(onMotion);
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(tryStart, {threshold:0});
    observer.observe(hero);
  }
  tryStart();
  // Older hosts without observers keep the approved still if the hero is offscreen.
  if (!observer && state === 'waiting' && !document.hidden) settle();
})();
