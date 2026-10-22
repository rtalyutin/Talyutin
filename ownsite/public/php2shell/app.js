'use strict';
// Request data stays in this tab until the visitor chooses an external contact channel.
const $ = (id) => document.getElementById(id);
async function copyText(text, status, fallback) {
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    status.textContent = 'Скопировано.';
  } catch (_) {
    if (fallback) { fallback.focus(); fallback.select(); }
    else { const range = document.createRange(); range.selectNodeContents($('hosting-question')); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); }
    status.textContent = 'Автокопирование недоступно. Текст выделен — скопируйте его вручную.';
  }
}
$('copy-hosting').addEventListener('click', () => copyText($('hosting-question').textContent.trim(), $('hosting-status')));
function invalidateRequest() {
  $('request-result').hidden = true;
  $('request-text').value = '';
  $('request-status').textContent = '';
  $('email-request').href = 'mailto:R.talyutin@gmail.com';
}
$('request-form').addEventListener('input', invalidateRequest);
$('request-form').addEventListener('change', invalidateRequest);
$('incident-link').addEventListener('click', () => { $('situation').value = 'incident'; invalidateRequest(); });
$('site').addEventListener('input', () => { $('site').setCustomValidity(''); $('form-error').textContent = ''; });
$('request-form').addEventListener('submit', (event) => {
  event.preventDefault();
  invalidateRequest();
  const raw = $('site').value.trim();
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.') || url.port || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('Invalid domain');
    if (url.hostname.length > 253 || !/^[a-z0-9.-]+$/i.test(url.hostname) || url.hostname.split('.').some(label => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) throw new Error('Invalid hostname');
  } catch (_) {
    $('form-error').textContent = 'Укажите только домен, например example.ru. Не добавляйте путь, пароль или параметры ссылки.';
    $('site').focus();
    return;
  }
  $('form-error').textContent = '';
  const incident = $('situation').value === 'incident';
  const scenario = $('situation').selectedOptions[0].textContent;
  const lines = [incident ? 'Нужен разбор подозрения на взлом сайта.' : 'Нужна помощь с обновлением PHP против PHP2Shell.', 'Сайт: ' + url.origin, 'CMS: ' + $('cms').value, 'Ситуация: ' + scenario];
  if ($('details').value.trim()) lines.push('Дополнительно: ' + $('details').value.trim());
  lines.push(incident ? 'Прошу отдельно оценить расследование, восстановление и обновление PHP.' : 'Прошу проверить применимость исправления, согласовать объём, стоимость, окно работ и проверки после обновления.');
  $('request-text').value = lines.join('\n');
  $('email-request').href = 'mailto:R.talyutin@gmail.com?subject=' + encodeURIComponent(incident ? 'Разбор подозрения на взлом сайта' : 'Внедрение патча PHP2Shell') + '&body=' + encodeURIComponent($('request-text').value);
  $('request-status').textContent = '';
  $('request-result').hidden = false;
  $('result-title').focus({preventScroll:true});
  $('request-result').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'nearest'});
});
$('copy-request').addEventListener('click', () => copyText($('request-text').value, $('request-status'), $('request-text')));
$('prepare-request').disabled = false;
