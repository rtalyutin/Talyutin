// Owner-approved public selection for an unavailable portfolio source.
// This is separate from editorial seed data and never replaces a successful response.
export const offlineWorks = [
  {
    id: 'ycs', slug: 'ycs', title: 'ЯКС — ЯрКиберСезон', displayTitle: 'ЯКС', kind: 'it',
    category: 'Турнирная система', status: 'Сайт и Mini App',
    role: 'Основатель и продуктовый владелец; организация турниров и координация разработки',
    summary: 'Киберспортивные турниры: сайт и Mini App объединяют команды, матчи, результаты и архив сезонов.',
    theme: 'arena', orientation: 'landscape', liveUrl: 'https://yarcyberseason.ru/',
    embedAllowed: true, poster: null, featuredOrder: 1, tools: [],
    links: [
      { label: 'Открыть сайт ЯКС', href: 'https://yarcyberseason.ru/' },
      { label: 'Открыть Mini App', href: 'https://yarcyberseason.ru/tg' }
    ],
    reveal: [
      { heading: 'Задача', body: 'Связать проведение турниров по Dota 2 и CS2 с удобным доступом к матчам, командам и результатам.' },
      { heading: 'Решение', body: 'Сайт турниров и компактный мобильный вход через Mini App.' }
    ]
  },
  {
    id: 'booking', slug: 'booking', title: 'Онлайн-запись', displayTitle: 'Онлайн-запись', kind: 'it',
    category: 'Сервис для салонов', status: 'Онлайн-запись и управление расписанием',
    role: 'Постановка сценариев, бизнес-правил и критериев приёмки',
    summary: 'Сервис записи для салонов: услуги, мастера, кабинеты и расписание в одном месте.',
    theme: 'neutral', orientation: 'landscape', liveUrl: 'https://talyutin.online/',
    embedAllowed: false, poster: null, featuredOrder: 2, tools: [],
    links: [{ label: 'Открыть онлайн-запись', href: 'https://talyutin.online/' }],
    reveal: [
      { heading: 'Задача', body: 'Упростить запись клиентов и управление загрузкой мастеров и кабинетов.' },
      { heading: 'Решение', body: 'Конструктор салона и недельный календарь записей, включая упрощённый сценарий для одного мастера.' }
    ]
  },
  {
    id: 'tochki', slug: 'tochki', title: 'Точки', displayTitle: 'Точки', kind: 'authorial',
    category: 'Браузерная игра', status: 'Человек против компьютера',
    role: 'Выбор формата, уточнение правил и направление «Тетрадный бунт»',
    summary: 'Игра на тетрадном поле: окружайте точки соперника и захватывайте территорию в партии против компьютера.',
    theme: 'folio', orientation: 'landscape', liveUrl: null,
    embedAllowed: true, poster: null, featuredOrder: 3, tools: [], links: [],
    reveal: [
      { heading: 'Задача', body: 'Перенести игру на бумаге в браузер и дать возможность сыграть против компьютера.' },
      { heading: 'Решение', body: 'Тетрадное поле, расчёт захвата и компьютерный соперник. Игра открывается прямо на этом сайте.' }
    ]
  }
];
