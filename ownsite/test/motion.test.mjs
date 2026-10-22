// No browser / renderer: execute the actual intro controller against explicit DOM/API stubs.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = fs.readFileSync(new URL('../public/motion.js', import.meta.url), 'utf8');
const intro = '// INTRO_CONTRACT v1:' + source.split('// INTRO_CONTRACT v1:')[1];
const data = JSON.parse(intro.match(/const plates = (\[[\s\S]*?\n  \]);/)[1]);

class Events {
  listeners = new Map();
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type,event={}) { for (const fn of [...(this.listeners.get(type)||[])]) fn(event); }
  count() { return [...this.listeners.values()].reduce((n,x)=>n+x.size,0); }
}

function fixture(options={}) {
  const calls=[]; const timers=new Map(); const log=[];
  class Element {
    constructor(name='') { this.name=name;this.style={};this.dataset={};this.children=[];this.parent=null;this.className='';this.classes=new Set();this.classList={add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),contains:n=>this.classes.has(n)}; }
    setAttribute() {}
    appendChild(node) { node.parent=this;this.children.push(node);return node; }
    insertBefore(node,before) { node.parent=this;this.children.splice(this.children.indexOf(before),0,node); }
    remove() { if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;} }
    cloneNode() { return new Element(this.name); }
    animate(frames,timing) {
      let resolve,reject;
      const call={element:this,frames,timing,cancelled:false,done:false,startTime:null};
      call.finished=new Promise((ok,no)=>{resolve=ok;reject=no;});
      call.finish=()=>{call.done=true;resolve();};
      call.cancel=()=>{call.cancelled=true;if(!call.done){call.done=true;reject(new Error('AbortError'));}};
      calls.push(call);return call;
    }
  }
  if(options.unsupported) Element.prototype.animate=undefined;
  const artwork=new Element('original');
  const sourceNames=new Set(data.flatMap(x=>x.sources));
  artwork.querySelector=s=>options.missing===s.slice(1)?null:sourceNames.has(s.slice(1))?new Element(s.slice(1)):null;
  const copy=new Element('copy');
  const scene=new Element('scene');scene.appendChild(artwork);scene.appendChild(copy);
  const rect={top:options.offscreen?900:80,bottom:options.offscreen?1100:480,width:1150};
  const hero={getBoundingClientRect:()=>rect};
  scene.closest=()=>hero;
  scene.querySelector=s=>s==='.reference-art'?artwork:s==='.hero-copy'?copy:null;
  const document=new Events();Object.assign(document,{hidden:!!options.hidden,timeline:{currentTime:100},querySelector:()=>scene,createElement:()=>new Element()});
  const motion=new Events();motion.matches=!!options.reduced;
  const window=new Events();Object.assign(window,{innerHeight:800,CSS:{supports:()=>true},matchMedia:()=>motion});
  let observer;
  class IntersectionObserver {
    constructor(callback){this.callback=callback;this.disconnected=false;observer=this;}
    observe(){}
    disconnect(){this.disconnected=true;}
  }
  vm.runInNewContext(intro,{window,document,Element,IntersectionObserver,CSS:window.CSS,Promise,
    setTimeout:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    console:{warn:(...args)=>log.push(args)}});
  const settled=()=>{
    assert.equal(scene.classList.contains('is-assembling'),false);
    assert.deepEqual(scene.children,[artwork,copy]);
    assert.equal(document.count()+window.count()+motion.count(),0);
    assert.equal(timers.size,0);
    if(observer)assert.equal(observer.disconnected,true);
    assert(calls.every(c=>c.cancelled));
  };
  return {calls,timers,scene,document,window,motion,observer,rect,log,settled};
}
async function tick(){await Promise.resolve();await Promise.resolve();}

test('intro lifecycle settles once, cancels safely and respects reduced motion', async()=>{
  let f=fixture();
  assert.equal(f.calls.length,data.length+1);
  assert.equal(f.scene.classList.contains('is-assembling'),true);
  for(const call of f.calls){
    assert.equal(call.timing.duration+(call.timing.delay||0),3500);
    assert.equal(call.startTime,100);
    assert.equal(call.frames.at(-1).transform,'translate3d(0px,0px,0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)');
    call.finish();
  }
  await tick();f.settled();
  f.observer.callback();assert.equal(f.calls.length,37,'must not replay');
  for(const options of [{reduced:true},{unsupported:true}]){f=fixture(options);assert.equal(f.calls.length,0);f.settled();}
  f=fixture();f.document.hidden=true;f.document.emit('visibilitychange');await tick();f.settled();
  f=fixture();f.motion.matches=true;f.motion.emit('change',{matches:true});await tick();f.settled();
  f=fixture();f.window.emit('pagehide');await tick();f.settled();
  f=fixture();[...f.timers.values()][0]();await tick();f.settled();
  f=fixture();f.calls[0].cancel();await tick();f.settled();
  f=fixture({missing:'yu-ring'});await tick();assert.equal(f.log.length,1);f.settled();
  f=fixture({hidden:true});assert.equal(f.calls.length,0);f.document.hidden=false;f.document.emit('visibilitychange');assert.equal(f.calls.length,37);f.window.emit('pagehide');await tick();f.settled();
  f=fixture({offscreen:true});assert.equal(f.calls.length,0);f.rect.top=80;f.rect.bottom=480;f.observer.callback();assert.equal(f.calls.length,37);f.window.emit('pagehide');await tick();f.settled();
  console.log('PASS: completion, no replay, shared 3500ms clock, reduced motion, unsupported API, visibility, pagehide, timeout, cancellation, setup failure, hidden/offscreen first appearance.');
  console.log('Scope: actual JS controller in Node with DOM/WAAPI stubs; no browser paint or animation performance verified.');
});
