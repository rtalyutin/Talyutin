import { renderCatalogue } from './registry.js';
import { createMotion } from './motion.js';

const $ = selector => document.querySelector(selector);
const motion = createMotion();
const state = { works: [], selected: null, mode: 'view', rx: -5, ry: -15, screen: null };
const device = $('#device');
const screen = $('#device-screen');
const viewport = $('#screen-viewport');
const poster = $('#screen-poster');
const placeholder = $('#screen-placeholder');
const activate = $('#activate-screen');

function desiredState() {
  const params = new URLSearchParams(location.search);
  return { slug: params.get('work'), mode: params.get('mode') === 'reveal' ? 'reveal' : 'view' };
}

function address(slug, mode, replace = false) {
  const url = new URL(location.href);
  url.searchParams.set('work', slug);
  url.searchParams.set('mode', mode);
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

function updateRotation() {
  const rear = Math.cos(state.rx * Math.PI / 180) * Math.cos(state.ry * Math.PI / 180) <= 0;
  device.dataset.side = rear ? 'rear' : 'front';
  device.querySelector('.front').inert = rear;
  device.style.setProperty('--rx', `${state.rx}deg`);
  device.style.setProperty('--ry', `${state.ry}deg`);
  document.dispatchEvent(new CustomEvent('phone-pose'));
}

let posterRequest = 0;
function clearScreen() {
  posterRequest++;
  screen.querySelector('iframe')?.remove();
  poster.hidden = true;
  placeholder.hidden = false;
  activate.hidden = false;
}

function setPoster(work) {
  const request = ++posterRequest;
  poster.hidden = true;
  placeholder.hidden = false;
  poster.alt = `Кадр работы ${work.title}`;
  poster.removeAttribute('src');
  if (!work.poster) return;
  const preview = new Image();
  preview.onload = () => {
    if (request !== posterRequest) return;
    poster.src = work.poster;
    if (!screen.querySelector('iframe')) {
      poster.hidden = false;
      placeholder.hidden = true;
    }
  };
  preview.onerror = () => {
    if (request !== posterRequest) return;
    poster.hidden = true; placeholder.hidden = false;
  };
  preview.src = work.poster;
}

function renderWorkLinks(work) {
  const container = $('#external-links');
  container.replaceChildren();
  const links = Array.isArray(work.links) && work.links.length
    ? work.links
    : work.liveUrl ? [{ label: 'Открыть действующий инструмент', href: work.liveUrl }] : [];
  for (const link of links) {
    const a = document.createElement('a');
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `${link.label} ↗`;
    container.append(a);
  }
  container.hidden = !links.length;
}

function renderReveal(work) {
  const container = $('#reveal-body');
  container.replaceChildren();
  for (const part of work.reveal) {
    const row = document.createElement('div');
    row.className = 'reveal-item';
    const heading = document.createElement('span');
    heading.textContent = part.heading;
    const text = document.createElement('p');
    text.textContent = part.body;
    row.append(heading, text);
    container.append(row);
  }
}

function renderSwitcher() {
  const list = $('#case-list');
  const catalogue = $('#work-list');
  list.replaceChildren();
  catalogue.innerHTML = renderCatalogue(state.works, state.selected);
  state.works.forEach((work, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `/?work=${encodeURIComponent(work.slug)}&mode=${state.mode}`;
    a.dataset.work = work.slug;
    const index = document.createElement('span');
    index.textContent = String(i + 1).padStart(2, '0');
    const name = document.createElement('strong');
    name.textContent = work.category;
    const title = document.createElement('small');
    title.textContent = work.title;
    a.append(index, name, title);
    li.append(a);
    list.append(li);

  });
  motion.watch();
}

const headingCanvas = document.createElement('canvas');
const headingContext = headingCanvas.getContext('2d');
function fitHeadings() {
  for (const selector of ['#manifesto', '#case-title', '#screen-placeholder-title']) {
    const element = $(selector);
    if (!element?.clientWidth || !headingContext) continue;
    element.style.removeProperty('font-size');
    const style = getComputedStyle(element);
    const size = parseFloat(style.fontSize);
    const spacing = parseFloat(style.letterSpacing) || 0;
    headingContext.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = [...element.childNodes].map(node => node.nodeName === 'BR' ? ' ' : node.textContent).join('');
    const renderedText = style.textTransform === 'uppercase' ? text.toLocaleUpperCase('ru') : style.textTransform === 'lowercase' ? text.toLocaleLowerCase('ru') : text;
    const words = renderedText.trim().split(/\s+/u);
    const widest = Math.max(...words.map(word => headingContext.measureText(word).width + Math.max(0, word.length - 1) * spacing));
    if (widest > element.clientWidth) {
      element.style.fontSize = `${size * (element.clientWidth - 2) / widest}px`;
    }
  }
}
addEventListener('resize', fitHeadings);
document.fonts?.ready.then(fitHeadings);
const headingWidths = new WeakMap();
const headingResize = new ResizeObserver(entries => {
  let changed = false;
  for (const entry of entries) {
    if (headingWidths.get(entry.target) !== entry.contentRect.width) {
      headingWidths.set(entry.target, entry.contentRect.width); changed = true;
    }
  }
  if (changed) fitHeadings();
});
for (const selector of ['.manifesto', '.case-panel', '#screen-viewport']) headingResize.observe($(selector));

function show(slug, mode, announce = true) {
  const work = state.works.find(w => w.slug === slug) ?? state.works[0];
  if (!work) return;
  const changed = state.selected !== work.slug;
  const modeChanged = state.mode !== mode;
  const previous = state.screen;
  const liveChanged = changed || previous?.liveUrl !== (work.liveUrl || '') || previous?.embedAllowed !== !!work.embedAllowed;
  const posterChanged = changed || previous?.poster !== (work.poster || '');
  state.screen = { liveUrl: work.liveUrl || '', embedAllowed: !!work.embedAllowed, poster: work.poster || '' };
  state.selected = work.slug;
  state.mode = mode;
  document.body.dataset.theme = work.theme;
  document.body.dataset.orientation = work.orientation;
  document.body.dataset.mode = mode;
  $('#case-title').textContent = work.displayTitle;
  $('#case-title').setAttribute('aria-label', work.title);
  $('#case-category').textContent = work.category;
  $('.stage-mark-top').textContent = `ОТКРЫТЫЙ ДОСТУП / ${work.category}`;
  $('#case-summary').textContent = work.summary;
  $('#case-role').textContent = work.role;
  $('#case-status').textContent = work.status;
  $('#screen-placeholder-category').textContent = work.category;
  $('#screen-placeholder-title').textContent = work.displayTitle;
  $('#screen-placeholder-caption').textContent = work.liveUrl ? 'Инструмент доступен по ссылке' : 'Материалы проекта · статус указан в карточке';
  $('.stage-mark-bottom').textContent = work.liveUrl ? 'ТЕЛЕФОН / 3D · ЭКРАН / ИНСТРУМЕНТ' : 'ТЕЛЕФОН / 3D · ЭКРАН / МАТЕРИАЛЫ ПРОЕКТА';
  $('#activate-label').textContent = work.embedAllowed ? 'Открыть живой экран' : 'Открыть в новой вкладке';
  const i = state.works.findIndex(w => w.slug === work.slug) + 1;
  $('#case-number').textContent = String(i).padStart(2, '0');
  $('#case-count').textContent = `${String(i).padStart(2, '0')} / ${String(state.works.length).padStart(2, '0')}`;
  renderReveal(work);
  for (const a of document.querySelectorAll('#case-list a')) {
    if (a.dataset.work === work.slug) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
    a.href = `/?work=${encodeURIComponent(a.dataset.work)}&mode=${mode}`;
  }
  for (const ticket of document.querySelectorAll('[data-ticket]')) {
    const selected = ticket.dataset.ticket === work.slug;
    ticket.classList.toggle('is-selected', selected);
    const link = ticket.querySelector('a[data-work]');
    if (selected) link?.setAttribute('aria-current', 'true');
    else link?.removeAttribute('aria-current');
  }
  for (const a of document.querySelectorAll('[data-mode-link]')) {
    a.href = `/?work=${encodeURIComponent(work.slug)}&mode=${a.dataset.modeLink}`;
    if (a.dataset.modeLink === mode) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
  renderWorkLinks(work);
  document.title = `Роман Талютин — ${work.title} / Работы в действии`;
  if (liveChanged) clearScreen();
  if (liveChanged || posterChanged) setPoster(work);
  poster.alt = `Кадр работы ${work.title}`;
  const liveFrame = screen.querySelector('iframe');
  if (liveFrame) liveFrame.title = `Действующий инструмент: ${work.title}, ${work.category}`;
  fitHeadings();
  if (changed) {
    state.rx = -5;
    state.ry = work.orientation === 'landscape' ? -10 : -15;
    updateRotation();
  }
  activate.hidden = !work.liveUrl || !!screen.querySelector('iframe');
  if (announce && (changed || modeChanged)) motion.showCase(mode, modeChanged && mode === 'reveal');
  if (announce) $('#case-announcement').textContent = `${work.category}: ${work.title}. Режим: ${mode === 'reveal' ? 'разбор решения' : 'просмотр'}.`;
}

let refreshRequest = 0;
async function refresh(preferURL = false) {
  const request = ++refreshRequest;
  try {
    const response = await fetch('/api/works', { cache: 'no-store' });
    if (!response.ok) throw new Error('Portfolio unavailable');
    const next = await response.json();
    if (request !== refreshRequest) return;
    if (!Array.isArray(next)) throw new Error('Bad portfolio response');
    const oldSlug = state.selected;
    const focused = document.activeElement?.closest('a[data-work]');
    const focusList = focused?.closest('#case-list, #work-list')?.id;
    const focusSlug = focused?.dataset.work;
    state.works = next;
    renderSwitcher();
    const fromURL = desiredState();
    const slug = preferURL ? fromURL.slug : oldSlug || fromURL.slug;
    const chosen = next.find(w => w.slug === slug) ?? next[0];
    if (!chosen) {
      clearScreen();
      state.selected = null; state.screen = null;
      activate.hidden = true;
      $('#case-panel').hidden = true;
      $('.stage').hidden = true;
      return;
    }
    $('#case-panel').hidden = false;
    $('.stage').hidden = false;
    show(chosen.slug, preferURL ? fromURL.mode : state.mode, false);
    if (focusList) {
      const links = document.querySelectorAll(`#${focusList} a[data-work]`);
      const focusTarget = Array.from(links).find(a => a.dataset.work === focusSlug)
        ?? Array.from(links).find(a => a.dataset.work === chosen.slug);
      focusTarget?.focus({ preventScroll: true });
    }
    if (fromURL.slug && !next.some(w => w.slug === fromURL.slug)) address(chosen.slug, state.mode, true);
  } catch (error) {
    if (request !== refreshRequest) return;
    console.error('Не удалось обновить витрину', error);
  }
}

document.addEventListener('click', event => {
  const action = event.target.closest('a, button');
  if (action) motion.feedback(action);
  const route = event.target.closest('a[data-route]');
  if (route && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
    const clear = route.dataset.route === 'clear';
    const context = $('#contact-intent');
    context.textContent = clear
      ? 'Есть понятная задача: расскажите, какой результат должен заработать и что уже готово.'
      : 'Много неизвестного: опишите ситуацию и главный вопрос, который нужно проверить первым.';
    context.hidden = false;
    const email = $('#contact-outlets a[href^="mailto:"]');
    if (email) {
      const address = email.href.split('?')[0];
      const subject = clear ? 'Понятная ИТ-задача' : 'Задача с неопределённостью';
      email.href = `${address}?subject=${encodeURIComponent(subject)}`;
    }
    motion.chooseRoute(route.dataset.route);
  }
  const workLink = event.target.closest('a[data-work]');
  if (workLink && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
    const slug = workLink.dataset.work;
    // Keep the SSR link usable before the API arrives or when it fails.
    if (!state.works.some(w => w.slug === slug)) return;
    event.preventDefault();
    const mode = workLink.dataset.targetMode || state.mode;
    motion.openTicket(workLink);
    address(slug, mode);
    show(slug, mode);
    if (workLink.closest('#work-list')) scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    return;
  }
  const modeLink = event.target.closest('[data-mode-link]');
  if (modeLink && state.selected && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
    event.preventDefault();
    const mode = modeLink.dataset.modeLink;
    address(state.selected, mode);
    show(state.selected, mode);
  }
});

activate.addEventListener('click', () => {
  const work = state.works.find(w => w.slug === state.selected);
  if (!work?.liveUrl) return;
  if (!work.embedAllowed || matchMedia('(max-width: 820px)').matches) {
    window.open(work.liveUrl, '_blank', 'noopener');
    return;
  }
  const frame = document.createElement('iframe');
  frame.src = work.liveUrl;
  frame.title = `Действующий инструмент: ${work.title}, ${work.category}`;
  frame.loading = 'eager';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
  poster.hidden = true;
  activate.hidden = true;
  viewport.append(frame);
});

document.querySelectorAll('[data-rotate]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.rotate === 'reset') { state.rx = -5; state.ry = document.body.dataset.orientation === 'landscape' ? -10 : -15; }
  else state.ry += button.dataset.rotate === 'left' ? -15 : 15;
  updateRotation();
}));

let pointer = null;
const grip = $('#device-grip');
grip.addEventListener('pointerdown', event => {
  pointer = { x: event.clientX, y: event.clientY, rx: state.rx, ry: state.ry };
  grip.setPointerCapture(event.pointerId);
  device.classList.add('is-dragging');
});
grip.addEventListener('pointermove', event => {
  if (!pointer) return;
  state.ry = pointer.ry + (event.clientX - pointer.x) * .35;
  state.rx = Math.max(-35, Math.min(35, pointer.rx - (event.clientY - pointer.y) * .28));
  updateRotation();
});
for (const end of ['pointerup', 'pointercancel', 'lostpointercapture']) grip.addEventListener(end, () => {
  pointer = null;
  device.classList.remove('is-dragging');
});

addEventListener('popstate', () => {
  const next = desiredState();
  if (state.works.some(w => w.slug === next.slug)) show(next.slug, next.mode);
  else refresh(true);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
addEventListener('pagehide', event => { if (!event.persisted) motion.destroy(); });
addEventListener('pageshow', event => {
  if (event.persisted) { motion.sync(); refresh(); }
});
refresh(true);

// Load 3D independently: the portfolio and live screen also work without WebGL.
import('/phone-viewer.js').then(({ mountPhone }) => mountPhone({
  device, space: document.querySelector('.device-space'), getPose: () => ({ rx: state.rx, ry: state.ry })
})).catch(error => {
  device.dataset.modelStatus = 'fallback';
  console.warn('3D-корпус недоступен, экран продолжает работать', error);
});