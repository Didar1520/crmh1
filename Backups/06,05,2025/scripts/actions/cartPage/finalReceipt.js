const fs = require('fs');


/**
 * Закрывает модальное окно Google Customer Reviews, если оно есть
 */
async function closeSurveyModal(page) {
  try {
    await page.evaluate(() => {
      const modal = document.querySelector('div[role="dialog"]');
      if (modal) {
        modal.remove();
      }
    });
    console.log('[finalReceipt] -> Закрыли модальное окно опроса, если оно было');
  } catch (err) {
    console.log('[finalReceipt] -> Не удалось закрыть модальное окно опроса:', err);
  }
}




/* ---------- service ---------- */
async function fetchJson(page, url) {
  try {
    return await page.evaluate(async (u) => {
      const r = await fetch(u, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }, url);
  } catch (e) {
    console.log('[finalReceipt] -> fetchJson error:', e);
    return null;
  }
}

function getFormattedDate() {
  const now = new Date(Date.now() + 6 * 3600 * 1000);
  const D = String(now.getUTCDate()).padStart(2, '0');
  const M = String(now.getUTCMonth() + 1).padStart(2, '0');
  const Y = now.getUTCFullYear();
  const h = String(now.getUTCHours()).padStart(2, '0');
  const m = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${D}-${M}-${Y} / ${h}:${m}:${s}`;
}

function appendRecord(rec) {
  const file = 'D:\\Didar1520\\CRM\\data\\OrdersData\\ordersData.json';
  try {
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '{}';
    const obj = (() => { try { return JSON.parse(content); } catch { return { orders: [] }; } })();
    if (!Array.isArray(obj.orders)) obj.orders = [];
    obj.orders.push(rec);
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
    console.log('[finalReceipt] -> Записали запись:', rec);
  } catch (err) {
    console.log('[finalReceipt] -> Ошибка записи файла:', err);
  }
}
/* -------------------------------- */

async function finalReceipt(page, meta = {}) {
  console.log('[finalReceipt] -> Начинаем обработку финальной страницы…');

  /* 1) классический успешный заказ */
  const orderResp = await page.waitForResponse(
    (r) => r.url().includes('/api/checkout/order?OrderNumber=') && r.request().method() === 'GET',
    { timeout: 15000 }
  ).catch(() => null);

  if (orderResp && orderResp.ok()) {
    await page.evaluate(() => window.stop());
    await closeSurveyModal(page);
    await page.evaluate(() => {
      document.querySelectorAll('div[class*="spinner"], div[class*="overlay"], .loading-blur')
        .forEach(el => el.remove());
    });

    const d = await orderResp.json();
    const total = parseFloat(d.orderTotal.replace(/[^\d.-]/g, '')) || 0;
    let reward = parseFloat((d.usedRewardsCredit || d.formattedPaidRewardTotal || '0').replace(/[^\d.-]/g, '')) || 0;
    reward = Math.abs(reward);

    appendRecord({
      orderNumber: d.orderNumber,
      date:            getFormattedDate(),
      orderAccount:    d.customerInfo?.emailAddress || '',
      deliveryAddress: d.shippingAddress?.fullName  || '',
      iherbStatus:     'выполняется обработка',
      rewardsUsed:     d.formattedPaidRewardTotal   || '',
      cardUsed:        d.cardDigit                  || '',
      price:           { usd: total + reward, rub: 0, commission: 0 },
      client:          meta.client   || '',
      orderID:         meta.orderID  || null,
      cartLink:        meta.cartLink || ''
    });
    console.log('[finalReceipt] -> Готово (обычный заказ).');
    return true;
  }

  /* 2) заказ «booked» */
  const urlNow = page.url();
  if (urlNow.includes('/ui/transaction')) {
    try {
      const u          = new URL(urlNow);
      const tId        = u.searchParams.get('transactionId') || '';
      const retUrl     = u.searchParams.get('returnUrl')     || '';
      const on         = retUrl ? (new URL(retUrl)).searchParams.get('on') || '' : '';

      if (!tId || !on) return false;

      const [transData, orderApi] = await Promise.all([
        fetchJson(page, `https://p-proc-srv.iherb.com/api/Transactions/${tId}/TransactionData`),
        fetchJson(page, `https://orders-order-api.iherb.biz/api/v1/Order?on=${on}`)
      ]);
      if (!transData || !orderApi) return false;

      appendRecord({
        orderNumber: on,
        date:            getFormattedDate(),
        orderAccount:    transData.userEmail              || '',
        deliveryAddress: orderApi.shipAddr?.firstName     || '',
        iherbStatus:     'booked',
        rewardsUsed:     '',
        cardUsed:        orderApi.paymMethod?.cardNb      || '',
        price:           { usd: transData.totalAmount || 0, rub: 0, commission: 0 },
        client:          meta.client   || '',
        orderID:         meta.orderID  || null,
        cartLink:        meta.cartLink || ''
      });
      console.log('[finalReceipt] -> Готово (booked).');
      return true;
    } catch (err) {
      console.log('[finalReceipt] -> Ошибка booked‑кейса:', err);
    }
  }

  /* 3) неуспех */
  console.log('[finalReceipt] -> Не удалось определить успешный исход.');
  return false;
}

module.exports = { finalReceipt };
