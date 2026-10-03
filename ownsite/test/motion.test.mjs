import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createMotion } from '../public/motion.js';

// Independent model checks: these execute shipped JS but do not measure browser
// layout, CSS, touch delivery, visual motion or OS preference behavior.
class Animation extends EventTarget {
  cancelled = 0;
  cancel() { this.cancelled++; this.dispatchEvent(new Event('cancel')); }
  finish() { this.dispatchEvent(new Event('finish')); }
}
class Element {
  dataset = {};
  isConnected = true;
  animations = [];
  selectors = new Map();
  classes = new Set();
  classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
  querySelector(selector) { return this.selectors.get(selector) ?? null; }
  animate(frames, options) {
    const animation = new Animation();
    this.animations.push({ animation, frames, options });
    return animation;
  }
}
function fixture(t, { reduced = false, observer = true } = {}) {
  const previous = { matchMedia: globalThis.matchMedia, IntersectionObserver: globalThis.IntersectionObserver };
  const preference = new EventTarget();
  preference.matches = reduced;
  const targets = [new Element(), new Element()];
  const view = new Element(), reveal = new Element(), context = new Element();
  const attrs = new Set(), scrolls = [], instances = [];
  const routes = ['clear', 'uncertain'].map(route => {
    const article = new Element(); article.selectors.set('[data-route]', { dataset: { route } }); return article;
  });
  const root = {
    documentElement: { toggleAttribute: (key, on) => on ? attrs.add(key) : attrs.delete(key) },
    defaultView: { scrollX: 7, scrollY: 481, scrollTo: value => scrolls.push(value) },
    querySelector: selector => ({ '.case-view': view, '.case-reveal': reveal, '#contact-intent': context })[selector],
    querySelectorAll: selector => selector === '[data-reveal]' ? targets : selector === '.approach-grid article' ? routes : []
  };
  globalThis.matchMedia = () => preference;
  globalThis.IntersectionObserver = observer ? class {
    observed = new Set();
    constructor(callback) { this.callback = callback; instances.push(this); }
    observe(element) { this.observed.add(element); }
    unobserve(element) { this.observed.delete(element); }
    disconnect() { this.observed.clear(); }
    enter(element) { if (this.observed.has(element)) this.callback([{ target: element, isIntersecting: true }]); }
  } : undefined;
  const motion = createMotion(root);
  t.after(() => { motion.destroy(); Object.assign(globalThis, previous); });
  const change = value => { preference.matches = value; preference.dispatchEvent(new Event('change')); };
  return { motion, preference, root, targets, view, reveal, context, routes, attrs, scrolls, instances, change };
}

function pendingApp() {
  const handlers = new Map(), effects = [], noop = () => {};
  const element = () => ({ addEventListener: noop, dataset: {}, classList: { add: noop, remove: noop }, style: { setProperty: noop } });
  const elements = new Map(['#device', '#device-screen', '#screen-viewport', '#screen-poster', '#screen-placeholder', '#activate-screen', '#device-grip'].map(id => [id, element()]));
  let settle;
  const document = { createElement: () => ({ getContext: () => null }), querySelector: selector => elements.get(selector), querySelectorAll: () => [], addEventListener: (name, fn) => handlers.set(name, fn) };
  const createMotion = () => ({ feedback: noop, watch: noop, openTicket: () => effects.push('open'), showCase: noop, chooseRoute: noop, destroy: noop, sync: noop });
  const context = vm.createContext({ ResizeObserver: class { observe() {} }, document, createMotion, renderCatalogue: () => '', URL, URLSearchParams,
    console: { error: noop, warn: noop }, fetch: () => new Promise(resolve => { settle = resolve; }), addEventListener: noop,
    location: { search: '?work=dashboard', href: 'http://localhost/?work=dashboard' },
    history: { pushState: () => effects.push('history'), replaceState: () => effects.push('history') },
    matchMedia: () => ({ matches: false }), scrollTo: () => effects.push('scroll') });
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInContext(source, context);
  const click = kind => {
    const link = { dataset: kind === 'work' ? { work: 'dashboard', targetMode: 'reveal' } : { modeLink: 'reveal' } };
    link.closest = selector => selector === 'a, button' || (kind === 'work' && selector === 'a[data-work]') || (kind === 'mode' && selector === '[data-mode-link]') ? link : null;
    const event = { target: link, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    handlers.get('click')(event); return event;
  };
  return { click, effects, fail: () => settle({ ok: false }) };
}

test('model: SSR card and mode links retain href fallback while initial API is pending', () => {
  const app = pendingApp();
  assert.equal(app.click('work').defaultPrevented, false);
  assert.equal(app.click('mode').defaultPrevented, false);
  assert.deepEqual(app.effects, []);
});
test('model: failed initial API does not strand SSR links or create a null selection URL', async () => {
  const app = pendingApp(); app.fail(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.click('work').defaultPrevented, false);
  assert.equal(app.click('mode').defaultPrevented, false);
  assert.deepEqual(app.effects, []);
});
test('model: rapid replacement cancels prior animation; stale completion cannot erase current tracking', t => {
  const f = fixture(t);
  f.motion.showCase('reveal', true); const first = f.reveal.animations[0].animation;
  f.motion.showCase('reveal', true); const latest = f.reveal.animations[1].animation;
  assert.equal(first.cancelled, 1); assert.equal(latest.cancelled, 0);
  first.finish(); f.change(true);
  assert.equal(latest.cancelled, 1);
  assert.equal(f.attrs.has('data-reduced-motion'), true);
  assert.deepEqual(f.scrolls, [{ top: 481, left: 7, behavior: 'instant' }]);
});
test('model: reduced before load suppresses motion without scrolling; runtime changes stop and resume effects', t => {
  const f = fixture(t, { reduced: true });
  f.motion.showCase('view'); assert.equal(f.view.animations.length, 0);
  assert.deepEqual(f.scrolls, []); assert.equal(f.instances[0].observed.size, 0);
  f.change(false); f.motion.showCase('view'); assert.equal(f.view.animations.length, 1);
  assert.equal(f.instances[0].observed.size, 2);
  f.change(true); assert.equal(f.view.animations[0].animation.cancelled, 1);
  f.motion.showCase('view'); assert.equal(f.view.animations.length, 1);
  assert.equal(f.instances[0].observed.size, 0);
});
test('model: section entry is observed once; revisiting or rescanning does not repeat it', t => {
  const f = fixture(t), section = f.targets[0], observer = f.instances[0];
  observer.enter(section); assert.equal(section.animations.length, 1);
  assert.equal(section.dataset.revealSeen, 'true'); assert.equal(observer.observed.has(section), false);
  f.motion.watch(); observer.enter(section); assert.equal(section.animations.length, 1);
  f.change(true); f.change(false); assert.equal(observer.observed.has(section), false);
});
test('model: unavailable observer and failed animation leave route state functional', t => {
  const f = fixture(t, { observer: false });
  f.context.animate = () => { throw new Error('synthetic animation failure'); };
  assert.doesNotThrow(() => { f.motion.watch(); f.motion.chooseRoute('uncertain'); });
  assert.equal(f.routes[0].classes.has('is-chosen'), false);
  assert.equal(f.routes[1].classes.has('is-chosen'), true);
  f.motion.chooseRoute('clear'); assert.equal(f.routes[0].classes.has('is-chosen'), true);
  assert.equal(f.routes[1].classes.has('is-chosen'), false);
  assert.equal(f.context.hidden, undefined);
});
test('model: observer refresh prunes detached sections and discovers new sections', t => {
  const f = fixture(t), observer = f.instances[0];
  f.targets[0].isConnected = false; const fresh = new Element(); f.targets.splice(0, 1, fresh);
  f.motion.watch(); assert.equal(observer.observed.size, 2); assert.equal(observer.observed.has(fresh), true);
});
test('model: destruction cancels effects and removes preference observer', t => {
  const f = fixture(t); f.motion.showCase('view'); f.motion.destroy();
  assert.equal(f.view.animations[0].animation.cancelled, 1);
  assert.equal(f.instances[0].observed.size, 0);
  f.change(true); assert.deepEqual(f.scrolls, []); assert.equal(f.attrs.has('data-reduced-motion'), false);
});
