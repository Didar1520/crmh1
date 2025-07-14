const fs = require('fs');
const path = require('path');
const { launchBrowserForAccount } = require('../browserManager');
const { authorize } = require('../auth');
const { saveProgress, loadProgress } = require('../utils/shotProgress');

function parseDate(str) {
  if (!str) return null;
  const parts = str.split(/[\s/]+/)[0].split('-');
  if (parts.length < 3) return null;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d);
}

function pickOrders(list, cfg) {
  let res = Array.from(list);
  if (cfg.clients && cfg.clients.length) {
    res = res.filter(o => cfg.clients.includes(o.client));
  }
  if (cfg.range && cfg.range.type === 'between') {
    const from = parseDate(cfg.range.from);
    const to = parseDate(cfg.range.to);
    res = res.filter(o => {
      const d = parseDate(o.date);
      return d && d >= from && d <= to;
    });
  }
  return res;
}

function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const k = fn(item);
    acc[k] ??= [];
    acc[k].push(item);
    return acc;
  }, {});
}

async function isUserAuthorized(page, email) {
  try {
    await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2', timeout: 60000 });
    const userData = await page.evaluate(async () => {
      try {
        const r = await fetch('https://catalog.app.iherb.com/catalog/currentUser', { method: 'GET', credentials: 'include' });
        return r.ok ? r.json() : null;
      } catch { return null; }
    });
    return userData && userData.email && userData.email.trim().toLowerCase() === email.trim().toLowerCase();
  } catch {
    return false;
  }
}

async function ensureLogin(page, email) {
  if (await isUserAuthorized(page, email)) return true;
  return authorize(page, { login: email, password: '' }, null);
}

async function processOneOrder(page, ord, tasks) {
  await page.goto(`https://secure.iherb.com/myaccount/orderdetails?on=${ord.orderNumber}`, { waitUntil: 'networkidle2' });
  if (tasks.includes('screenshot')) {
    const dir = path.join('D:\\Didar1520\\CRM\\logs\\screens', ord.orderAccount);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, `${ord.orderNumber}.png`);
    await page.screenshot({ path: p, fullPage: true });
  }
  let track = null;
  if (tasks.includes('trackSave')) {
    track = await page.evaluate(() => {
      const a = document.querySelector('a[href*="carrierTracking"]');
      if (!a) return null;
      const m = a.href.match(/trackingNumber=([^&]+)/);
      return m ? m[1] : null;
    });
    if (track) {
      const file = 'D:\\Didar1520\\CRM\\data\\OrdersData\\ordersData.json';
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const row = j.orders.find(o => o.orderNumber === ord.orderNumber);
      if (row) row.tracking = track;
      fs.writeFileSync(file, JSON.stringify(j, null, 2), 'utf8');
    }
  }
}

async function captureOrders(page, cfg) {
  const raw = JSON.parse(fs.readFileSync('D:\\Didar1520\\CRM\\data\\OrdersData\\ordersData.json', 'utf8')).orders || [];
  const targets = pickOrders(raw, cfg);
  const doneSet = loadProgress();
  // аккаунт берем из ordersData.json, поэтому в конфиге он не нужен
  const grouped = groupBy(targets, o => o.orderAccount);
  const result = { done: [], skipped: [], errors: [] };

  for (const [account, orders] of Object.entries(grouped)) {
    const { browser, page: pg } = await launchBrowserForAccount({ accountEmail: account });
    const logged = await ensureLogin(pg, account);
    if (!logged) {
      result.errors.push(...orders.map(o => ({ order: o.orderNumber, reason: 'login fail' })));
      await browser.close();
      continue;
    }

    await pg.goto('https://secure.iherb.com/myaccount/orders', { waitUntil: 'networkidle2' });

    for (const ord of orders) {
      if (doneSet.has(ord.orderNumber)) {
        result.skipped.push(ord.orderNumber);
        continue;
      }
      try {
        await processOneOrder(pg, ord, cfg.tasks || []);
        saveProgress(ord.orderNumber);
        result.done.push(ord.orderNumber);
      } catch (e) {
        result.errors.push({ order: ord.orderNumber, reason: e.message });
      }
    }
    await browser.close();
  }

  return result;
}

module.exports = { captureOrders };
