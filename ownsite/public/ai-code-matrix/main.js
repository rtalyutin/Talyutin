import { enhanceCases } from '/ai-code/cases.js';
import { enhanceDetails } from '/ai-code/motion/studio.js';
import { createCatVolume } from '/ai-code/motion/cat-volume.js';
import { createCatGaze } from '/ai-code/motion/cat-gaze.js';
import { createScheduler } from '/ai-code/motion/glyph-renderer.js';
import { createRain, sampleInterface, clamp } from './particles.js';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const forced=matchMedia('(forced-colors: active)');
enhanceCases(reduced);
enhanceDetails(reduced);
const control=document.querySelector('#matrix-control');
const roots=[...document.querySelectorAll('main > section,.site-footer')];
const records=roots.map(element=>({element,state:'pending',points:[],atoms:[],surfaces:[],animations:[]}));
const cat=document.querySelector('#cat');
let renderer,scheduler,observer,volume,gaze,disabled=false;
function reveal(record) {
  for(const animation of record.animations)animation.cancel();
  record.animations=[];
  record.element.classList.remove('matrix-pending','matrix-assembling');
  for(const atom of record.atoms)atom.classList.remove('matrix-piece');
  for(const surface of record.surfaces)surface.classList.remove('matrix-surface');
  record.points=[];record.drops=[];record.state='ready';record.element.dataset.matrixState='ready';
  if(record.element.id==='intro') {gaze?.wake();}
}
function updateControl(){control.textContent=records.some(r=>r.state!=='ready')?'Пропустить сборку':'Повторить сборку';}
function finishAll() {
  observer?.disconnect();
  records.forEach(reveal);
  scheduler?.remove(frame);renderer?.clear();
  document.documentElement.classList.remove('matrix-boot');clearTimeout(window.matrixBootTimeout);
  updateControl();
}
function stop(){disabled=true;finishAll();gaze?.stop();scheduler?.clear();control.hidden=true;}
function frame(time) {
  try {
    renderer.clear();
    let active=false;
    for(const record of records) {
      if(record.state!=='active')continue;
      const box=record.element.getBoundingClientRect();
      if(box.bottom<0||box.top>innerHeight){reveal(record);continue;}
      const elapsed=time-record.start;
      const progress=clamp((elapsed-record.lead)/record.duration);
      if(progress>=1){reveal(record);continue;}
      active=true;
    }
    if(active)renderer.draw(time,records.filter(record=>record.state==='active'));
    for(const record of records) {
      if(record.state!=='active')continue;
      const progress=clamp((time-record.start-record.lead)/record.duration);
      if(progress>.92 && !record.handoff) {
        record.handoff=true;
        for(const atom of record.atoms) {
          atom.classList.remove('matrix-piece');
          if(atom.animate)record.animations.push(atom.animate([{opacity:0},{opacity:1}],{duration:record.duration*.08,fill:'both'}));
        }
        for(const surface of record.surfaces)surface.classList.remove('matrix-surface');
      }
    }
    updateControl();return active;
  }catch{stop();return false;}
}
function start(record) {
  if(disabled||record.state!=='pending')return;
  try {
    const sampled=sampleInterface(record.element);
    Object.assign(record,sampled,{state:'active',start:performance.now(),lead:record.initial?650:150,duration:record.initial?3400:1650,handoff:false});
    renderer.attach(record);
    record.element.dataset.matrixTargets=String(record.points.length);
    record.element.dataset.matrixState='assembling';
    record.element.classList.add('matrix-assembling');
    record.atoms.forEach(atom=>atom.classList.add('matrix-piece'));
    record.surfaces.forEach(surface=>surface.classList.add('matrix-surface'));
    record.element.classList.remove('matrix-pending');
    scheduler.add(frame);
  }catch{stop();}
}
function prepare() {
  for(const record of records) {record.state='pending';record.initial=false;record.element.classList.add('matrix-pending');record.element.dataset.matrixState='pending';observer.observe(record.element);}
  const visible=records.filter(r=>{const b=r.element.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight;});
  visible.forEach(record=>{record.initial=true;start(record);});
}
async function boot() {
  if(reduced.matches||forced.matches||!window.IntersectionObserver){stop();return;}
  try {
    renderer=createRain(document.querySelector('#code-layer'));
    scheduler=createScheduler(stop);
    // Start perspective rain while fonts resolve; native content is released by
    // the independent watchdog if initialization cannot complete.
    const waiting=time=>{renderer.clear();renderer.draw(time,[]);return true;};scheduler.add(waiting);
    await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1100))]);
    scheduler.remove(waiting);
    if(disabled||window.matrixBootExpired){stop();return;}
    try{volume=createCatVolume(cat);}catch{volume=null;}
    if(volume)gaze=createCatGaze(cat,scheduler,()=>records[0].state==='ready',volume);
    observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)start(records.find(r=>r.element===entry.target));},{threshold:0});
    prepare();
    document.documentElement.classList.remove('matrix-boot');clearTimeout(window.matrixBootTimeout);
    control.hidden=false;
    control.addEventListener('click',()=>{
      if(records.some(r=>r.state!=='ready'))finishAll();
      else {observer.disconnect();prepare();}
    });
    // Opening a story or menu also assembles its newly visible contents.
    const expanded=new MutationObserver(mutations=>{
      for(const mutation of mutations) {
        const el=mutation.target;
        if(el.hidden || (el.matches('details')&&!el.open))continue;
        if(!el.matches('.case-story,details'))continue;
        let record=records.find(r=>r.element===el);
        if(!record){record={element:el,state:'pending',points:[],atoms:[],surfaces:[],animations:[]};records.push(record);}
        else {reveal(record);record.state='pending';}
        start(record);
      }
    });
    expanded.observe(document.querySelector('main'),{subtree:true,attributes:true,attributeFilter:['hidden','open']});
  }catch{stop();}
}
// Settle the current silhouettes before changing their ink; future sections
// still assemble with the new palette, and the theme control never restarts rain.
document.addEventListener('matrix-themechange',()=>{
  for(const record of records)if(record.state==='active')reveal(record);
  renderer?.clear();updateControl();
});
// Interaction always wins over the visual effect; no invisible focus traps.
document.addEventListener('focusin',event=>{
  for(const record of records)if(record.element.contains(event.target))reveal(record);
  updateControl();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')finishAll();});
window.addEventListener('resize',()=>{finishAll();renderer?.resize();});
window.addEventListener('hashchange',()=>{
  let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{return;}
  for(const record of records)if(record.element===target||record.element.contains(target))reveal(record);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)finishAll();});
window.addEventListener('pagehide',()=>{stop();volume?.dispose();});
reduced.addEventListener('change',()=>{if(reduced.matches)stop();});
forced.addEventListener('change',()=>{if(forced.matches)stop();});
const menu=document.querySelector('.mobile-menu');
menu?.addEventListener('click',event=>{if(event.target.closest('a'))menu.open=false;});
menu?.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});
boot();
