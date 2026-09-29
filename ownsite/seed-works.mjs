// Public, non-confidential editorial summaries. show=0 is the default for unapproved cards.
// Never add private client data, unreleased media, or credentials to this public repository.
const miniApp = 'https://xn--90aiaibl0ahlel5n.xn--p1ai/tg';
const ycsSite = 'https://xn--90aiaibl0ahlel5n.xn--p1ai/';

export const seedWorks = [
  {
    id: 'ycs', slug: 'ycs', title: 'ЯрКиберСезон — турнир как работающая система', display_title: 'ЯКС',
    kind: 'it', category: 'Турнирная система', status: 'Сайт и Mini App работают',
    role: 'Основатель и продуктовый владелец; организация турниров, постановка задач и координация реализации.',
    summary: 'Один турнирный контур: сайт, Mini App, команды, календарь и матчи. Пасхалка и HUD находятся на других стадиях.',
    theme: 'tear', orientation: 'portrait', live_url: miniApp,
    poster: '/assets/ycs-miniapp-poster.jpg', featured_order: 1, catalogue_order: 1, show: 1,
    tools_json: [
      { id: 'miniapp', label: 'Mini App', url: miniApp, orientation: 'portrait', poster: '/assets/ycs-miniapp-poster.jpg', category: 'Telegram Mini App' },
      { id: 'site', label: 'Сайт турнира', url: ycsSite, orientation: 'landscape', poster: '/assets/ycs-backdrop.jpg', category: 'Сайт турнира' }
    ],
    reveal_json: [
      { heading: 'Задача', body: 'Связать сезоны CS2 и Dota 2, команды, правила, матчи и путь зрителя в одну систему.' },
      { heading: 'Решение', body: 'Два действующих входа ведут к одному проекту. На сайте и в Mini App можно открыть сезон и перейти к его разделам.' },
      { heading: 'Стадии', body: 'Сайт и Mini App работают; пасхалка есть в коде, а HUD подготовлен как концепция и ТЗ. Планировщик ниже — самостоятельный демонстрационный расчёт, не расписание текущего турнира.' }
    ]
  },
  {
    id: 'stories', slug: 'stories', title: 'Недетские сказки — истории в тексте и изображениях',
    kind: 'authorial', category: 'Истории', status: 'Опубликована часть историй',
    role: 'Инициатор, сюжетные решения и редактура; авторство отдельных иллюстраций уточняется.',
    summary: 'Авторский мир в текстах, рисунках и комиксах. Пример публикации подтверждён; актуальный адрес сайта требует проверки.',
    theme: 'folio', catalogue_order: 2, show: 0
  },
  {
    id: 'booking', slug: 'booking', title: 'Онлайн-запись — свободное время без переписки',
    kind: 'it', category: 'Сервис', status: 'В реализации',
    role: 'Сценарии, бизнес-правила и критерии приёмки.',
    summary: 'Подготовлены правила записи и синтетические данные; подключение VK и сквозная запись не подтверждены.',
    theme: 'neutral', catalogue_order: 3, show: 0
  },
  {
    id: 'winline', slug: 'winline', title: 'Winline — история купонов превращается в данные',
    kind: 'it', category: 'Расширение', status: 'Проверено частично',
    role: 'Постановка требований и проверка живой дозагрузки; авторство всего кода не заявляется.',
    summary: 'Расширение дозагружает историю; сервер статистики проверен локально. Сквозной онлайн-сервис не подтверждён.',
    theme: 'neutral', catalogue_order: 4, show: 0
  },
  {
    id: 'tochki', slug: 'tochki', title: 'Точки — лист тетради против компьютера',
    kind: 'authorial', category: 'Игра', status: 'В разработке',
    role: 'Выбор формата, уточнение правил и критериев расчёта захвата.',
    summary: 'Подготовлены ТЗ и графические материалы; проверенной партии против компьютера пока нет.',
    theme: 'folio', catalogue_order: 5, show: 0
  },
  {
    id: 'wb-cards', slug: 'wb-cards', title: 'Карточки для Wildberries — галерея полки',
    kind: 'content', category: 'Маркетплейс', status: 'Редакционный кандидат',
    role: 'Вклад и право показа от своего имени требуют уточнения.',
    summary: 'Серия изображений полки и установки; точность товара и право показа проверяются до публикации.',
    theme: 'neutral', catalogue_order: 6, show: 0
  },
  {
    id: 'dashboard', slug: 'dashboard', title: 'Dashboard — проекты и задачи в одной карте',
    kind: 'it', category: 'Интерфейс', status: 'Публичная проекция проверяется',
    role: 'Постановка требований, решения по отображению и приёмка изменений.',
    summary: 'Публичный интерфейс с демонстрационными данными; частные проекты в портфолио не раскрываются.',
    theme: 'neutral', catalogue_order: 7, show: 0
  },
  {
    id: 'sparrow', slug: 'sparrow', title: 'Sparrow — содержимое сайта как инструмент агента',
    kind: 'it', category: 'WebMCP', status: 'Клиентский комплект подготовлен',
    role: 'Постановка задачи и решение о границах клиентской поставки.',
    summary: 'Инструменты поиска по публичным страницам подготовлены; публичная точка вызова не подтверждена.',
    theme: 'neutral', catalogue_order: 8, show: 0
  },
  {
    id: 'postgres-audit', slug: 'postgres-audit', title: 'Аудит PostgreSQL — от запросов к модернизации',
    kind: 'it', category: 'Аналитика БД', status: 'Материалы подготовлены',
    role: 'Точный личный вклад и право раскрытия требуют подтверждения.',
    summary: 'Подготовлены аналитические материалы и план изменений; внедрение и достигнутый эффект не подтверждены.',
    theme: 'neutral', catalogue_order: 9, show: 0
  }
];
