function nowISO() {
  return new Date().toISOString();
}

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function localDateFromISO(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentLocalDate() {
  return localDateFromISO(nowISO());
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat(
    getState().settings.interfaceLanguage === 'ru' ? 'ru-RU' : 'en-US',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }
  ).format(d);
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat(
    getState().settings.interfaceLanguage === 'ru' ? 'ru-RU' : 'en-US',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }
  ).format(d);
}

function parseWeekdays(text) {
  const map = {
    'пн': 'Mon',
    'понедельник': 'Mon',
    'mon': 'Mon',
    'monday': 'Mon',

    'вт': 'Tue',
    'вторник': 'Tue',
    'tue': 'Tue',
    'tuesday': 'Tue',

    'ср': 'Wed',
    'среда': 'Wed',
    'wed': 'Wed',
    'wednesday': 'Wed',

    'чт': 'Thu',
    'четверг': 'Thu',
    'thu': 'Thu',
    'thursday': 'Thu',

    'пт': 'Fri',
    'пятница': 'Fri',
    'fri': 'Fri',
    'friday': 'Fri',

    'сб': 'Sat',
    'суббота': 'Sat',
    'sat': 'Sat',
    'saturday': 'Sat',

    'вс': 'Sun',
    'воскресенье': 'Sun',
    'sun': 'Sun',
    'sunday': 'Sun'
  };

  return text
    .split(/[,\n;]+/)
    .map(x => x.trim().toLowerCase())
    .filter(Boolean)
    .map(x => map[x])
    .filter(Boolean);
}
function parseCSV(text) {
  return text
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}
function parseExplicitDates(text) {
  return text
    .split(/[,\n;]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(value => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }

      const match = value.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);

      if (!match) {
        throw new Error('dates_format');
      }

      const day = String(Number(match[1])).padStart(2, '0');
      const month = String(Number(match[2])).padStart(2, '0');
      const year = match[3];

      const normalized = `${year}-${month}-${day}`;
      const date = new Date(normalized + 'T00:00:00');

      if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== Number(year) ||
        date.getMonth() + 1 !== Number(month) ||
        date.getDate() !== Number(day)
      ) {
        throw new Error('dates_format');
      }

      return normalized;
    });
}

function parseTimes(text) {
  const values = parseCSV(text);

  if (!values.length) {
    throw new Error('time_format');
  }

  const result = values.map(value => {
    const original = value.trim();

    const normalized = original
      .replace(/[.\-]/g, ':')
      .replace(/\s+/g, ':');

    const match = normalized.match(/^(\d{1,2}):(\d{2})$/);

    if (!match) {
      throw new Error('time_format');
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) {
      throw new Error('time_format');
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  });

  const unique = [...new Set(result)];

  if (unique.length !== result.length) {
    throw new Error('duplicate_time');
  }

  return unique.sort();
}