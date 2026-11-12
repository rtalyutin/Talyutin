// Independent of decorative modules: native links also work if motion fails.
export function trackGoal(name, params) {
  const id = Number(document.documentElement.dataset.metrikaId);
  if (!Number.isSafeInteger(id) || id <= 0 || typeof window.ym !== 'function') return;
  try { window.ym(id, 'reachGoal', name, params); } catch { /* Analytics cannot block an action. */ }
}
const counter = Number(document.documentElement.dataset.metrikaId);
if (Number.isSafeInteger(counter) && counter > 0) {
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const script = document.createElement('script');
  script.src = 'https://mc.yandex.ru/metrika/tag.js';
  script.async = true;
  window.ym(counter, 'init', { defer: true, webvisor: false, clickmap: false, trackLinks: false, trackHash: false });
  window.ym(counter, 'hit', location.origin + (location.pathname === '/ai-code-matrix' ? '/ai-code-matrix' : '/ai-code'));
  document.head.append(script);
}
const directOpening = new WeakSet();
function openAnchor() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!(target instanceof HTMLDetailsElement) || target.open) return;
  directOpening.add(target);
  target.open = true;
}
document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href]');
  if (!link) return;
  const block = link.closest('section')?.id || 'navigation';
  if ('telegram' in link.dataset) trackGoal('tg_click', { block });
  if (link.dataset.cta) trackGoal('cta_click', { block, target: link.dataset.cta, ...(link.dataset.caseCta ? { code: link.dataset.caseCta } : {}) });
});
document.querySelectorAll('details').forEach(details => details.addEventListener('toggle', () => {
  const source = directOpening.has(details) ? 'direct_anchor' : 'user';
  directOpening.delete(details);
  if (!details.open) return;
  if (details.dataset.case) trackGoal('case_open', { code: details.dataset.case, source });
  if (details.dataset.detail) trackGoal('details_open', { code: details.dataset.detail });
}));
window.addEventListener('hashchange', openAnchor);
openAnchor();
