//"D:\Didar1520\CRM\scripts\actions\cartPage\finalReceipt.js"

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




  // ——— если из preOrderPage пришёл промис, ждём его и берём JSON ———
   // ——— если JSON заказа уже пришёл из checkCartSumm, используем его сразу ———
  if (meta.orderApiJson) {
    const d = meta.orderApiJson;

    const total = parseFloat(d.orderTotal.replace(/[^\d.-]/g, '')) || 0;
    let reward  = parseFloat((d.usedRewardsCredit || d.formattedPaidRewardTotal || '0').replace(/[^\d.-]/g, '')) || 0;
    reward = Math.abs(reward);

    const record = {
      orderNumber: d.orderNumber,
      date:            getFormattedDate(),
      orderAccount:    d.customerInfo?.emailAddress || '',
      deliveryAddress: d.shippingAddress?.fullName  || '',
      iherbStatus:     'выполняется обработка',
      rewardsUsed:     d.formattedPaidRewardTotal   || '',
      cardUsed:        d.cardDigit                 || '',
      price:           { usd: total + reward, rub: 0, commission: 0 },
      client:          meta.client   || '',
      orderID:         meta.orderID  || null,
      cartLink:        meta.cartLink || ''
    };

    appendRecord(record);
    console.log('[finalReceipt] -> Готово (данные взяли из orderApiJson).');
    return { success: true, type: 'completed', record };
  }





  /* 1) классический успешный заказ */
// ---------- 1) пытаемся поймать сетевой ответ с данными заказа ----------
let orderResp = await page.waitForResponse(
  r => r.url().includes('/api/checkout/order?OrderNumber=') && r.request().method() === 'GET' && r.ok(),
  { timeout: 12000 }          // было 15000 → даём вдвое больше времени
).catch(() => null);

// 1-б) если не поймали — пробуем достать orderNumber из URL и запросить вручную
if (!orderResp) {
  const urlNow  = page.url();
  const onParam = (() => { try { return (new URL(urlNow)).searchParams.get('on') || ''; } catch { return ''; } })();

  if (onParam) {
    const apiUrl = `/api/checkout/order?OrderNumber=${onParam}`;
    orderResp = await page.waitForResponse(
      r => r.url().includes(apiUrl) && r.ok(),
      { timeout: 12000 }
    ).catch(() => null);

    // если всё равно нет — ручной fetch
    if (!orderResp) {
      const fetched = await fetchJson(page, apiUrl);
      if (fetched) {
        orderResp = { ok: () => true, json: async () => fetched };
        console.log('[finalReceipt] -> Получили order API через fetchJson (резервный способ).');
      }
    }
  }
}


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

    const record = {
      orderNumber: d.orderNumber,
      date:            getFormattedDate(),
      orderAccount:    d.customerInfo?.emailAddress || '',
      deliveryAddress: d.shippingAddress?.fullName  || '',
      iherbStatus:     'выполняется обработка',   // можно оставить как было
      rewardsUsed:     d.formattedPaidRewardTotal || '',
      cardUsed:        d.cardDigit                || '',
      price:           { usd: total + reward, rub: 0, commission: 0 },
      client:          meta.client   || '',
      orderID:         meta.orderID  || null,
      cartLink:        meta.cartLink || ''
    };
    appendRecord(record);
    console.log('[finalReceipt] -> Готово (обычный заказ).');
    return { success: true, type: 'completed', record };
  }

  /* 2) заказ «booked» */
  const urlNow = page.url();
  if (urlNow.includes('/ui/transaction')) {
    try {
      const u          = new URL(urlNow);
      const tId        = u.searchParams.get('transactionId') || '';
      const retUrl     = u.searchParams.get('returnUrl')     || '';
      const on         = retUrl ? (new URL(retUrl)).searchParams.get('on') || '' : '';

      if (!tId || !on) return { success: false, error: 'bad params' };



      // 1) сначала ждём реальные сетевые ответы страницы
      const transResp = await page.waitForResponse(
        r => r.url().includes(`/Transactions/${tId}/TransactionData`) && r.ok(),
        { timeout: 10000 }
      ).catch(() => null);
      const orderResp = await page.waitForResponse(
        r => r.url().includes(`/api/v1/Order?on=${on}`) && r.ok(),
        { timeout: 10000 }
      ).catch(() => null);

      let transData = transResp ? await transResp.json() : null;
      let orderApi  = orderResp ? await orderResp.json()  : null;

      // 2) если не поймали — пробуем старый fetchJson
      if ((!transData || !orderApi) && retUrl) {
        await page.goto(retUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(()=>{});
        const extraResp = await page.waitForResponse(
          r => r.url().includes(`/api/v1/Order?on=${on}`) && r.ok(),
          { timeout: 10000 }
        ).catch(() => null);
        if (extraResp && !orderApi) orderApi = await extraResp.json().catch(()=>null);
      }

      // 3) если данных всё равно нет — пишем минимальную запись «booked»
      if (!transData || !orderApi) {
        const record = {
          orderNumber: on,
          date:        getFormattedDate(),
          orderAccount: meta.client || '',
          deliveryAddress: '',
          iherbStatus: 'booked',
          rewardsUsed: '',
          cardUsed:    '',
          price:       { usd: 0, rub: 0, commission: 0 },
          client:      meta.client   || '',
          orderID:     meta.orderID  || null,
          cartLink:    meta.cartLink || ''
        };
        appendRecord(record);
        console.log('[finalReceipt] -> Готово (booked — частичные данные).');
        return { success: true, type: 'booked', record };
      }

      // ----- обычная запись booked (полные данные) -----
      const record = {
        orderNumber: on,
        date:            getFormattedDate(),
        orderAccount:    transData.userEmail          || '',
        deliveryAddress: orderApi.shipAddr?.firstName || '',
        iherbStatus:     'booked',
        rewardsUsed:     '',
        cardUsed:        orderApi.paymMethod?.cardNb  || '',
        price:           { usd: transData.totalAmount || 0, rub: 0, commission: 0 },
        client:          meta.client   || '',
        orderID:         meta.orderID  || null,
        cartLink:        meta.cartLink || ''
      };

      appendRecord(record);

      console.log('[finalReceipt] -> Готово (booked).'); 
      return { success: true, type: 'booked', record };
      
    } catch (err) {
      console.log('[finalReceipt] -> Ошибка booked‑кейса:', err);
    }
  }

  /* 3) неуспех */
  const failMsg = `no order api on ${page.url()}`;
console.log('[finalReceipt] ->', failMsg);
return { success: false, error: failMsg };

}

module.exports = { finalReceipt };
