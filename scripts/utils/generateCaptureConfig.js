const fs = require('fs');
const path = require('path');

/* ---------- парсер аргументов CLI ---------- */
function parseArgs() {
  const args = process.argv.slice(2);
  const res = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    res[key] = args[i + 1];
  }
  return res;
}
const opts = parseArgs();

/* ---------- разбираем параметры ---------- */
const clients = opts.clients ? opts.clients.split(',') : [];
const tasks   = opts.tasks   ? opts.tasks.split(',')   : ['screenshot', 'trackSave'];

let range = null;
if (opts.from && opts.to) {
  range = { type: 'between', from: opts.from, to: opts.to };
} else if (opts.date) {
  range = { type: 'single', date: opts.date }; // одна дата
}

/* ---------- утилиты ---------- */
function toDate(str) {
  const [d, m, y] = str.split(/[\s/]+/)[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}
function sameDay(d1, d2) {
  return d1.toDateString() === d2.toDateString();
}

/* ---------- читаем ordersData.json ---------- */
const ORDERS_PATH = path.join(__dirname, '..', '..', 'data', 'OrdersData', 'ordersData.json');
const j = JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf8'));
const full = Array.isArray(j.orders) ? j.orders : [];

/* ---------- фильтруем по клиентам ---------- */
let pool = full;
if (clients.length) pool = pool.filter(o => clients.includes(o.client));

/* ---------- фильтруем по диапазону дат ---------- */
if (range?.type === 'between') {
  const from = toDate(range.from);
  const to   = toDate(range.to);
  pool = pool.filter(o => {
    const dt = toDate(o.date);
    return dt >= from && dt <= to;
  });
} else if (range?.type === 'single') {
  const day = toDate(range.date);
  pool = pool.filter(o => sameDay(toDate(o.date), day));
}

/* ---------- группируем по аккаунту ---------- */
const byAcc = {};
pool.forEach(o => {
  if (!o.orderAccount) return;
  (byAcc[o.orderAccount] ??= []).push(o);
});

/* ---------- формируем steps ---------- */
const steps = Object.entries(byAcc).map(([acc, orders]) => ({
  Account: acc,                                   // orderManager откроет этот e‑mail
  captureOrders: {
    clients: [...new Set(orders.map(o => o.client))],
    ...(range ? { range } : {}),
    tasks
  }
}));

/* ---------- сохраняем inputConfig.json ---------- */
const OUT = path.join(__dirname, '..', 'inputConfig.json');
fs.writeFileSync(OUT, JSON.stringify(steps, null, 2), 'utf8');
console.log('inputConfig.json обновлён:', steps.length, 'шаг(ов)');
