const { safeWaitForLoad } = require('../utils/pageLoadHelper.js');

/**
 * checkCartSumm(page, cartResult)
 * ----------------------------------------------------------------------------
 * 1) Проверяем сумму (только по селекторам).
 * 2) Если ОК, жмём кнопку "Разместить заказ".
 */
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

    const totalValue = parseFloat(pageTotalText.replace(/[^\d.-]/g, '')) || 0;

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
      const rewardNum = parseFloat(rewardText.replace(/[^\d.-]/g, ''));
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

    // 4) Жмём "Разместить заказ"
    const placeOrderBtnSelector = 'button#place-order-button';
    await page.waitForSelector(placeOrderBtnSelector, { visible: true, timeout: 10000 });
    console.log('[checkCartSumm] -> Кликаем "Разместить заказ"...');
    await page.click(placeOrderBtnSelector);

  } catch (error) {
    console.log(`[checkCartSumm] -> Ошибка: ${error.message}`);
    throw error;
  }
}

module.exports = { checkCartSumm };
