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

async function checkCartSumm(page, cartResult) {
  try {
    console.log('[checkCartSumm] -> Сверяем сумму корзины...');

    // 1) Получаем "Всего"
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

   const cleanedTotal = pageTotalText
  .replace(/\s/g, '')      // убираем обычные и неразрывные пробелы
  .replace(',', '.')       // запятую-разделитель переводим в точку
  .replace(/[^0-9.]/g, ''); // оставляем только цифры и точку

const totalValue = parseFloat(cleanedTotal) || 0;


    // 2) Ищем "Вознаграждения"
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
      const cleanedReward = rewardText
  .replace(/\s/g, '')
  .replace(',', '.')
  .replace(/[^0-9.]/g, '');

const rewardNum = parseFloat(cleanedReward);

      if (!isNaN(rewardNum)) rewardValue = Math.abs(rewardNum);
    }

    const finalSum = totalValue + rewardValue;
    console.log(`[checkCartSumm] -> Всего: $${totalValue}, Вознаграждения: $${rewardValue}, Итого: $${finalSum}`);

    // 3) Сравниваем с cartResult.cartTotal
    const previousCartTotal = cartResult.cartTotal;
    if (Math.abs(finalSum - previousCartTotal) > 0.001) {
      throw new Error(
        `[checkCartSumm] -> Суммы не совпадают! Предыдущая: $${previousCartTotal}, текущая: $${finalSum}`
      );
    }
    console.log(`[checkCartSumm] -> Суммы совпадают ($${finalSum}).`);


  // ——— подписка на order-API (ожидаем ≤ 12 c, без r.ok()) ———
  const orderApiPromise = page.waitForResponse(
    r => r.url().includes('/api/checkout/order?OrderNumber=') &&
         r.request().method() === 'GET',
    { timeout: 12000 }   // вместо 30000
  ).catch(() => null);





      // ——— слушатель ответа /api/checkout/order ———
    page.once('response', async (resp) => {
      try {
        const u = resp.url();
        if (u.includes('/api/checkout/order?OrderNumber=') && resp.request().method() === 'GET') {
          capturedOrderApiJson = await resp.json().catch(() => null);
          console.log('[checkCartSumm] -> order API пойман слушателем.');
        }
      } catch (_) { /* игнор */ }
    });


    // 4) Жмём "Разместить заказ"
  const placeOrderBtnSelector = 'button#place-order-button';
  await safeClickWithRetry(page, {
  selector: placeOrderBtnSelector,
  label: 'Разместить заказ',
  waitForNavigation: true,
expectedUrls: [
  '/scd/order-receipt',   // финальный чек
  '/ui/transaction'       // сценарий «booked»
]
});




    // --- отдаём данные дальше, включая подписку на order-API ---
    return {
      cartTotal:   finalSum,
      rewardsUsed: rewardValue,
      orderApiPromise,        // промис с ответом API (или null)
       orderApiJson: capturedOrderApiJson 
    };


  } catch (error) {
    console.log(`[checkCartSumm] -> Ошибка: ${error.message}`);
    throw error;
  }
}

module.exports = { checkCartSumm };
