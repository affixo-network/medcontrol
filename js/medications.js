function medicationUiText(key) {
  const lang = getState()?.settings?.interfaceLanguage || 'en';
  const dictionaries = {
    ru: {
      manufacturer: 'Производитель',
      manufacturer_data: 'Данные производителя',
      content_value: 'Количественное содержание',
      content_unit: 'Единица содержания',
      dose: 'Доза',
      intake_unit: 'Единица приёма',
      intake_quantity: 'Количество приёма',
      other: 'Другое',
      specify_other: 'Укажите другое значение',
      hint_content_value