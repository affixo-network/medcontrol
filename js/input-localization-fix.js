(function () {
  const RU_TO_EN = new Map([
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
    ['Статус', 'Status'],
    ['История', 'History'],
    ['Управление данными', 'Data management'],
    ['Полный сброс доступен только после отмены всех препаратов.', 'Full reset is available only after all medications have been cancelled.'],
    ['Сброс', 'Reset'],
    ['Отменить', 'Cancel'],
    ['Отменено', 'Cancelled'],
    ['Архив пуст.', 'Archive is empty.'],
    ['Ежедневно', 'Every day'],
    ['Выберите', 'Select'],
    ['Другое', 'Other'],
    ['таблетка', 'tablet'], ['капсула', 'capsule'], ['капля', 'drop'],
    ['чайная ложка', 'teaspoon'], ['столовая ложка', 'tablespoon'], ['доза', 'dose'],
    ['впрыск', 'puff'], ['ампула', 'ampoule'], ['флакон', 'vial'], ['пакет', 'packet'],
    ['саше', 'sachet'], ['суппозиторий', 'suppository'], ['пластырь', 'patch'],
    ['инъекция', 'injection'], ['единица', 'unit'], ['мкг', 'mcg'], ['мг', 'mg'],
    ['г', 'g'], ['кг', 'kg'], ['мл', 'ml'], ['л', 'l'], ['МЕ', 'IU'], ['ед.', 'unit']
  ]);

  const PLACEHOLDERS = new Map([
    ['Название производителя', 'Manufacturer name'],
    ['Например: 500', 'Example: 500'],
    ['Например: 1', 'Example: 1']
  ]);

  function selectedLanguage() {
    try { return getState().settings.interfaceLanguage || 'en'; } catch (_) { return 'en'; }
  }

  function translateInputDom() {
    if (selectedLanguage() !== 'en') return;

    document.querySelectorAll('label,h2,h3,th,p,button,option,span').forEach(el => {
      if (el.children.length && !['OPTION','BUTTON'].includes(el.tagName)) return;
      const raw = (el.textContent || '').trim();
      if (RU_TO_EN.has(raw)) el.textContent = RU_TO_EN.get(raw);
    });

    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el => {
      const p = el.getAttribute('placeholder');
      if (PLACEHOLDERS.has(p)) el.setAttribute('placeholder', PLACEHOLDERS.get(p));
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
