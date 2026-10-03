import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n').replace(/^import .* from '\.\/(registry|motion)\.js';\n/gm,'');
const startup=source.indexOf('\nrefresh(true);\n\n// Load 3D');
assert.ok(startup>=0,'Test real client functions before startup');
const base={slug:'one',title:'One',displayTitle:'One',summary:'Summary',role:'Role',status:'Status',reveal:[],category:'Category',theme:'neutral',orientation:'portrait',poster:'/a.jpg',liveUrl:'https://a.example/',embedAllowed:true};
const support=['registry','motion'].map(name=>readFileSync(new URL('../public/'+name+'.js',import.meta.url),'utf8').replace(/export function /g,'function ')).join('\n');
function harness(){
 class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.listeners={};this.attrs={};this.hidden=false;this.clientWidth=0;this.naturalWidth=0;this.complete=false;this.style={setProperty(){},removeProperty(){}};this.classList={add(){},remove(){}};}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  toggleAttribute(){}
  setAttribute(k,v){this.attrs[k]=v;}
  removeAttribute(k){delete this.attrs[k];if(k==='src')delete this.src;}
  addEventListener(k,v){this.listeners[k]=v;}
  getContext(){return null;} // Real browser verifies fonts and layout.
  querySelector(s){for(const child of this.children){if(child.tagName===s||(s==='.front'&&child.isFront))return child;const found=child.querySelector(s);if(found)return found;}return null;}
 }
 const elements=new Map(),element=s=>{if(!elements.has(s))elements.set(s,new Element());return elements.get(s);};
 element('#device-screen').append(element('#screen-viewport'));
 const front=new Element();front.isFront=true;element('#device').append(front);
 const rotate=['left','right','reset'].map(value=>{const b=new Element('button');b.dataset.rotate=value;return b;});
 const images=[],opened=[];
 const context=createContext({document:{documentElement:new Element(),querySelector:element,querySelectorAll:s=>s==='[data-rotate]'?rotate:[],createElement:t=>new Element(t),body:{dataset:{}},addEventListener(){},dispatchEvent(){}},window:{open:(...args)=>opened.push(args)},location:{href:'http://test/',search:''},history:{pushState(){},replaceState(){}},URL,URLSearchParams,CustomEvent:class{},Image:class extends Element{constructor(){super('img');images.push(this);}},ResizeObserver:class{observe(){}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),addEventListener(){},console,scrollTo(){},fetch:async()=>({ok:true,json:async()=>[]})});
 runInContext(support+'\n'+source.slice(0,startup),context);
 return {context,element,images,opened,rotate,front,display(patch={}){context.work={...base,...patch};runInContext('state.works=[work];show(work.slug,"view");',context);},frame:()=>element('#device-screen').querySelector('iframe'),click:()=>element('#activate-screen').listeners.click(),load(image=images.at(-1)){image.naturalWidth=100;image.onload();},state:code=>runInContext(code,context)};
}
test('metadata refresh preserves iframe and updates accessible titles',()=>{
 const h=harness();h.display();h.load();h.click();const f=h.frame();h.display({title:'Changed title',summary:'Changed summary'});assert.equal(h.frame(),f);assert.equal(f.src,base.liveUrl);assert.match(f.title,/Changed title/);assert.match(h.element('#screen-poster').alt,/Changed title/);assert.equal(h.element('#case-summary').textContent,'Changed summary');
});
test('poster refresh preserves live iframe',()=>{
 const h=harness();h.display();h.load();h.click();const f=h.frame();h.display({poster:'/b.jpg'});h.load();assert.equal(h.frame(),f);assert.equal(h.element('#screen-poster').src,'/b.jpg');assert.equal(h.element('#screen-poster').hidden,true);
});
test('live URL change revokes old iframe and requires activation',()=>{
 const h=harness();h.display();h.click();const f=h.frame();h.display({liveUrl:'https://b.example/'});assert.equal(h.frame(),null);assert.equal(h.element('#activate-screen').hidden,false);h.click();assert.notEqual(h.frame(),f);assert.equal(h.frame().src,'https://b.example/');
});
test('embedding revocation opens only external tab',()=>{
 const h=harness();h.display();h.click();h.display({embedAllowed:false});assert.equal(h.frame(),null);h.click();assert.equal(h.frame(),null);assert.deepEqual(h.opened,[[base.liveUrl,'_blank','noopener']]);
});
test('removing live URL clears iframe and activation',()=>{
 const h=harness();h.display();h.click();h.display({liveUrl:null});assert.equal(h.frame(),null);assert.equal(h.element('#activate-screen').hidden,true);h.click();assert.equal(h.frame(),null);assert.equal(h.opened.length,0);
});
test('stale poster load and error cannot replace current poster',()=>{
 const h=harness();h.display({poster:'/old.jpg'});const old=h.images.at(-1);h.display({poster:'/current.jpg'});h.load();h.load(old);old.onerror();assert.equal(h.element('#screen-poster').src,'/current.jpg');assert.equal(h.element('#screen-poster').hidden,false);assert.equal(h.element('#screen-placeholder').hidden,true);
});
test('empty catalogue clears iframe and pending poster events',async()=>{
 const h=harness();h.display();const pending=h.images.at(-1);h.click();assert.ok(h.frame());await h.context.refresh();h.load(pending);pending.onerror();assert.equal(h.frame(),null);assert.equal(h.state('state.selected'),null);assert.equal(h.state('state.screen'),null);assert.equal(h.element('.stage').hidden,true);assert.equal(h.element('#case-panel').hidden,true);assert.equal(h.element('#activate-screen').hidden,true);assert.equal(h.element('#screen-poster').hidden,true);
});
test('older response cannot overwrite newer accepted catalogue',async()=>{
 const h=harness(),pending=[];h.context.fetch=()=>new Promise(resolve=>pending.push(resolve));const old=h.context.refresh(),fresh=h.context.refresh();pending[1]({ok:true,json:async()=>[{...base,title:'Fresh',liveUrl:null}]});await fresh;pending[0]({ok:true,json:async()=>[{...base,title:'Stale',liveUrl:'https://revoked.example/'}]});await old;assert.equal(h.state('state.works[0].title'),'Fresh');assert.equal(h.state('state.works[0].liveUrl'),null);assert.equal(h.element('#activate-screen').hidden,true);assert.equal(h.frame(),null);
});
test('rotation exposes rear, completes full turn and resets',()=>{
 const h=harness();h.display();for(let i=0;i<12;i++)h.rotate[1].listeners.click();assert.equal(h.state('state.ry'),165);assert.equal(h.element('#device').dataset.side,'rear');assert.equal(h.front.inert,true);for(let i=0;i<12;i++)h.rotate[1].listeners.click();assert.equal(h.state('state.ry'),345);assert.equal(h.element('#device').dataset.side,'front');assert.equal(h.front.inert,false);h.rotate[2].listeners.click();assert.equal(h.state('state.ry'),-15);assert.equal(h.state('state.rx'),-5);
});
