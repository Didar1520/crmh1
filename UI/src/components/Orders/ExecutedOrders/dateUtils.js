/* File: dateUtils.js */
export const RU_MONTHS = [
    'Января', 'Февраля', 'Марта', 'Апреля',
    'Мая', 'Июня', 'Июля', 'Августа',
    'Сентября', 'Октября', 'Ноября', 'Декабря'
  ];
  
  export const RU_DAYS = [
    'Воскресенье', 'Понедельник', 'Вторник',
    'Среда', 'Четверг', 'Пятница', 'Суббота'
  ];
  
  // Функция для парсинга даты из строки вида "DD-MM-YYYY HH:MM"
  export function parseOrderDate(dateStr = '') {
    // Приходит "07-05-2025 / 16:32:24" или "06-05-2025 19:54"
    const clean = dateStr.replace('/', '').trim();               // убираем слэш, лишние пробелы
    const [datePart = '', timePart = '00:00:00'] = clean.split(' ');
    const [d, m, y] = datePart.split('-').map(Number);
    const [h = 0, min = 0, s = 0] = timePart.split(':').map(Number);
    return new Date(y, m - 1, d, h, min, s);
  }
  
  function formatDateDay(dateObj) {
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = RU_MONTHS[dateObj.getMonth()];
    const weekday = RU_DAYS[dateObj.getDay()];
    return `${day} ${month}, ${weekday}`;
  }
  
  function formatDateWeek(dateObj) {
    // ISO‑неделя Пн–Вс
    const tmp = new Date(dateObj);
    // Смещаем к понедельнику
    const monOffset = (tmp.getDay() + 6) % 7; // Вс=0 → 6, Пн=1 → 0 …
    tmp.setDate(tmp.getDate() - monOffset);
    const weekStart = tmp.getDate().toString().padStart(2, '0');
    tmp.setDate(tmp.getDate() + 6);           // до воскресенья
    const weekEnd = tmp.getDate().toString().padStart(2, '0');
    const month = RU_MONTHS[tmp.getMonth()].toLowerCase();
    const year = tmp.getFullYear();
    return `Неделя ${weekStart}‑${weekEnd} ${month} ${year}`;
  }
  
  
  function formatDateMonth(dateObj) {
    const month = RU_MONTHS[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${month} ${year}`;
  }
  
  export function groupOrdersByMode(orders, mode) {
    const groups = {};
    orders.forEach(order => {
      const dateObj = parseOrderDate(order.date);
      let key = '';
      if (mode === 'day') {
        key = formatDateDay(dateObj);
      } else if (mode === 'week') {
        key = formatDateWeek(dateObj);
      } else if (mode === 'month') {
        key = formatDateMonth(dateObj);
      }
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
    });
    return groups;
  }
  