(function () {
  const RU_TO_EN = new Map([
    ['Медконтроль — Ввод', 'MedControl — Input'],
    ['Производитель', 'Manufacturer'],
    ['Название производителя', 'Manufacturer name'],
    ['Данные производителя', 'Manufacturer data'],
    ['Количественное содержание *', 'Content amount *'],
    ['Единица содержания *', 'Content unit *'],
    ['Другая единица содержания *', 'Other content unit *'],
    ['Доза', 'Dose'],
    ['Количество приёма *', 'Intake quantity *'],
    ['Единица приёма *', 'Intake unit *'],
    ['Другая единица приёма *', 'Other intake unit *'],
    ['Параметры расписания', 'Schedule parameters'],
    ['Архив отменённых препаратов', 'Cancelled medications archive'],
    ['Статус', 'Status'], ['История', 'History'], ['Управление данными', 'Data management'],
    ['Полный сброс доступен только после отмены всех препаратов.', 'Full reset is available only after all medications have been cancelled.'],
    ['Сброс', 'Reset'], ['Отменить', 'Cancel'], ['Отменено', 'Cancelled'], ['Архив пуст.', 'Archive is empty.'],
    ['Ежедневно', 'Every day'], ['Выберите', 'Select'], ['Другое', 'Other'],
    ['таблетка', 'tablet'], ['капсула', 'capsule'], ['капля', 'drop'], ['чайная ложка', 'teaspoon'],
    ['столовая ложка', 'tablespoon'], ['доза', 'dose'], ['впрыск', 'puff'], ['ампула', 'ampoule'],
    ['флакон', 'vial'], ['пакет', 'packet'], ['саше', 'sachet'], ['суппозиторий', 'suppository'],
    ['пластырь', 'patch'], ['инъекция', 'injection'], ['единица', 'unit'], ['мкг', 'mcg'], ['мг', 'mg'],
    ['г', 'g'], ['кг', 'kg'], ['мл', 'ml'], ['л', 'l'], ['МЕ', 'IU'], ['ед.', 'unit']
  ]);

  const EN_TO_RU = new Map(Array.from(RU_TO_EN.entries()).map(([ru,en]) => [en,ru]));
  const PLACEHOLDERS_EN = new Map([
    ['Название производителя', 'Manufacturer name'], ['Например: 500', 'Example: 500'], ['Например: 1', 'Example: 1']
  ]);
  const PLACEHOLDERS_RU = new Map(Array.from(PLACEHOLDERS_EN.entries()).map(([ru,en]) => [en,ru]));

  function selectedLanguage() {
    try { return getState().settings.interfaceLanguage || 'en'; } catch (_) { return 'en'; }
  }

  function translateInputDom() {
    const lang = selectedLanguage();
    const map = lang === 'en' ? RU_TO_EN : EN_TO_RU;
    const placeholders = lang === 'en' ? PLACEHOLDERS_EN : PLACEHOLDERS_RU;

    document.querySelectorAll('h1,label,h2,h3,th,p,button,option,span').forEach(el => {
      if (el.children.length && !['OPTION','BUTTON'].includes(el.tagName)) return;
      const raw = (el.textContent || '').trim();
      if (lang === 'ru' && raw === 'MedControl — Ввод') {
        el.textContent = 'Медконтроль — Ввод';
        return;
      }
      if (map.has(raw)) el.textContent = map.get(raw);
    });

    if (lang === 'ru' && document.title === 'MedControl — Ввод') document.title = 'Медконтроль — Ввод';
    if (lang === 'en' && document.title === 'Медконтроль — Ввод') document.title = 'MedControl — Input';

    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el => {
      const p = el.getAttribute('placeholder');
      if (placeholders.has(p)) el.setAttribute('placeholder', placeholders.get(p));
    });
  }

  const original = window.renderInputPage;
  if (typeof original === 'function') {
    window.renderInputPage = function () {
      const result = original.apply(this, arguments);
      translateInputDom();
      return result;
    };
  }

  window.translateInputDom = translateInputDom;
})();
