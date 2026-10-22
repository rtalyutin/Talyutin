import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { renderCatalogue, renderCase, canEmbed, liveUrlFor } from '../public/registry.js';

// Exercise the shipped controller with an explicit DOM/network model. This is
// not a browser renderer: iframe navigation, CSS, focus delivery and paint are
// intentionally outside this test's claims.
const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8')
  .replace(/^import .* from '\.\/registry\.js';\n/m, '');
const base = {
  slug: 'ycs', title: 'First work', category: 'Service', kind: 'it',
  summary: 'Summary', role: 'Role', status: 'Published', reveal: [], links: [],
  liveUrl: 'https://ycs.bar/first', embedAllowed: true
};
const other = { ...base, slug: 'other', title: 'Second work', liveUrl: null, embedAllowed: false };

function harness({ rows = [base, other], href = 'http://portfolio.test/', unavailable = false } = {}) {
  const timers = new Map();
  let timerId = 0;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag;
      this.children = [];
      this.dataset = {};
      this.attrs = {};
      this.listeners = new Map();
      this.hidden = false;
      this.open = false;
      this.textContent = '';
      this.classes = new Set();
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        contains: name => this.classes.has(name),
        toggle: name => {
          if (this.classes.has(name)) { this.classes.delete(name); return false; }
          this.classes.add(name); return true;
        }
      };
    }
    setAttribute(name, value) { this.attrs[name] = value; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    dispatch(name, event = {}) { return this.listeners.get(name)?.({ target: this, ...event }); }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    replaceChildren(...nodes) {
      for (const child of this.children) child.parent = null;
      this.children = []; this.raw = ''; this.append(...nodes);
    }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);
      this.parent = null;
    }
    matches(selector) {
      if (selector === this.tagName) return true;
      const attribute = selector.match(/^\[data-([a-z-]+)\]$/)?.[1];
      const key = attribute?.replace(/-([a-z])/g, (_, value) => value.toUpperCase());
      return !!key && Object.hasOwn(this.dataset, key);
    }
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
      ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100 }; }
    set innerHTML(value) {
      this.replaceChildren(); this.raw = value;
      // Only the controller's queried nodes are materialized. Text/escaping
      // remain the real shared renderers' responsibility, tested separately.
      for (const match of value.matchAll(/<(a|button|h2|p|div)\b([^>]*)>/g)) {
        const [, tag, attrs] = match;
        if (!/data-(project|launch|expand|frame-slot)/.test(attrs) && !['h2', 'p'].includes(tag)) continue;
        const node = new Element(tag);
        for (const data of attrs.matchAll(/data-([a-z-]+)(?:="([^"]*)")?/g)) {
          node.dataset[data[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = data[2] || '';
        }
        node.hidden = /\bhidden\b/.test(attrs);
        this.append(node);
      }
    }
    get innerHTML() { return this.raw || ''; }
  }
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, new Element(id === 'case-dialog' ? 'dialog' : 'div'));
    return elements.get(id);
  };
  element('works-data').content = { textContent: JSON.stringify(rows) };
  element('works-data').dataset.unavailable = String(unavailable);
  element('project-list').innerHTML = renderCatalogue(rows);
  const filters = ['all', 'product', 'systems', 'experience'].map(category => {
    const button = new Element('button'); button.dataset.filter = category; return button;
  });
  const documentEvents = new Element('document');
  const document = {
    body: new Element('body'), activeElement: null,
    getElementById: element, createElement: tag => new Element(tag),
    querySelectorAll: selector => selector === '[data-filter]' ? filters : [],
    addEventListener: (...args) => documentEvents.addEventListener(...args),
    dispatch: (...args) => documentEvents.dispatch(...args), hidden: false
  };
  const window = new Element('window');
  const location = { href };
  const addresses = [];
  const history = Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (_state, _title, url) => {
    location.href = String(url); addresses.push([method, String(url)]);
  }]));
  const pending = [];
  const context = createContext({
    document, window, location, history, URL, AbortController,
    renderCatalogue, renderCase, canEmbed, liveUrlFor,
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: (url, options) => new Promise((resolve, reject) => pending.push({ url, options, resolve, reject }))
  });
  runInContext(source, context);
  return {
    context, element, document, window, location, addresses, pending, timers,
    state: expression => runInContext(expression, context),
    open: (slug, push = false) => context.openCase(slug, push),
    refresh: () => context.refreshCatalogue(),
    filter: category => filters.find(button => button.dataset.filter === category).dispatch('click'),
    close: () => context.closeCase(),
    frame: () => element('case-body').querySelector('iframe'),
    launch: () => {
      const target = element('case-body').querySelector('[data-launch]');
      assert.ok(target, 'fixture has a launch control');
      return element('case-body').dispatch('click', { target });
    },
    answer(index, value, ok = true) {
      assert.ok(pending[index], `request ${index} exists`);
      // Deliberately permit late replies despite an aborted signal. The
      // controller must own its result independently of transport cancellation.
      pending[index].resolve({ ok, json: async () => structuredClone(value) });
    }
  };
}

async function open(h, slug = 'ycs', rows = [base, other]) {
  const index = h.pending.length;
  const done = h.open(slug, true);
  h.answer(index, rows);
  await done;
}

test('opening a case does not load an iframe; explicit launch rechecks and uses the current URL', async () => {
  const h = harness();
  await open(h);
  assert.equal(h.element('case-dialog').open, true);
  assert.equal(h.frame(), null);
  assert.equal(new URL(h.location.href).searchParams.get('work'), 'ycs');
  const done = h.launch();
  assert.equal(h.frame(), null);
  assert.equal(h.pending.length, 2);
  h.answer(1, [{ ...base, title: 'Fresh title', liveUrl: 'https://ycs.bar/changed' }, other]);
  await done;
  assert.equal(h.frame().src, 'https://ycs.bar/changed');
  assert.equal(h.frame().title, 'Демонстрация: Fresh title');
  assert.equal(h.frame().attrs.sandbox, 'allow-scripts allow-same-origin allow-forms allow-popups');
  assert.ok(h.pending.every(item => item.url === '/api/works' && item.options.cache === 'no-store'));
  assert.equal(h.timers.size, 0);
});

test('publication, embedding permission, URL and frame-origin revocation each prevent a pending launch', async t => {
  for (const [name, rows] of [
    ['unpublished', [other]],
    ['embedding disabled', [{ ...base, embedAllowed: false }, other]],
    ['URL removed', [{ ...base, liveUrl: null }, other]],
    ['origin outside CSP', [{ ...base, liveUrl: 'https://outside.example/' }, other]],
    ['empty catalogue', []]
  ]) {
    await t.test(name, async () => {
      const h = harness(); await open(h);
      const done = h.launch(); h.answer(1, rows); await done;
      assert.equal(h.frame(), null);
      if (!rows.some(row => row.slug === 'ycs')) assert.equal(h.state('activeWork'), null);
    });
  }
});

test('changing or closing a case unloads the active iframe immediately', async () => {
  const h = harness(); await open(h);
  const launch = h.launch(); h.answer(1, [base, other]); await launch;
  assert.ok(h.frame());
  const change = h.open('other');
  assert.equal(h.frame(), null, 'frame removed before the next response');
  h.answer(2, [base, other]); await change;
  assert.equal(h.state('activeSlug'), 'other');
  await open(h);
  const again = h.launch(); h.answer(4, [base, other]); await again;
  assert.ok(h.frame()); h.close();
  assert.equal(h.frame(), null);
  assert.equal(h.element('case-dialog').open, false);
  assert.equal(h.document.body.classList.contains('locked'), false);
  assert.equal(new URL(h.location.href).searchParams.has('work'), false);
});

test('an older request cannot overwrite a later case or catalogue', async () => {
  const h = harness();
  const old = h.open('ycs');
  const fresh = h.open('other');
  assert.equal(h.pending[0].options.signal.aborted, true);
  h.answer(1, [{ ...other, title: 'Current revision' }]); await fresh;
  h.answer(0, [{ ...base, title: 'Stale revision' }]); await old;
  assert.equal(h.state('activeSlug'), 'other');
  assert.equal(h.state('activeWork.title'), 'Current revision');
  assert.equal(h.state('works.length'), 1);
  assert.doesNotMatch(h.element('case-body').innerHTML, /Stale revision/);
  assert.equal(h.frame(), null);
  assert.equal(h.timers.size, 0);
});

test('closing during a request leaves the dialog and screen closed after a late reply', async () => {
  const h = harness();
  const done = h.open('ycs'); h.close();
  assert.equal(h.pending[0].options.signal.aborted, true);
  h.answer(0, [base, other]); await done;
  assert.equal(h.element('case-dialog').open, false);
  assert.equal(h.element('case-body').children.length, 0);
  assert.equal(h.state('activeWork'), null);
  assert.equal(h.frame(), null);
});

test('a stale launch cannot resume after closing and reopening the same slug', async () => {
  const h = harness(); await open(h);
  const abandonedLaunch = h.launch();
  h.close();
  const reopen = h.open('ycs');
  h.answer(2, [{ ...base, title: 'Reopened work' }, other]); await reopen;
  assert.equal(h.frame(), null);
  h.answer(1, [base, other]); await abandonedLaunch;
  assert.equal(h.state('activeWork.title'), 'Reopened work');
  assert.equal(h.frame(), null, 'reopening a case is not consent to resume an abandoned launch');
});

test('network and malformed-list failures retain no active work or iframe', async t => {
  for (const [name, complete] of [
    ['HTTP failure', h => h.answer(1, [], false)],
    ['invalid list', h => h.answer(1, { records: [base] })],
    ['network failure', h => h.pending[1].reject(new Error('Unavailable'))]
  ]) {
    await t.test(name, async () => {
      const h = harness(); await open(h);
      const done = h.launch(); complete(h); await done;
      assert.equal(h.frame(), null);
      assert.equal(h.state('activeWork'), null);
      assert.match(h.element('case-body').querySelector('h2').textContent, /Не удалось/);
      assert.equal(h.element('project-list').querySelectorAll('[data-project]').length, 0);
      assert.equal(h.state('worksUnavailable'), true);
      assert.equal(h.timers.size, 0);
    });
  }
});

test('direct links and history select cases without creating a second history entry', async () => {
  const h = harness({ href: 'http://portfolio.test/?work=ycs&mode=reveal' });
  assert.equal(h.pending.length, 1);
  h.answer(0, [base, other]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state('activeWork.slug'), 'ycs');
  assert.equal(h.frame(), null);
  assert.equal(h.addresses.length, 0);
  h.location.href = 'http://portfolio.test/?work=other&mode=reveal';
  h.window.dispatch('popstate');
  h.answer(1, [base, other]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state('activeWork.slug'), 'other');
  assert.equal(h.addresses.length, 0);
  h.location.href = 'http://portfolio.test/';
  h.window.dispatch('popstate');
  assert.equal(h.element('case-dialog').open, false);
  assert.equal(h.frame(), null);
  assert.equal(h.addresses.length, 0);
});

test('hiding the page unloads an active iframe and rechecks publication when it returns', async () => {
  const h = harness(); await open(h);
  const launch = h.launch(); h.answer(1, [base, other]); await launch;
  assert.ok(h.frame());
  h.document.hidden = true;
  h.document.dispatch('visibilitychange');
  assert.equal(h.frame(), null);
  assert.equal(h.state('activeWork'), null);
  h.document.hidden = false;
  h.document.dispatch('visibilitychange');
  h.answer(2, [other]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.frame(), null);
  assert.equal(h.state('activeWork'), null);
  assert.match(h.element('case-body').querySelector('h2').textContent, /недоступна/);
  assert.equal(h.element('project-list').querySelectorAll('[data-project]').length, 1);
});

test('the SSR unavailable flag survives filtering and clears when the page recovers', async () => {
  const h = harness({ rows: [], unavailable: true });
  h.filter('systems');
  assert.equal(h.state('worksUnavailable'), true);
  assert.equal(h.element('filter-status').textContent, 'Портфолио временно недоступно');
  assert.equal(h.element('work-count').textContent, '00');
  assert.equal(h.element('project-list').querySelectorAll('[data-project]').length, 0);

  h.window.dispatch('pageshow', { persisted: true });
  h.answer(0, [base, { ...other, slug: 'dashboard' }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state('worksUnavailable'), false);
  assert.equal(h.element('project-list').querySelectorAll('[data-project]').length, 2);
  assert.equal(h.element('work-count').textContent, '01');
  assert.equal(h.element('filter-status').textContent, 'Показано работ: 1');
  assert.equal(h.element('case-dialog').open, false);
  assert.equal(h.frame(), null);
});

test('a failed catalogue refresh removes stale cards and filters keep the unavailable state', async () => {
  const h = harness();
  assert.equal(h.element('project-list').querySelectorAll('[data-project]').length, 2);
  const refresh = h.refresh();
  h.answer(0, [], false); await refresh;
  assert.equal(h.element('project-list').querySelectorAll('[data-project]').length, 0);
  assert.equal(h.state('works.length'), 0);
  assert.match(h.element('project-list').innerHTML, /Портфолио временно недоступно/);
  for (const filter of ['product', 'experience', 'all']) {
    h.filter(filter);
    assert.equal(h.element('filter-status').textContent, 'Портфолио временно недоступно');
    assert.equal(h.element('work-count').textContent, '00');
  }
  const recovery = h.refresh();
  h.answer(1, [other]); await recovery;
  assert.equal(h.state('worksUnavailable'), false);
  assert.equal(h.element('project-list').querySelectorAll('[data-project]').length, 1);
  assert.equal(h.element('filter-status').textContent, 'Показано работ: 1');
  assert.doesNotMatch(h.element('project-list').innerHTML, /недоступно/);
  assert.equal(h.timers.size, 0);
});

test('a stale refresh failure cannot remove a newer successful catalogue', async () => {
  const h = harness();
  const old = h.refresh();
  const fresh = h.refresh();
  h.answer(1, [{ ...other, title: 'Current catalogue' }]); await fresh;
  h.pending[0].reject(new Error('Late failure')); await old;
  assert.equal(h.state('worksUnavailable'), false);
  assert.equal(h.state('works.length'), 1);
  assert.equal(h.state('works[0].title'), 'Current catalogue');
  assert.equal(h.element('project-list').querySelectorAll('[data-project]').length, 1);
  assert.equal(h.element('filter-status').textContent, 'Показано работ: 1');
  assert.equal(h.timers.size, 0);
});
