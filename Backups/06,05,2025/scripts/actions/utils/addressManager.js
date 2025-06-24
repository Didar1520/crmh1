/**
 * addressManager.js — пошагово
 *
 * 1. Загружает:
 *    • список всех заказов (ordersData.json);
 *    • список всех возможных адресов (adressList.JSON);
 *    • пороговые значения из config.js: 
 *      - changeAddressFrequency (сколько раз можно подряд использовать один адрес);
 *      - changeAddressFrequencyByDay (за какой период учитывать эти использования).
 *
 * 2. Нормализует ФИО текущего адреса до формы «Фамилия Имя».
 *
 * 3. Проходит все заказы:
 *    • корректно парсит дату (формат «DD-MM-YYYY / HH:MM:SS» или ISO);
 *    • если дата укладывается в оговорённый период, увеличивает счётчик
 *      использований соответствующего ФИО в карте usageMap.
 *
 * 4. Проверяет, не превысил ли текущий адрес лимит
 *    (usageMap[key].count ≥ changeAddressFrequency).
 *    • Если не превысил — возвращает { changed:false }.
 *
 * 5. Если лимит превышен:
 *    • формирует список «кандидатов» — сначала адреса, не использовавшиеся
 *      в периоде вовсе, затем те, у кого счётчик меньше порога;
 *    • если кандидатов нет, берёт адрес с минимальным счётчиком и самой
 *      старой датой последнего использования.
 *
 * 6. Случайным образом выбирает одного кандидата и
 *    возвращает { changed:true, newIndex } для обновления defaultAdress.
 *
 *
 * Тестирование:
 *   node scripts/actions/utils/addressManager.js
 */

const fs = require('fs');
const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'config.js'));

const ordersDataPath = path.join(__dirname, '..', '..', '..', 'data', 'OrdersData', 'ordersData.json');
const adressListPath = path.join(__dirname, '..', '..', '..', 'data', 'adressBook', 'adressList.JSON');

function getOrdersData() {
  try {
    const raw = fs.readFileSync(ordersDataPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.orders) ? parsed.orders : [];
  } catch (e) {
    console.error('[addressManager] Ошибка чтения ordersData.json:', e);
    return [];
  }
}

function getAdressList() {
  try {
    return JSON.parse(fs.readFileSync(adressListPath, 'utf8'));
  } catch (e) {
    console.error('[addressManager] Ошибка чтения adressList.JSON:', e);
    return [];
  }
}

async function addressManager(currentFullName) {
  const orders = getOrdersData();
  const adressList = getAdressList();

  // 2) пороги из config.js
  const changeFreq = config.changeAddressFrequency;
  const changeDays = config.changeAddressFrequencyByDay;

  // 3) нормализуем текущее имя ("Фамилия Имя")
  const key = currentFullName.trim().split(/\s+/).slice(0, 2).join(' ');

  // 4) считаем использование каждого адреса
  const usageMap = {}; // { "Фамилия Имя": { count, lastDateMs, index } }

  const thresholdTime = Date.now() - changeDays * 24 * 60 * 60 * 1000;

  orders.forEach((o, idx) => {
    let dt;
    const dateStr = o.date || o.orderDate || '';
  
    if (typeof dateStr === 'string' && /^\d{2}-\d{2}-\d{4}/.test(dateStr)) {
      // формат "DD-MM-YYYY / HH:MM:SS" или "DD-MM-YYYY"
      const [datePartRaw, timePartRaw] = dateStr.split('/').map(s => s.trim());
      const [day, month, year] = datePartRaw.split('-').map(Number);
  
      const safeTime = timePartRaw || '00:00:00';
      const [hour = 0, minute = 0, second = 0] = safeTime.split(':').map(Number);
  
      dt = new Date(year, month - 1, day, hour, minute, second);
  
      if (!dt || isNaN(dt)) {
        console.log(`[addressManager] -> Пропускаем заказ ${o.orderNumber}: некорректная дата "${dateStr}"`);
        return;
      }
  
      console.log(`[addressManager] -> Дата заказа ${o.orderNumber}: ${dt.toISOString()}`);
    } else if (dateStr) {
      // ISO-строка или другой допустимый формат
      dt = new Date(dateStr);
  
      if (!dt || isNaN(dt)) {
        console.log(`[addressManager] -> Пропускаем заказ ${o.orderNumber}: некорректная дата "${dateStr}"`);
        return;
      }
  
      console.log(`[addressManager] -> Дата заказа ${o.orderNumber}: ${dt.toISOString()}`);
    } else {
      console.log(`[addressManager] -> Пропускаем заказ ${o.orderNumber}: нет поля date/orderDate`);
      return;
    }
  
    // обновляем usageMap
    const fullName = (o.deliveryAddress || '').trim().split(/\s+/).slice(0, 2).join(' ');
    if (!fullName) return;
  
    const entry = usageMap[fullName] || { count: 0, lastDateMs: 0, index: null };
    if (dt.getTime() >= thresholdTime) entry.count += 1;
    if (dt.getTime() > entry.lastDateMs) entry.lastDateMs = dt.getTime();
    usageMap[fullName] = entry;
  });
  

  // 5) проверяем лимит для текущего адреса
  const currentUsage = usageMap[key]?.count || 0;
  console.log(`[addressManager] -> Текущее использование "${key}": ${currentUsage}, порог = ${changeFreq}`);

  if (currentUsage < changeFreq) {
    return { changed: false };
  }

  // 6) формируем кандидатов: сначала те, у кого count === 0
  let candidates = adressList
    .map((a, i) => ({ raw: a.FullName.trim().split(/\s+/).slice(0, 2).join(' '), index: i }))
    .filter(x => (usageMap[x.raw]?.count || 0) === 0);

  // 7) если нет «нулевых», берём тех, у кого count < changeFreq
  if (candidates.length === 0) {
    candidates = adressList
      .map((a, i) => ({ raw: a.FullName.trim().split(/\s+/).slice(0, 2).join(' '), index: i }))
      .filter(x => (usageMap[x.raw]?.count || 0) < changeFreq);
  }

  // 8) если и их нет — форс-мажор: самый маленький count, самый старый lastDate
  if (candidates.length === 0) {
    const arr = Object.values(usageMap)
      .map(v => ({ count: v.count, last: v.lastDateMs, idx: v.index }))
      .filter(v => v.idx != null);
    arr.sort((a, b) => a.count - b.count || a.last - b.last);
    if (arr.length) candidates = [{ index: arr[0].idx }];
  }

  // 9) выбираем случайный (или единственный) вариант
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  console.log(`[addressManager] -> Выбран новый индекс ${pick.index}: "${adressList[pick.index].FullName}"`);
  return { changed: true, newIndex: pick.index };
}

module.exports = { addressManager };
