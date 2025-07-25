const fs = require('fs');
const path = require('path');
const { loadProgress, saveProgress } = require('../utils/shotProgress');
const { getOrdersData, saveOrdersData } = require('../dataManager');

const CRM_ROOT = process.env.CRM_ROOT || path.join(__dirname, '..', '..');
const ORDERS_JSON = path.join(CRM_ROOT, 'data', 'OrdersData', 'ordersData.json');
const CART_DATA_DIR = path.join(CRM_ROOT, 'data', 'cartData');

/* ───────────────────────── helpers ───────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split(/[\s/]+/)[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}
function pickOrders(list, cfg) {
  let res = [...list];
  if (cfg.clients?.length) res = res.filter((o) => cfg.clients.includes(o.client));
  if (cfg.range?.type === 'between') {
    const from = parseDate(cfg.range.from);
    const to = parseDate(cfg.range.to);
    res = res.filter((o) => {
      const d = parseDate(o.date);
      return d && d >= from && d <= to;
    });
  }
  return res;
}
function groupBy(arr, fn) {
  return arr.reduce((acc, it) => {
    const k = fn(it);
    (acc[k] ??= []).push(it);
    return acc;
  }, {});
}
async function isLogged(page, email) {
  try {
    await page.goto('https://kz.iherb.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const me = await page.evaluate(async () => {
      try {
        const r = await fetch('https://catalog.app.iherb.com/catalog/currentUser', {
          credentials: 'include',
        });
        return r.ok ? r.json() : null;
      } catch {
        return null;
      }
    });
    return me?.email?.trim().toLowerCase() === email.trim().toLowerCase();
  } catch {
    return false;
  }
}
async function login(page, email) {
  if (await isLogged(page, email)) return true;
  return authorize(page, { login: email, password: '' }, null);
}
async function waitOrderLoad(page) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.waitForSelector('section.order-header-section', { timeout: 10_000 });
      return true;
    } catch {
      await page.reload({ waitUntil: 'networkidle2' });
    }
  }
  return false;
}
async function cleanPriceBlock(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.order-detail').forEach((el) => {
      if (el.textContent.includes('Всего:')) el.remove();
    });
  });
}
async function extractData(page) {
  return page.evaluate(() => {
    const status =
      document.querySelector('.order-status-label span')?.textContent.trim() || null;

    let trackCode = null;
    const link = document.querySelector('a[href*="carrierTracking"]');
    if (link) {
      const u = new URL(link.href);
      trackCode = u.searchParams.get('trackingNumber') || null;
    }

    const items = [];
    document.querySelectorAll('.product').forEach((p) => {
      const name = p.querySelector('.display-name')?.textContent.trim();
      const qty = Number(p.querySelector('.price-number')?.textContent.trim() || 0);
      if (name) items.push({ name, qty });
    });

    return { status, trackCode, items };
  });
}
function buildSessionDir(clientName, clientId, dFrom, dTo) {
  const fmt = (d) => d.toISOString().slice(2, 10).replace(/-/g, '-');
  return path.join(CART_DATA_DIR, `${fmt(dFrom)}  ${fmt(dTo)} ${clientName} ID${clientId}`);
}
async function saveSummary(client, cid, dFrom, dTo, orders) {
  const dir = buildSessionDir(client, cid, dFrom, dTo);
  fs.mkdirSync(dir, { recursive: true });
  const screensDir = path.join(dir, 'screens');
  fs.mkdirSync(screensDir, { recursive: true });

  // итоги
  let totalQty = 0;
  const prod = {};
  orders.forEach(({ items }) =>
    items.forEach(({ name, qty }) => {
      totalQty += qty;
      prod[name] = (prod[name] || 0) + qty;
    }),
  );

  const txt = [
    `Клиент: ${client} (ID${cid})`,
    `Период: ${dFrom.toLocaleDateString()} - ${dTo.toLocaleDateString()}`,
    `Корзин: ${orders.length}`,
    `Общее кол-во позиций: ${totalQty}`,
    `Уникальных позиций: ${Object.keys(prod).length}`,
    '',
    'Итоги по товарам:',
    ...Object.entries(prod).map(([n, q]) => `${n} – общее кол-во: ${q}`),
  ].join('\n');

  fs.writeFileSync(path.join(dir, 'summary.txt'), txt, 'utf8');
  return screensDir;
}
async function processOrder(page, ord, tasks, screensDir) {
  await page.goto(
    `https://secure.iherb.com/myaccount/orders?kw=${ord.orderNumber}&date=6`,
    { waitUntil: 'networkidle2' },
  );
  if (!(await waitOrderLoad(page))) throw new Error('order not loading');

  await cleanPriceBlock(page);
  const data = await extractData(page);

  if (tasks.includes('screenshot')) {
    const shot = path.join(screensDir, `${ord.orderNumber}.png`);
    const section = await page.$('section.order-section');
    if (section) {
      await section.screenshot({ path: shot });
    } else {
      await page.screenshot({ path: shot, fullPage: true });
    }
  }

  // обновляем ordersData.json
  const json = await getOrdersData();
  // --- fallback для папки скринов, если не передали из syncRunner ---
if (!cfg.screensDir) {
  const base = path.join(
    __dirname,
    '..',
    '..',
    'data',
    'cartData',
    'screens-fallback'
  );
  fs.mkdirSync(base, { recursive: true });
  cfg.screensDir = base;
}

  const row = json.orders.find((r) => r.orderNumber === ord.orderNumber);
  if (row) {
    row.trackCode = data.trackCode ?? null;
    row.iherbStatus = data.status ?? null;
    row.items = data.items;
    await saveOrdersData(json);
  }
  return data.items;
}
/* ───────────────────────── main ───────────────────────── */
async function captureOrders(page, cfg) {
  const json = await getOrdersData();
  const targets = pickOrders(json.orders || [], cfg);
  const done = loadProgress();
  const out = { done: [], skipped: [], errors: [] };

  if (!targets.length) return out;

  for (const ord of targets) {
    if (done.has(ord.orderNumber)) {
        console.log(`[captureOrders] -> skipped ${ord.orderNumber} (уже был в progress)`);

      out.skipped.push(ord.orderNumber);
      continue;
    }
    try {

const url = `https://secure.iherb.com/myaccount/orders?kw=${ord.orderNumber}&date=6`;

let loaded = false;
for (let attempt = 1; attempt <= 3 && !loaded; attempt++) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // ждём до 30 секунд появления ИЛИ .order-ctr, ИЛИ .order-details-header
    await page.waitForFunction(
      () =>
        !!document.querySelector('section.order-header-section') ||
        !!document.querySelector('div.order-details-header') ||
        !!document.querySelector('div.order-ctr'),
      { timeout: 30_000 },
    );

    loaded = true;
  } catch (e) {
    if (attempt === 3) throw new Error('order page not loaded (3 attempts)');
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
}

      if (!(await waitOrderLoad(page)))
        throw new Error('order not loading');

      await cleanPriceBlock(page);
      const { status, trackCode, items } = await extractData(page);

      if (cfg.tasks?.includes('screenshot')) {
        const dir = cfg.screensDir;
        const shot = path.join(dir, `${ord.orderNumber}.png`);
        const section = await page.$('section.order-section');
        if (section) {
          await section.screenshot({ path: shot });
        } else {
          await page.screenshot({ path: shot, fullPage: true });
        }
      }

      // обновляем ordersData.json
      const row = json.orders.find((r) => r.orderNumber === ord.orderNumber);
      if (row) {
        row.trackCode = trackCode ?? null;
        row.iherbStatus = status ?? null;
        row.items = items;
      }
      done.add(ord.orderNumber);
      out.done.push(ord.orderNumber);
      console.log(`[captureOrders] -> done ${ord.orderNumber}`);

    } catch (e) {
      out.errors.push({ order: ord.orderNumber, reason: e.message });
      console.log(`[captureOrders] -> error ${ord.orderNumber}: ${e.message}`);

    }
  }
  await saveOrdersData(json);
  saveProgress(...out.done);
  return out;
}

module.exports = { captureOrders };


module.exports = { captureOrders };
