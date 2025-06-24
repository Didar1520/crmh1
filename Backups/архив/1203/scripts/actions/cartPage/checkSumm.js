// checkSumm.js

/**
 * checkSumm(page, maxAllowed)
 * -----------------------------------------------------------------------------
 * Считывает сумму корзины + вознаграждения, сравнивает с maxAllowed.
 * Если всё ок, жмём "Оформить заказ" (btn-to-checkout).
 * Возвращаем { cartTotal, rewardsUsed } для использования в preOrderPage.
 */

async function checkSumm(page, maxAllowed = 200) {
  console.log(`[checkSumm] -> Проверяем сумму с лимитом $${maxAllowed}`);

  let totalPrice = 0;
  try {
    const priceText = await page.$eval('span[data-qa-element="total-price"]', el => el.textContent.trim());
    totalPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
    console.log(`[checkSumm] -> Основная сумма корзины: $${totalPrice}`);
  } catch (err) {
    console.log('[checkSumm] -> Не удалось получить основную сумму:', err);
    throw new Error(`Не удалось считать основную сумму корзины: ${err.message || err}`);
  }

  let rewardsCredit = 0;
  try {
    const rewardsText = await page.$eval('div[data-qa-element="rewards-credit"]', el => el.textContent.trim());
    rewardsCredit = Math.abs(parseFloat(rewardsText.replace(/[^0-9.]/g, '')) || 0);
    console.log(`[checkSumm] -> Вознаграждения: $${rewardsCredit}`);
  } catch {
    console.log('[checkSumm] -> Вознаграждения не найдены, считаем 0.');
  }

  const finalSum = totalPrice + rewardsCredit;
  console.log(`[checkSumm] -> Итоговая сумма (с вознаграждениями): $${finalSum.toFixed(2)}`);

  if (finalSum > maxAllowed) {
    throw new Error(`[checkSumm] -> Сумма $${finalSum.toFixed(2)} > лимита $${maxAllowed}`);
  }

  // Если сумма в норме => кликаем "Оформить заказ"
  console.log('[checkSumm] -> Сумма в норме, жмём "Оформить заказ".');
  await safeClick(page, 'button[data-qa-element="btn-to-checkout"]', 'Оформить заказ');

  return {
    cartTotal: finalSum,
    rewardsUsed: rewardsCredit
  };
}

/**
 * Безопасный клик по селектору:
 *  - Ждём, скроллим в зону видимости
 *  - Кликаем
 */
async function safeClick(page, selector, label = 'кнопка') {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 10000 });
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) {
        throw new Error(`Элемент ${sel} не найден для клика.`);
      }
      el.scrollIntoView({ block: 'center', inline: 'center' });
    }, selector);

    await page.click(selector, { delay: 50 });
    console.log(`[checkSumm] -> Нажата ${label}`);
  } catch (err) {
    throw new Error(`Ошибка при нажатии на "${label}" (${selector}): ${err.message || err}`);
  }
}

module.exports = { checkSumm };
