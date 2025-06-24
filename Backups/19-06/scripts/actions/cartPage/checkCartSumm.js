//"D:\Didar1520\CRM\scripts\actions\cartPage\checkCartSumm.js"

const { safeWaitForLoad } = require('../utils/pageLoadHelper.js');
const { safeClickWithRetry } = require('../utils/safeClick.js');
/**
 * checkCartSumm(page, cartResult)
 * ----------------------------------------------------------------------------
 * 1) Проверяем сумму (только по селекторам).
 * 2) Если ОК, жмём кнопку "Разместить заказ".
 */


let capturedOrderApiJson = null;   // сюда положим первый пришедший JSON

// -----------------------------------------------------------------------------
// checkCartSumm(page, cartResult)
// 1) Проверяем сумму ("Всего" + "Вознаграждения").
// 2) Если всё ОК — нажимаем "Разместить заказ".
// 3) Сразу после навигации забираем JSON заказа fetch-ом.
// -----------------------------------------------------------------------------
async function checkCartSumm(page, cartResult) {
  try {
    console.log('[checkCartSumm] -> Сверяем сумму корзины...');

    // ---------- 1. Сумма "Всего" ----------
    const pageTotalText = await page.$$eval(
      'div.LineItem-sc-wlrx-1.bzMOFj',
      els => {
        for (const el of els) {
          if (el.textContent.trim().includes('Всего')) {
            const s = el.nextElementSibling;
            return s ? s.textContent.trim() : null;
          }
        }
        return null;
      }
    );
    if (!pageTotalText) throw new Error('Не найдена сумма "Всего".');

    const totalValue = parseFloat(
      pageTotalText.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '')
    ) || 0;

    // ---------- 2. Сумма "Вознаграждения" ----------
    let rewardValue = 0;
    const rewardText = await page.$$eval(
      'div.LineItem-sc-wlrx-1.bzMOFj',
      els => {
        for (const el of els) {
          if (el.textContent.trim().includes('Вознаграждения')) {
            const s = el.nextElementSibling;
            return s ? s.textContent.trim() : null;
          }
        }
        return null;
      }
    );
    if (rewardText) {
      const num = parseFloat(
        rewardText.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '')
      );
      if (!isNaN(num)) rewardValue = Math.abs(num);
    }

    const finalSum = totalValue + rewardValue;
    console.log(`[checkCartSumm] -> Всего: $${totalValue}, Вознаграждения: $${rewardValue}, Итого: $${finalSum}`);

    // ---------- 3. Сравниваем с предыдущим значением ----------
    if (Math.abs(finalSum - cartResult.cartTotal) > 0.001) {
      throw new Error(`[checkCartSumm] -> Суммы не совпадают! Было $${cartResult.cartTotal}, стало $${finalSum}`);
    }
    console.log('[checkCartSumm] -> Суммы совпадают.');

    // ---------- 4. Нажимаем "Разместить заказ" ----------
    await safeClickWithRetry(page, {
      selector: 'button#place-order-button',
      label: 'Разместить заказ',
      waitForNavigation: true,
      expectedUrls: ['/scd/order-receipt', '/ui/transaction']
    });

    // ---------- 5. Забираем JSON заказа fetch-ом ----------
    let orderApiJson = null;
    try {
      // Ждём, пока новый документ подгрузится достаточно, чтобы знать URL
      // await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>{});

      const cur = page.url();
      let on = '';

      if (cur.includes('/order-receipt')) {
        on = new URL(cur).searchParams.get('on') || '';
      } else if (cur.includes('/ui/transaction')) {
        const ret = new URL(cur).searchParams.get('returnUrl') || '';
        if (ret) on = new URL(ret).searchParams.get('on') || '';
      }

      if (on) {
        orderApiJson = await page.evaluate(async (apiPath) => {
          try {
            const r = await fetch(apiPath, { credentials: 'include' });
            if (!r.ok) return null;
            return r.json();
          } catch { return null; }
        }, `/api/checkout/order?OrderNumber=${on}`);

        if (orderApiJson) console.log('[checkCartSumm] -> JSON заказа получен fetch-ом.');
      }
    } catch (_) { /* игнор */ }

    // ---------- 6. Отдаём результат ----------
    return {
      cartTotal: finalSum,
      rewardsUsed: rewardValue,
      orderApiJson     // null, если запрос не получился
    };

  } catch (err) {
    console.log('[checkCartSumm] -> Ошибка:', err.message);
    throw err;
  }
}

module.exports = { checkCartSumm };




