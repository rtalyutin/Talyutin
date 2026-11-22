// Approved copy, separate from rendering and disclosure behavior.
export const cases = [
  {
    id: 'case-1', code: 'yarkiberseason', project: 'ЯРКИБЕРСЕЗОН · КИБЕРСПОРТИВНАЯ ПЛАТФОРМА',
    site: { label: 'яркиберсезон.рф', url: 'https://яркиберсезон.рф/' },
    title: 'Обновления ломали работающий продукт',
    description: 'После обновлений переставало работать согласование времени матчей в Telegram. Капитанам приходилось договариваться в личных сообщениях.',
    result: 'Упорядочили модули и закрепили правила для ИИ-агентов. Новый код стал следовать единому стилю проекта — разработчикам стало проще его понимать и поддерживать.',
    story: [
      ['Продукт', ['Платформа для проведения киберспортивных турниров: сайт яркиберсезон.рф, Telegram-бот, парсер игр и турнирная админка. Капитаны команд согласовывали время матчей в мини-приложении внутри Telegram.']],
      ['Что мешало', ['После обновлений ломался функционал согласования времени матчей. Вместо того чтобы договориться внутри приложения, капитанам приходилось писать в личные сообщения.', 'Развитие продукта мешало текущей работе: изменения могли вернуть пользователей к ручным договорённостям во время проведения турнира.']],
      ['Что сделали', ['При рефакторинге упорядочили модульную структуру проекта и разделили ответственность компонентов.', 'Закрепили правила разработки в AGENTS.md и связали их с примерами уже реализованных модулей. ИИ-агенты получили общий ориентир: как устроен проект и как добавлять код в принятом стиле.']],
      ['Результат', ['ИИ-агенты стали генерировать код в едином стиле, опираясь на правила и существующие модули. Разработчикам стало проще разбираться в изменениях, проверять их и поддерживать проект.', 'Основатель продолжил развивать продукт с помощью ИИ. Упорядоченная структура и инструкции помогли сохранить понятный для разработчиков подход к дальнейшим изменениям.']],
    ],
  },
  {
    id: 'case-2', code: 'talyutin-online', project: 'TALYUTIN.ONLINE · ЗАПИСЬ ЧЕРЕЗ VK-БОТА',
    site: { label: 'talyutin.online', url: 'https://talyutin.online/' },
    title: 'Разработчики не могли взять код на поддержку',
    description: 'Код сервиса был собран в одном файле с самописным адаптером к базе данных. Такое устройство мешало передать продукт на сопровождение.',
    result: 'После доработки сервис передали обратно основателю. Он продолжил его использовать.',
    story: [
      ['Продукт', ['Сервис онлайн-записи в салоны красоты через бота во «ВКонтакте».']],
      ['Что мешало', ['Код был собран в одном файле, а для работы с базой данных использовался самописный адаптер. Разработчикам было трудно разобраться в устройстве сервиса и взять ответственность за дальнейшие изменения.', 'Работающий продукт требовалось подготовить к сопровождению людьми.']],
      // Detailed implementation claims require confirmation; use the approved fallback.
      ['Что сделали', ['Доработали кодовую базу для дальнейшего сопровождения и передали сервис обратно основателю.']],
      ['Результат', ['После доработки Илья передал сервис обратно основателю. Основатель продолжил его использовать.']],
    ],
  },
];

const englishCopy = {
  yarkiberseason: {
    project: 'YARKIBERSEASON · ESPORTS PLATFORM',
    title: 'Updates broke features that were already working',
    description: 'After updates, team captains could no longer agree on match times in the Telegram app. They had to arrange matches in private messages.',
    result: 'We organized the modules and set rules for AI agents. New code followed the project’s conventions, making it easier for developers to understand and maintain.',
    story: [
      ['Product', ['An esports tournament platform with the Yarkiberseason website, a Telegram bot, a game-data parser, and a tournament admin panel. Team captains agreed on match times in a Telegram Mini App.']],
      ['Problem', ['Updates broke match scheduling. Captains had to make arrangements in private messages.', 'A change to the product could force teams back to manual scheduling in the middle of a tournament.']],
      ['What we did', ['We refactored the modules and gave each component a clear responsibility.', 'We documented development rules in AGENTS.md and linked to examples from existing modules. The rules gave AI agents a guide to the project structure and conventions for new code.']],
      ['Result', ['AI agents began generating code in a consistent style using the rules and existing modules. Developers could understand, review, and maintain the changes more easily.', 'The founder continued developing the product with AI. The module structure and written rules helped keep future changes understandable to developers.']],
    ],
  },
  'talyutin-online': {
    project: 'TALYUTIN.ONLINE · BOOKINGS THROUGH A VK BOT',
    title: 'Developers could not take over maintenance',
    description: 'The service was built in a single file with a custom database adapter. This made it hard to hand over maintenance.',
    result: 'After we updated the service, we handed it back to the founder, who continued using it.',
    story: [
      ['Product', ['An online booking service for beauty salons, operated through a VK bot.']],
      ['Problem', ['The service was built in a single file and used a custom database adapter. Developers found it difficult to understand its structure and take responsibility for future changes.', 'The existing service needed to be ready for developers to maintain.']],
      ['What we did', ['We updated the codebase to make it easier to maintain and handed the service back to the founder.']],
      ['Result', ['Ilya handed the updated service back to the founder, who continued using it.']],
    ],
  },
};

const caseLabels = {
  ru: {
    newTab: 'открыть в новой вкладке', result: 'Результат', close: 'Свернуть', open: 'Как решили',
    similar: 'Столкнулись с похожей проблемой?', discuss: 'Обсудить задачу',
  },
  en: {
    newTab: 'opens in a new tab', result: 'Result', close: 'Collapse', open: 'See how we fixed it',
    similar: 'Facing a similar problem?', discuss: 'Discuss your project',
  },
};

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function renderCaseCard(item, locale = 'ru') {
  const { newTab, result, close, open, similar, discuss } = caseLabels[locale];
  return `<article id="${escape(item.id)}" class="case-card" data-case="${escape(item.code)}" aria-labelledby="${escape(item.id)}-title">
<div class="case-preview">
<div class="case-project"><p>${escape(item.project)}</p><a class="case-site" href="${escape(item.site.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(item.site.label)} — ${newTab}">${escape(item.site.label)} <span aria-hidden="true">↗</span></a></div>
<h3 id="${escape(item.id)}-title">${escape(item.title)}</h3>
<p class="case-description">${escape(item.description)}</p>
<div class="case-result"><p class="case-label">${result}</p><p>${escape(item.result)}</p></div>
<button type="button" class="case-toggle" aria-expanded="true" aria-controls="${escape(item.id)}-story" data-open-label="${open}" data-close-label="${close}" hidden>${close} −</button>
</div>
<div id="${escape(item.id)}-story" class="case-story">
${item.story.map(([heading, paragraphs]) => `<div class="case-chapter"><h4>${escape(heading)}</h4>${paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}</div>`).join('\n')}
<div class="case-contact"><p>${similar}</p><a class="button" href="#request" data-cta="discuss" data-case-cta="${escape(item.code)}">${discuss}</a></div>
</div>
</article>`;
}
export function renderCases(locale = 'ru') {
  return cases.map(item => renderCaseCard(locale === 'en' ? { ...item, ...englishCopy[item.code] } : item, locale)).join('\n');
}
