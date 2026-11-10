// Deliberately separate from motion: a failed decorative module cannot break links.
export const telegramDraft = 'Здравствуйте! Пишу с лендинга ИИКОТ. У меня работающий продукт, собранный с ИИ. Хочу обсудить, как подготовить код к передаче разработчикам';
export function trackGoal(name, params) {
  const id = Number(document.documentElement.dataset.metrikaId);
  if (!Number.isSafeInteger(id) || id <= 0 || typeof window.ym !== 'function') return;
  try { window.ym(id, 'reachGoal', name, params); } catch { /* Navigation stays native. */ }
}
if (typeof document !== 'undefined') {
  const id = Number(document.documentElement.dataset.metrikaId);
  if (Number.isSafeInteger(id) && id > 0) {
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    const script = document.createElement('script');
    script.src = 'https://mc.yandex.ru/metrika/tag.js';
    script.async = true;
    // No raw query/UTM, user links, field values, click map or session recording.
    window.ym(id, 'init', { defer: true, webvisor: false, clickmap: false, trackLinks: false, trackHash: false });
    window.ym(id, 'hit', location.origin + '/ai-code');
    document.head.append(script);
  }
  for (const link of document.querySelectorAll('[data-telegram]')) {
    link.href = 'https://t.me/evieer?text=' + encodeURIComponent(telegramDraft);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const block = link.closest('section')?.id || 'navigation';
    if (link.getAttribute('href').startsWith('https://t.me/evieer')) trackGoal('tg_click', { block });
    const target = link.getAttribute('href');
    if (['#request', '#cases', '#process'].includes(target)) trackGoal('cta_click', { block, target: target.slice(1) });
  });
  document.addEventListener('toggle', event => {
    if (event.target.matches?.('details[data-case]') && event.target.open) trackGoal('case_open', { case: event.target.dataset.case });
  }, true);
}
