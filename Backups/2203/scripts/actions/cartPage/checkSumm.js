// checkSumm.js

/**
 * checkSumm(page, maxAllowed)
 * -----------------------------------------------------------------------------
 * Считывает сумму корзины + вознаграждения, сравнивает с maxAllowed.
 * Если всё ок, кликает "Оформить заказ" (btn-to-checkout) и ждёт перехода на один из:
 *   - https://checkout12.iherb.com/scd
 *   - https://checkout12.iherb.com/transactions/checkout
 * Если переход не произошёл — считается, что кнопка не была успешно нажата.
 * Возвращает { cartTotal, rewardsUsed } для использования в preOrderPage.
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

  // Если сумма в норме => кликаем "Оформить заказ" с проверкой успешного перехода
  console.log('[checkSumm] -> Сумма в норме, жмём "Оформить заказ".');
  await safeClickWithNavigation(
    page,
    'button[data-qa-element="btn-to-checkout"]',
    'Оформить заказ',
    [
      "https://checkout12.iherb.com/scd",
      "https://checkout12.iherb.com/transactions/checkout"
    ]
  );
  
  return {
    cartTotal: finalSum,
    rewardsUsed: rewardsCredit
  };
}

/**
 * Безопасный клик по селектору:
 *  - Ждёт появления элемента,
 *  - Скроллит к нему,
 *  - И кликает по нему.
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

/**
 * Функция для безопасного клика с проверкой перехода.
 * После клика ждёт, пока текущий URL не станет равным одному из expectedUrls.
 * Если переход не произошёл, повторяет клик до 3 раз.
 */
async function safeClickWithNavigation(page, selector, label, expectedUrls) {
  const maxAttempts = 3;
  let attempt = 0;
  let lastError;
  while (attempt < maxAttempts) {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: 10000 });
      // Устанавливаем ожидание навигации до клика
      const navigationPromise = page.waitForNavigation({ waitUntil: 'load', timeout: 10000 });
      await safeClick(page, selector, label);
      try {
        await navigationPromise;
      } catch (navError) {
        // Если произошёл таймаут, проверяем URL – возможно, навигация уже произошла
        const currentUrl = page.url();
        if (Array.isArray(expectedUrls) ? expectedUrls.includes(currentUrl) : currentUrl === expectedUrls) {
          console.log(`[checkSumm] -> Навигация произошла (URL: ${currentUrl}), хотя waitForNavigation сработал с таймаутом.`);
          return;
        } else {
          throw navError;
        }
      }
      // После клика проверяем URL
      const currentUrl = page.url();
      if (Array.isArray(expectedUrls) ? expectedUrls.includes(currentUrl) : currentUrl === expectedUrls) {
        console.log(`[checkSumm] -> Успешно перешли на ${currentUrl}`);
        return;
      } else {
        throw new Error(`После клика URL "${currentUrl}" не совпадает с ожидаемыми: ${expectedUrls}`);
      }
    } catch (error) {
      lastError = error;
      attempt++;
      console.log(`[checkSumm] -> Попытка ${attempt} для ${label} не удалась: ${error.message}`);
      if (attempt < maxAttempts) {
        console.log(`[checkSumm] -> Повторная попытка нажатия ${label}...`);
        await sleep(500); // небольшая задержка перед новой попыткой
      }
    }
  }
  throw new Error(`[checkSumm] -> Не удалось перейти на ${expectedUrls} после ${maxAttempts} попыток для ${label}: ${lastError.message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { checkSumm };
