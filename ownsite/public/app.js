import { renderCatalogue, renderCase, canEmbed, liveUrlFor } from './registry.js';
import { offlineWorks } from './offline-works.js';

const $ = id => document.getElementById(id);
const dialog = $('case-dialog');
const body = $('case-body');
const list = $('project-list');
let works = JSON.parse($('works-data').content.textContent);
let worksUnavailable = $('works-data').dataset.unavailable === 'true';
let activeSlug = '';
let activeWork = null;
let returnSlug = '';
let filter = 'all';
let request = null;
let revision = 0;

function filterWorks() {
  let count = 0;
  list.querySelectorAll('[data-project]').forEach(item => {
    item.hidden = filter !== 'all' && item.dataset.category !== filter;
    if (!item.hidden) count++;
  });
  $('work-count').textContent = String(count).padStart(2, '0');
  $('filter-status').textContent = worksUnavailable ? `Избранные проекты: ${count}` : `Показано работ: ${count}`;
}

function updateCatalogue() {
  list.innerHTML = renderCatalogue(works, activeSlug) || `<p class="catalogue-empty">${worksUnavailable ? 'Портфолио временно недоступно. Попробуйте зайти позже.' : 'Работы скоро появятся.'}</p>`;
  filterWorks();
}

function stopRequest() {
  revision++;
  request?.abort();
  request = null;
}

function resetScreen() {
  activeWork = null;
  dialog.classList.remove('expanded');
  body.replaceChildren(); // Unload any previous iframe before waiting for new data.
  $('prev-case').disabled = true;
  $('next-case').disabled = true;
}

function message(title, text) {
  body.innerHTML = '<div class="case-intro"><h2 class="case-title" id="case-title"></h2><p class="case-brief" role="status"></p></div>';
  body.querySelector('h2').textContent = title;
  body.querySelector('p').textContent = text;
}

function setAddress(slug, push) {
  const url = new URL(location.href);
  if (slug) { url.searchParams.set('work', slug); url.searchParams.set('mode', 'reveal'); }
  else { url.searchParams.delete('work'); url.searchParams.delete('mode'); url.searchParams.delete('tool'); }
  url.hash = 'works';
  history[push ? 'pushState' : 'replaceState'](null, '', url);
}

function showCase(slug) {
  updateCatalogue();
  const index = works.findIndex(work => work.slug === slug);
  if (index === -1) { message('Работа недоступна', 'Она больше не опубликована. Другие работы — в каталоге.'); return; }
  activeWork = works[index];
  body.innerHTML = renderCase(activeWork);
  body.scrollTop = 0;
  $('case-index').textContent = `Работа ${String(index + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`;
  $('prev-case').disabled = works.length < 2;
  $('next-case').disabled = works.length < 2;
}

async function openCase(slug, push = false) {
  stopRequest();
  resetScreen();
  activeSlug = slug;
  const current = revision;
  request = new AbortController();
  const controller = request;
  // A bounded request keeps failure actionable even if the connection stalls.
  const timeout = setTimeout(() => controller.abort(), 10000);
  $('case-index').textContent = 'Работа';
  message('Загрузка работы', 'Получаем актуальное описание…');
  if (!dialog.open) { dialog.showModal(); document.body.classList.add('locked'); $('close-case').focus(); }
  if (push) setAddress(slug, true);
  try {
    const response = await fetch('/api/works', { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    const fresh = await response.json();
    if (!Array.isArray(fresh)) throw new Error('Invalid portfolio');
    if (current !== revision || !dialog.open) return;
    works = fresh;
    worksUnavailable = false;
    showCase(slug);
    return current;
  } catch {
    if (current !== revision || !dialog.open) return;
    works = offlineWorks;
    worksUnavailable = true;
    showCase(slug);
    return current;
  } finally {
    clearTimeout(timeout);
    if (current === revision) request = null;
  }
}

async function refreshCatalogue() {
  stopRequest();
  const current = revision;
  request = new AbortController();
  const controller = request;
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/works', { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    const fresh = await response.json();
    if (!Array.isArray(fresh)) throw new Error('Invalid portfolio');
    if (current !== revision || dialog.open) return;
    works = fresh;
    worksUnavailable = false;
    updateCatalogue();
  } catch {
    if (current !== revision) return;
    works = offlineWorks;
    worksUnavailable = true;
    updateCatalogue();
  } finally {
    clearTimeout(timeout);
    if (current === revision) request = null;
  }
}

function closeCase(updateAddress = true) {
  stopRequest();
  resetScreen();
  activeSlug = '';
  dialog.close();
  document.body.classList.remove('locked');
  if (updateAddress) setAddress('', false);
  updateCatalogue();
  const target = [...list.querySelectorAll('[data-project]')].find(item => item.dataset.project === returnSlug && !item.hidden);
  (target || $('main')).focus();
}

if (typeof dialog.showModal === 'function') {
  $('selected-case')?.remove(); // Server-rendered links and case remain usable without JS.
  list.addEventListener('click', event => {
    const link = event.target.closest('[data-project]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    returnSlug = link.dataset.project;
    void openCase(returnSlug, true);
  });
  $('close-case').addEventListener('click', () => closeCase());
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeCase(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeCase();
  });
  for (const [id, direction] of [['prev-case', -1], ['next-case', 1]]) {
    $(id).addEventListener('click', async () => {
      const index = works.findIndex(work => work.slug === activeSlug);
      if (index < 0 || works.length < 2) return;
      const accepted = await openCase(works[(index + direction + works.length) % works.length].slug, true);
      if (accepted === revision && !$(id).disabled) $(id).focus();
    });
  }
  body.addEventListener('click', async event => {
    const launch = event.target.closest('[data-launch]');
    if (launch && activeWork && canEmbed(activeWork)) {
      // Recheck publication and embedding permission immediately before loading a frame.
      const slug = activeSlug;
      const accepted = await openCase(slug);
      if (accepted !== revision || activeSlug !== slug || !activeWork || !dialog.open || !canEmbed(activeWork)) return;
      const frame = document.createElement('iframe');
      frame.className = 'demo-frame';
      frame.title = `Демонстрация: ${activeWork.title}`;
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      frame.referrerPolicy = 'no-referrer';
      frame.src = liveUrlFor(activeWork);
      body.querySelector('[data-frame-slot]').replaceChildren(frame);
      body.querySelector('[data-launch]').textContent = 'Перезагрузить';
      body.querySelector('[data-expand]').hidden = false;
      body.querySelector('[data-launch]').focus();
    }
    const expand = event.target.closest('[data-expand]');
    if (expand && body.querySelector('iframe')) {
      const expanded = dialog.classList.toggle('expanded');
      expand.textContent = expanded ? 'Свернуть ↙' : 'Развернуть ↗';
      expand.setAttribute('aria-pressed', String(expanded));
    }
  });
  window.addEventListener('popstate', () => {
    const slug = new URL(location.href).searchParams.get('work');
    if (slug) void openCase(slug);
    else if (dialog.open) closeCase(false);
  });
  window.addEventListener('pagehide', () => { stopRequest(); resetScreen(); });
  function resume() {
    if (dialog.open && activeSlug) void openCase(activeSlug);
    else void refreshCatalogue();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopRequest(); if (dialog.open) resetScreen(); }
    else resume();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) resume(); });
  const initial = new URL(location.href).searchParams.get('work');
  if (initial && works.some(work => work.slug === initial)) { returnSlug = initial; void openCase(initial); }
}

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  filterWorks();
}));
