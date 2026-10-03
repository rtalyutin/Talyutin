const $ = selector => document.querySelector(selector);
const state = { works: [], selected: null, mode: 'view', rx: -5, ry: -15 };
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
  device.style.setProperty('--rx', `${state.rx}deg`);
  device.style.setProperty('--ry', `${state.ry}deg`);
}

function clearScreen() {
  screen.querySelector('iframe')?.remove();
  poster.hidden = true;
  placeholder.hidden = false;
  activate.hidden = false;
}

function setPoster(work) {
  poster.hidden = true;
  poster.alt = `Кадр работы ${work.title}`;
  poster.onload = () => {
    if (poster.naturalWidth && !screen.querySelector('iframe')) {
      poster.hidden = false;
      placeholder.hidden = true;
    }
  };
  poster.onerror = () => { poster.hidden = true; placeholder.hidden = false; };
  if (work.poster) {
    poster.src = work.poster;
    if (poster.complete && poster.naturalWidth && !screen.querySelector('iframe')) {
      poster.hidden = false;
      placeholder.hidden = true;
    }
  } else {
    poster.removeAttribute('src');
    placeholder.hidden = false;
  }
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
  catalogue.replaceChildren();
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

    const article = document.createElement('article');
    article.className = 'work-row';
    const kind = document.createElement('span');
    kind.textContent = work.category;
    const h3 = document.createElement('h3');
    h3.textContent = work.title;
    const summary = document.createElement('p');
    summary.textContent = work.summary;
    const link = document.createElement('a');
    link.href = `/?work=${encodeURIComponent(work.slug)}&mode=reveal`;
    link.dataset.work = work.slug;
    link.dataset.targetMode = 'reveal';
    link.textContent = 'Раскрыть работу ↗';
    article.append(kind, h3, summary, link);
    catalogue.append(article);
  });
}

function show(slug, mode, announce = true) {
  const work = state.works.find(w => w.slug === slug) ?? state.works[0];
  if (!work) return;
  const changed = state.selected !== work.slug;
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
  $('.stage-mark-bottom').textContent = work.liveUrl ? 'МОДЕЛЬ / ВРЕМЕННЫЙ КОРПУС · ЭКРАН / ИНСТРУМЕНТ' : 'МОДЕЛЬ / ВРЕМЕННЫЙ КОРПУС · ЭКРАН / МАТЕРИАЛЫ ПРОЕКТА';
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
  for (const a of document.querySelectorAll('[data-mode-link]')) {
    a.href = `/?work=${encodeURIComponent(work.slug)}&mode=${a.dataset.modeLink}`;
    if (a.dataset.modeLink === mode) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
  renderWorkLinks(work);
  document.title = `Роман Талютин — ${work.title} / Работы в действии`;
  if (changed) {
    clearScreen();
    setPoster(work);
    state.rx = -5;
    state.ry = work.orientation === 'landscape' ? -10 : -15;
    updateRotation();
  }
  activate.hidden = !work.liveUrl || !!screen.querySelector('iframe');
  if (announce) $('#case-announcement').textContent = `${work.category}: ${work.title}. Режим: ${mode === 'reveal' ? 'разбор решения' : 'просмотр'}.`;
}

async function refresh(preferURL = false) {
  try {
    const response = await fetch('/api/works', { cache: 'no-store' });
    if (!response.ok) throw new Error('Portfolio unavailable');
    const next = await response.json();
    if (!Array.isArray(next)) throw new Error('Bad portfolio response');
    const oldSlug = state.selected;
    state.works = next;
    renderSwitcher();
    const fromURL = desiredState();
    const slug = preferURL ? fromURL.slug : oldSlug || fromURL.slug;
    const chosen = next.find(w => w.slug === slug) ?? next[0];
    if (!chosen) {
      $('#case-panel').hidden = true;
      $('.stage').hidden = true;
      return;
    }
    $('#case-panel').hidden = false;
    $('.stage').hidden = false;
    show(chosen.slug, preferURL ? fromURL.mode : state.mode, false);
    if (fromURL.slug && !next.some(w => w.slug === fromURL.slug)) address(chosen.slug, state.mode, true);
  } catch (error) {
    console.error('Не удалось обновить витрину', error);
  }
}

document.addEventListener('click', event => {
  const route = event.target.closest('a[data-route]');
  if (route) {
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
  }
  const workLink = event.target.closest('a[data-work]');
  if (workLink && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
    event.preventDefault();
    const slug = workLink.dataset.work;
    if (!state.works.some(w => w.slug === slug)) return;
    const mode = workLink.dataset.targetMode || state.mode;
    address(slug, mode);
    show(slug, mode);
    if (workLink.closest('#work-list')) scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    return;
  }
  const modeLink = event.target.closest('[data-mode-link]');
  if (modeLink && !event.metaKey && !event.ctrlKey && event.button === 0) {
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
  else state.ry = Math.max(-75, Math.min(75, state.ry + (button.dataset.rotate === 'left' ? -15 : 15)));
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
  state.ry = Math.max(-75, Math.min(75, pointer.ry + (event.clientX - pointer.x) * .35));
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
refresh(true);
