import { createGame, legalMove } from './core.js';

const $ = id => document.getElementById(id);
const canvas = $('board'), ctx = canvas.getContext('2d');
const viewport = $('viewport'), paper = $('paper');
const WORLD = { width: 1152, height: 1628, left: 72, top: 100, cell: 24 };
const colors = { human: '#b52431', computer: '#254fac' };
let game = createGame(), scale = 1, busy = true, ready = false, requestId = 0;
let cursor = { x: 21, y: 29 }, hover = null, keyboardFocus = false, gesture = null;
const patterns = {};
let timeout, worker;
const errors = {
  occupied: 'Здесь уже стоит точка. Выбери свободное пересечение.',
  'closed-zone': 'Эта область уже захвачена. Здесь больше не ходят.',
  outside: 'Поставь точку на пересечении внутри поля.',
  'capture-search-limit': 'Расчёт сложного окружения не завершён. Ход не засчитан; выбери другое пересечение.',
  'equal-area-contours-pending': 'Этот вариант окружения ещё не поддерживается. Ход не засчитан; выбери другое пересечение.',
  'contour-relationship-pending': 'Касание или вложенность контуров ещё в работе. Ход не засчитан; выбери другое пересечение.',
  'engine-error': 'Не удалось рассчитать ход. Партия сохранена; попробуй другое пересечение.',
};
function notice(text = '') { $('notice').textContent = text; $('notice').hidden = !text; }
function updateStatus() {
  $('human-score').textContent = game.score.human;
  $('computer-score').textContent = game.score.computer;
  $('move-count').textContent = `Ходов: ${game.moves.length}`;
  $('resign').disabled = !ready || busy || game.phase !== 'playing';
  $('new-game').disabled = !ready || busy;
  if (busy) $('status').textContent = ready ? 'Компьютер думает…' : 'Готовим лист…';
  else if (!ready) $('status').textContent = 'Не удалось открыть игру';
  else if (game.phase === 'finished') $('status').textContent = game.winner === 'draw' ? 'Ничья. Лист закончен.' : game.winner === 'human' ? 'Ты выиграл. Красная ручка решает.' : 'Компьютер выиграл. Этот лист — за синим.';
  else $('status').textContent = 'Твой ход. Красная ручка ждёт.';
}
const xy = p => ({ x: WORLD.left + p.x * WORLD.cell, y: WORLD.top + p.y * WORLD.cell });
function contourPath(contour) {
  ctx.beginPath(); contour.forEach((p, i) => { const q = xy(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath();
}
function draw() {
  ctx.setTransform(scale * Math.min(devicePixelRatio || 1, 2), 0, 0, scale * Math.min(devicePixelRatio || 1, 2), 0, 0);
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  ctx.lineWidth = .9; ctx.strokeStyle = '#607eb336'; ctx.beginPath();
  for (let x = 0; x < game.width; x++) { const a = xy({ x, y: 0 }), b = xy({ x, y: game.height - 1 }); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  for (let y = 0; y < game.height; y++) { const a = xy({ x: 0, y }), b = xy({ x: game.width - 1, y }); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  ctx.stroke();
  ctx.strokeStyle = '#b5243166'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(55, 50); ctx.lineTo(55, WORLD.height - 54); ctx.stroke();
  ctx.fillStyle = '#596477'; ctx.font = 'italic 18px Georgia'; ctx.fillText('Точки. На полях приличия.', WORLD.left, 64);
  for (const region of game.regions) {
    if (region.state === 'active') {
      ctx.save(); contourPath(region.contour); ctx.clip();
      if (patterns[region.side]) { ctx.fillStyle = patterns[region.side]; ctx.fillRect(0, 0, WORLD.width, WORLD.height); }
      else { ctx.strokeStyle = colors[region.side]; ctx.globalAlpha = .55; ctx.lineWidth = 1.5; for (let d = -WORLD.height; d < WORLD.width; d += 12) { ctx.beginPath(); ctx.moveTo(d, WORLD.height); ctx.lineTo(d + WORLD.height, 0); ctx.stroke(); } }
      ctx.restore();
    }
    contourPath(region.contour); ctx.strokeStyle = colors[region.side]; ctx.lineWidth = 2.4;
    ctx.setLineDash(region.state === 'waiting' ? [5, 4] : []); ctx.stroke(); ctx.setLineDash([]);
  }
  game.points.forEach((side, i) => {
    if (!side) return;
    const p = xy({ x: i % game.width, y: Math.floor(i / game.width) });
    ctx.globalAlpha = game.inactive[i] ? .45 : 1; ctx.fillStyle = colors[side];
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 4.2, 3.8, -.25, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  });
  const last = game.moves.at(-1);
  if (last) { const p = xy(last); ctx.strokeStyle = colors[last.side]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.stroke(); }
  const preview = keyboardFocus ? cursor : hover;
  if (preview && ready && !busy && game.phase === 'playing') {
    const p = xy(preview); ctx.strokeStyle = legalMove(game, preview.x, preview.y) ? '#777' : colors.human;
    ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.stroke();
  }
}
function setScale(value, center = true) {
  const oldScale = scale, centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / oldScale;
  const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / oldScale;
  scale = Math.max(.24, Math.min(1.8, value));
  paper.style.width = `${WORLD.width * scale}px`; paper.style.height = `${WORLD.height * scale}px`;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(WORLD.width * scale * dpr); canvas.height = Math.round(WORLD.height * scale * dpr);
  $('zoom-value').textContent = `${Math.round(scale * 100)}%`;
  $('zoom-in').disabled = scale >= 1.8; $('zoom-out').disabled = scale <= .24;
  draw();
  if (center) { viewport.scrollLeft = centerX * scale - viewport.clientWidth / 2; viewport.scrollTop = centerY * scale - viewport.clientHeight / 2; }
}
function fit() { setScale((viewport.clientWidth - 24) / WORLD.width, false); viewport.scrollLeft = 0; viewport.scrollTop = 0; }
function pointAt(event) {
  const r = canvas.getBoundingClientRect();
  const wx = (event.clientX - r.left) / r.width * WORLD.width;
  const wy = (event.clientY - r.top) / r.height * WORLD.height;
  const x = Math.round((wx - WORLD.left) / WORLD.cell), y = Math.round((wy - WORLD.top) / WORLD.cell);
  if (x < 0 || y < 0 || x >= game.width || y >= game.height) return null;
  const p = xy({ x, y });
  return Math.hypot(wx - p.x, wy - p.y) <= WORLD.cell * .65 ? { x, y } : null;
}
function send(action, point = {}) {
  if (!ready || busy || (action === 'move' && game.phase !== 'playing')) return;
  if (action === 'move') { const error = legalMove(game, point.x, point.y); if (error) { notice(errors[error] || 'Сейчас нельзя сделать этот ход.'); return; } }
  notice(); busy = true; hover = null; updateStatus(); draw();
  const id = ++requestId;
  worker.postMessage({ id, action, ...point });
  timeout = setTimeout(() => {
    worker.terminate(); busy = false; ready = false;
    notice('Расчёт занял слишком много времени. Последняя принятая позиция сохранена на экране. Перезагрузи страницу, чтобы начать заново.'); updateStatus();
  }, 12000);
}
$('zoom-in').addEventListener('click', () => setScale(scale * 1.3));
$('zoom-out').addEventListener('click', () => setScale(scale / 1.3));
$('fit').addEventListener('click', fit);
$('resign').addEventListener('click', () => send('resign'));
$('new-game').addEventListener('click', () => send('new'));
canvas.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button !== 0) return;
  gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false };
  canvas.setPointerCapture(e.pointerId); keyboardFocus = false;
});
canvas.addEventListener('pointermove', e => {
  if (gesture && gesture.id === e.pointerId) {
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    if (Math.hypot(dx, dy) > 7) gesture.moved = true;
    if (gesture.moved) { viewport.scrollLeft = gesture.left - dx; viewport.scrollTop = gesture.top - dy; hover = null; }
  } else hover = pointAt(e);
  draw();
});
canvas.addEventListener('pointerup', e => {
  if (!gesture || gesture.id !== e.pointerId) return;
  const moved = gesture.moved; gesture = null;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  if (!moved) { const p = pointAt(e); if (p) { cursor = p; send('move', p); } }
});
canvas.addEventListener('pointercancel', () => { gesture = null; hover = null; draw(); });
canvas.addEventListener('lostpointercapture', () => { gesture = null; });
canvas.addEventListener('pointerleave', () => { hover = null; draw(); });
canvas.addEventListener('focus', () => { keyboardFocus = true; draw(); });
canvas.addEventListener('blur', () => { keyboardFocus = false; draw(); });
canvas.addEventListener('keydown', e => {
  const keys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (keys[e.key]) {
    e.preventDefault(); keyboardFocus = true;
    cursor.x = Math.max(0, Math.min(game.width - 1, cursor.x + keys[e.key][0]));
    cursor.y = Math.max(0, Math.min(game.height - 1, cursor.y + keys[e.key][1]));
    const p = xy(cursor); viewport.scrollLeft = p.x * scale - viewport.clientWidth / 2; viewport.scrollTop = p.y * scale - viewport.clientHeight / 2; draw();
  } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); send('move', cursor); }
});
function loadPattern(side, filename) {
  return new Promise(resolve => { const img = new Image(); img.onload = () => { patterns[side] = ctx.createPattern(img, 'repeat'); resolve(); }; img.onerror = () => resolve(); img.src = filename; });
}
if (matchMedia('(max-width: 700px)').matches) {
  setScale(.85, false); viewport.scrollLeft = WORLD.width * scale / 2 - viewport.clientWidth / 2; viewport.scrollTop = WORLD.height * scale / 2 - viewport.clientHeight / 2;
} else fit();
updateStatus(); draw();
try {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.id !== requestId) return;
    clearTimeout(timeout); game = data.game; ready = true; busy = false;
    notice(data.error ? errors[data.error] || 'Ход не засчитан. Выбери другое пересечение.' : '');
    updateStatus(); draw();
  };
  worker.onerror = () => { clearTimeout(timeout); busy = false; ready = false; notice('Не удалось загрузить игру. Перезагрузи страницу.'); updateStatus(); };
  worker.postMessage({ id: requestId, action: 'new' });
} catch { busy = false; notice('Этот браузер не смог запустить игру. Открой её в актуальном браузере.'); updateStatus(); }
await Promise.all([loadPattern('human', './assets/captured-zone-red.png'), loadPattern('computer', './assets/captured-zone-blue.png')]);
updateStatus(); draw();
