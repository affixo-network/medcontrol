console.log("core.js подключён");

const DEFAULT_GRACE_MINUTES = 30;


const COUNTRY_OPTIONS = [
  'Armenia','Argentina','Australia','Austria','Belgium','Brazil','Canada','China','Egypt','France','Germany','India','Italy','Japan','Mexico','Netherlands','Russia','Spain','Sweden','Switzerland','United Arab Emirates','United Kingdom','United States'
];

const WEEKDAYS = [
  ['Mon','Пн'],['Tue','Вт'],['Wed','Ср'],['Thu','Чт'],['Fri','Пт'],['Sat','Сб'],['Sun','Вс']
];

const SCHEDULE_TYPES = {
  daily: 'Каждый день',
  weekdays: 'Дни недели',
  explicit_dates: 'Даты'
};







function makeDefaultState() {
  const detected = detectLanguage();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return {
    settings: {
      detectedLanguage: detected,
      interfaceLanguage: TRANSLATIONS[detected] ? detected : 'en',
      country: inferCountryFromLocale(),
      timezone,
      locale: navigator.language || 'en-US',
      infoDismissed: false
    },
    medications: [],
    intakeLogs: []
  };
}










































