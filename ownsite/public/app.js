const $ = selector => document.querySelector(selector);
const state = { works: [], selected: null, selectedToolId: null, mode: 'view', rx: -5, ry: -15 };
const device = $('#device');
const screen = $('#device-screen');
const viewport = $('#screen-viewport');
const poster = $('#screen-poster');
const activate = $('#activate-screen');

function desiredState() {
  const params = new URLSearchParams(location.search);
  return { slug: params.get('work'), toolId: params.get('tool'), mode: params.get('mode') === 'reveal' ? 'reveal' : 'view' };
}

function address(slug, mode, replace = false, toolId = slug === state.selected ? state.selectedToolId : null) {
  const url = new URL(location.href);
  url.searchParams.set('work', slug);
  url.searchParams.set('mode', mode);
  if (toolId) url.searchParams.set('tool', toolId);
  else url.searchParams.delete('tool');
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

function safeWebUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().startsWith('#')) return null;
  try {
    const url = new URL(value, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function toolsFor(work) {
  const supplied = Array.isArray(work.tools) ? work.tools : [];
  const tools = supplied.filter(item => item && typeof item === 'object').map((item, index) => ({
    id: String(item.id ?? `tool-${index + 1}`),
    label: String(item.label ?? `Экран ${index + 1}`),
    url: safeWebUrl(item.url),
    orientation: item.orientation === 'landscape' ? 'landscape' : item.orientation === 'portrait' ? 'portrait' : work.orientation,
    poster: item.poster || work.poster,
    category: item.category || work.category
  })).filter(item => item.url);
  if (tools.length) return tools;
  const url = safeWebUrl(work.liveUrl);
  return url ? [{ id: 'main', label: work.category, url, orientation: work.orientation, poster: work.poster, category: work.category }] : [];
}

function selectedTool() {
  const work = state.works.find(item => item.slug === state.selected);
  return work && toolsFor(work).find(item => item.id === state.selectedToolId);
}

function updateRotation() {
  device.style.setProperty('--rx', `${state.rx}deg`);
  device.style.setProperty('--ry', `${state.ry}deg`);
}

function clearScreen() {
  screen.querySelector('iframe')?.remove();
  poster.hidden = true;
  activate.hidden = false;
}

function setPoster(work, tool) {
  poster.hidden = true;
  poster.alt = `Кадр работы ${work.title}${tool ? `: ${tool.label}` : ''}`;
  poster.onload = () => { if (poster.naturalWidth && !screen.querySelector('iframe')) poster.hidden = false; };
  poster.onerror = () => { poster.hidden = true; };
  const imageUrl = safeWebUrl(tool?.poster || work.poster);
  if (imageUrl) {
    poster.src = imageUrl;
    if (poster.complete && poster.naturalWidth && !screen.querySelector('iframe')) poster.hidden = false;
  } else {
    poster.removeAttribute('src');
  }
}

function renderToolSwitcher(tools, activeId) {
  const fieldset = $('#tool-switcher');
  const list = $('#tool-list');
  fieldset.hidden = tools.length < 2;
  list.replaceChildren();
  for (const tool of tools) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tool = tool.id;
    button.textContent = tool.label;
    button.setAttribute('aria-pressed', String(tool.id === activeId));
    list.append(button);
  }
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

function show(slug, mode, announce = true, requestedToolId = null) {
  const work = state.works.find(w => w.slug === slug) ?? state.works[0];
  if (!work) return;
  const changed = state.selected !== work.slug;
  const tools = toolsFor(work);
  const tool = tools.find(item => item.id === (requestedToolId || (changed ? null : state.selectedToolId))) || tools[0] || null;
  const toolChanged = changed || state.selectedToolId !== tool?.id;
  state.selected = work.slug;
  state.selectedToolId = tool?.id || null;
  state.mode = mode;
  document.body.dataset.theme = work.theme;
  document.body.dataset.orientation = tool?.orientation || work.orientation;
  document.body.dataset.mode = mode;
  $('#case-title').textContent = work.displayTitle;
  $('#case-title').setAttribute('aria-label', work.title);
  $('#case-category').textContent = work.category;
  $('.stage-mark-top').textContent = `ОТКРЫТЫЙ ДОСТУП / ${work.category}`;
  $('#case-summary').textContent = work.summary;
  $('#case-role').textContent = work.role;
  $('#case-status').textContent = work.status;
  renderToolSwitcher(tools, state.selectedToolId);
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
  const external = $('#external-link');
  external.href = tool?.url || '#works';
  external.hidden = !tool;
  external.textContent = tool ? `Открыть действующий экран: ${tool.label} ↗` : '';
  document.title = `Роман Талютин — ${work.title} / Работы в действии`;
  if (toolChanged) {
    clearScreen();
    setPoster(work, tool);
    state.rx = -5;
    state.ry = (tool?.orientation || work.orientation) === 'landscape' ? -10 : -15;
    updateRotation();
  }
  activate.hidden = !tool || !!screen.querySelector('iframe');
  if (announce) $('#case-announcement').textContent = `${work.category}: ${work.title}${tool ? `, ${tool.label}` : ''}. Режим: ${mode === 'reveal' ? 'разбор решения' : 'просмотр'}.`;
}

async function refresh(preferURL = false) {
  try {
    const response = await fetch('/api/works', { cache: 'no-store' });
    if (!response.ok) throw new Error('Portfolio unavailable');
    const next = await response.json();
    if (!Array.isArray(next)) throw new Error('Bad portfolio response');
    const oldSlug = state.selected;
    state.works = next;
    $('#portable-tool').hidden = !next.some(work => work.slug === 'ycs');
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
    show(chosen.slug, preferURL ? fromURL.mode : state.mode, false, preferURL ? fromURL.toolId : state.selectedToolId);
    if (fromURL.slug && !next.some(w => w.slug === fromURL.slug)) address(chosen.slug, state.mode, true);
    else if (preferURL && fromURL.toolId && fromURL.toolId !== state.selectedToolId) address(chosen.slug, state.mode, true, state.selectedToolId);
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
  const toolButton = event.target.closest('#tool-list button[data-tool]');
  if (toolButton) {
    const id = toolButton.dataset.tool;
    if (id === state.selectedToolId) return;
    address(state.selected, state.mode, false, id);
    show(state.selected, state.mode, true, id);
    [...document.querySelectorAll('#tool-list button[data-tool]')].find(button => button.dataset.tool === id)?.focus();
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
  const tool = selectedTool();
  if (!work || !tool) return;
  if (matchMedia('(max-width: 700px)').matches) {
    window.open(tool.url, '_blank', 'noopener');
    return;
  }
  const frame = document.createElement('iframe');
  frame.src = tool.url;
  frame.title = `Действующий экран: ${tool.label}, ${work.title}`;
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
  if (state.works.some(w => w.slug === next.slug)) {
    show(next.slug, next.mode, true, next.toolId);
    if (next.toolId && next.toolId !== state.selectedToolId) address(state.selected, state.mode, true, state.selectedToolId);
  }
  else refresh(true);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

// The separate planner is a self-contained prototype. The iframe only shares its three choices.
const plannerFrame = $('#planner-frame');
const detachTool = $('#detach-tool');
const toolStatus = $('#portable-status');
const plannerState = { teams: 8, venues: 1, duration: 45 };
function plannerUrl() { return `/tool.html?${new URLSearchParams(plannerState)}`; }
function syncPlannerLinks() {
  for (const id of ['detach-tool', 'open-tool-again', 'direct-tool']) $(`#${id}`).href = plannerUrl();
}
addEventListener('message', event => {
  if (event.source !== plannerFrame.contentWindow || event.origin !== location.origin || event.data?.type !== 'planner-state') return;
  const next = event.data;
  if (![8, 16].includes(next.teams) || ![1, 2].includes(next.venues) || ![45, 60].includes(next.duration)) return;
  Object.assign(plannerState, { teams: next.teams, venues: next.venues, duration: next.duration });
  syncPlannerLinks();
});
detachTool.addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  const newTab = window.open(detachTool.href, '_blank');
  if (!newTab) {
    toolStatus.textContent = 'НОВАЯ ВКЛАДКА ЗАБЛОКИРОВАНА / ОТКРОЙТЕ ПЛАНИРОВЩИК ПО ССЫЛКЕ НИЖЕ';
    $('#direct-tool').focus();
    return;
  }
  newTab.opener = null;
  $('#portable-machine').hidden = true;
  $('#portable-latch').hidden = true;
  $('#portable-socket').hidden = false;
  toolStatus.textContent = 'ИНСТРУМЕНТ ВЫНУТ / ОТКРЫЛСЯ ОТДЕЛЬНО';
  $('#return-tool').focus();
});
$('#return-tool').addEventListener('click', () => {
  $('#portable-machine').hidden = false;
  $('#portable-latch').hidden = false;
  $('#portable-socket').hidden = true;
  toolStatus.textContent = 'РАБОЧИЙ ПРОТОТИП / ТУРНИРНЫЙ ДЕНЬ';
  detachTool.focus();
});
syncPlannerLinks();
refresh(true);
