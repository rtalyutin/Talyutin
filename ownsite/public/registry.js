// Shared server/client markup. Inputs are the already filtered public portfolio.
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

export function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function categoryFor(work) {
  if (work.kind === 'authorial' || ['stories', 'tochki'].includes(work.slug)) return 'experience';
  if (['sparrow-webmcp', 'postgres-audit', 'winline', 'dashboard'].includes(work.slug)) return 'systems';
  return 'product';
}

export function liveUrlFor(work) {
  return safeLink(work.liveUrl) || (work.slug === 'tochki' ? '/tochki/' : null);
}

export function canEmbed(work) {
  const url = liveUrlFor(work);
  // Keep this allowlist aligned with the server's frame-src CSP.
  return work.embedAllowed === true && !!url &&
    (url === '/tochki/' || ['https://xn--90aiaibl0ahlel5n.xn--p1ai', 'https://ycs.bar', 'https://yarcyberseason.ru'].includes(new URL(url).origin));
}

export function renderCatalogue(works, selectedSlug = '') {
  if (!Array.isArray(works)) return '';
  return works.map((work, index) => {
    const slug = String(work.slug ?? '');
    const href = `/?work=${encodeURIComponent(slug)}&mode=reveal#works`;
    return `<a class="project" href="${escapeHtml(href)}" data-project="${escapeHtml(slug)}" data-category="${categoryFor(work)}"${slug === selectedSlug ? ' aria-current="true"' : ''}><span class="num">${String(index + 1).padStart(2, '0')}</span><span class="project-title">${escapeHtml(work.title)}</span><span class="desc">${escapeHtml(work.summary || work.category)}</span><span class="open"><span class="open-label">Открыть</span><span class="arrow" aria-hidden="true">↗</span></span></a>`;
  }).join('');
}

export function renderCase(work, { titleId = 'case-title' } = {}) {
  const liveUrl = liveUrlFor(work);
  const links = (work.links || []).map(link => ({ ...link, href: safeLink(link.href) })).filter(link => link.href);
  if (liveUrl && !links.some(link => link.href === liveUrl)) links.unshift({ href: liveUrl, label: 'Открыть проект' });
  const outlets = links.map(link => `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} ↗</a>`).join('');
  const reveal = (work.reveal || []).map(part => `<section><h3>${escapeHtml(part.heading)}</h3><p>${escapeHtml(part.body)}</p></section>`).join('');
  return `<article>
    <div class="case-intro"><div><span class="case-kind mono">${escapeHtml(work.category)}</span><h2 class="case-title" id="${escapeHtml(titleId)}">${escapeHtml(work.title)}</h2></div><div><p class="case-brief">${escapeHtml(work.summary)}</p><p class="case-role"><strong>Мой вклад.</strong> ${escapeHtml(work.role)}</p><p class="case-status">${escapeHtml(work.status)}</p></div></div>
    <div class="case-reveal">${reveal}</div>
    <section class="frame-area" aria-label="Проект"><div class="frame-toolbar"><span class="mono">${liveUrl ? 'Просмотр проекта' : 'Материалы проекта'}</span><div class="frame-controls"><button data-launch${canEmbed(work) ? '' : ' hidden'}>Загрузить сайт</button><div class="case-links">${outlets}</div><button data-expand aria-pressed="false" hidden>Развернуть ↗</button></div></div><div data-frame-slot></div><p class="frame-note">${canEmbed(work) ? 'Сайт загружается по нажатию. Если просмотр недоступен, откройте ссылку в новой вкладке.' : links.length ? 'Открыть в новой вкладке — по ссылке выше.' : 'Демонстрация не подключена. Статус и материалы приведены в разборе.'}</p></section>
  </article>`;
}
