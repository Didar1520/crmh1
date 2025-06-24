// checkCartSumm.js
const { safeWaitForLoad } = require('../utils/pageLoadHelper.js');

/**
 * checkCartSumm(page, cartResult)
 * ----------------------------------------------------------------------------
 * 1) Проверяем сумму (только по селекторам).
 * 2) Если ОК, жмём кнопку "Разместить заказ".
 * 3) Явно ждём ответ /api/checkout/order?OrderNumber=...
 * 4) Возвращаем из функции объект с данными заказа (или null, если не было запроса).
 */
async function checkCartSumm(page, cartResult) {
  try {
    console.log('[checkCartSumm] -> Сверяем сумму корзины...');

    // // 1) Ждём загрузки
    // await safeWaitForLoad(page, 8000);

    // 2) Получаем "Всего"
    const pageTotalText = await page.$$eval('div.LineItem-sc-wlrx-1.bzMOFj', elements => {
      for (const el of elements) {
        const text = el.textContent.trim();
        if (text.includes('Всего')) {
          const sibling = el.nextElementSibling;
          return sibling ? sibling.textContent.trim() : null;
        }
      }
      return null;
    });

    if (!pageTotalText) {
      throw new Error('Не удалось найти сумму "Всего" на странице.');
    }

    const totalValue = parseFloat(pageTotalText.replace(/[^\d.-]/g, '')) || 0;

    // 3) Ищем "Вознаграждения"
    let rewardValue = 0;
    const rewardText = await page.$$eval('div.LineItem-sc-wlrx-1.bzMOFj', elements => {
      for (const el of elements) {
        const text = el.textContent.trim();
        if (text.includes('Вознаграждения')) {
          const sibling = el.nextElementSibling;
          return sibling ? sibling.textContent.trim() : null;
        }
      }
      return null;
    });

    if (rewardText) {
      const rewardNum = parseFloat(rewardText.replace(/[^\d.-]/g, ''));
      if (!isNaN(rewardNum)) {
        rewardValue = Math.abs(rewardNum);
      }
    }

    const finalSum = totalValue + rewardValue;
    console.log(`[checkCartSumm] -> Всего: $${totalValue}, Вознаграждения: $${rewardValue}, Итого: $${finalSum}`);

    // 4) Сравниваем с cartResult.cartTotal
    const previousCartTotal = cartResult.cartTotal;
    const eps = 0.001;
    if (Math.abs(finalSum - previousCartTotal) > eps) {
      throw new Error(
        `[checkCartSumm] -> Суммы корзины не совпадают! Предыдущая: $${previousCartTotal}, текущая: $${finalSum}`
      );
    }
    console.log(`[checkCartSumm] -> Суммы совпадают. Предыдущая: $${previousCartTotal}, текущая: $${finalSum}`);

    // 5) Готовимся ждать ответ /api/checkout/order?OrderNumber=... c таймаутом 15с (можете изменить)
    const waitOrderResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/checkout/order?OrderNumber=') &&
        resp.request().method() === 'GET',
      { timeout: 15000 }
    ).catch(err => {
      // Если за 15с не пришёл ответ, будет ошибка:
      console.log('[checkCartSumm] -> Не дождались ответа /api/checkout/order?OrderNumber=', err);
      return null; // Можно вернуть null, чтобы не рушить весь скрипт
    });

    // 6) Кликаем кнопку "Разместить заказ" и ПАРАЛЛЕЛЬНО ждём ответ
    const placeOrderBtnSelector = 'button#place-order-button';

    await page.waitForSelector(placeOrderBtnSelector, { visible: true, timeout: 10000 });

    console.log('[checkCartSumm] -> Кликаем "Разместить заказ" и ждём ответ /api/checkout/order...');
    await page.click(placeOrderBtnSelector);

    // 7) Дожидаемся ответа (или null, если таймаут)
    const orderResponse = await waitOrderResponsePromise;
    let capturedFinalOrderData = null;
    if (orderResponse) {
      if (orderResponse.ok()) {
        capturedFinalOrderData = await orderResponse.json();
        console.log('[checkCartSumm] -> Успешно получили orderData:', capturedFinalOrderData.orderNumber);
      } else {
        console.log(`[checkCartSumm] -> Ответ /api/checkout/order?OrderNumber= вернулся со статусом: ${orderResponse.status()}`);
      }
    } else {
      console.log('[checkCartSumm] -> Ответ так и не пришёл или произошла ошибка.');
    }

    // 8) Возвращаем итог
    return capturedFinalOrderData;

  } catch (error) {
    console.log(`[checkCartSumm] -> Общая ошибка: ${error.message}`);
    throw error;
  }
}

module.exports = { checkCartSumm };
