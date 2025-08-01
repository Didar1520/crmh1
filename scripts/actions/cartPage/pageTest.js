// applyCoupon.js

/**
 * applyCoupon(page, { promoCode, referralCode })
 * ----------------------------------------------------------------------------
 * 1) Если есть promoCode => вводим, нажимаем "Применить", ждём POST /api/Carts/v2/applyCoupon, 2с пауза.
 * 2) Если есть referralCode => аналогично.
 * 3) В конце 5с пауза.
 * 
 * Изменения:
 *  - Используется safeClickWithRetry для повторного нажатия кнопки, если серверный ответ не получен.
 *  - Если ответ не OK или не получен после нескольких попыток – выбрасывается ошибка.
 */

async function applyCoupon(page, { promoCode, referralCode }) {
  console.log('[applyCoupon] -> Начинаем процесс применения промокодов/рефкодов...');

  if (!promoCode && !referralCode) {
    console.log('[applyCoupon] -> Нет promoCode/referralCode, выходим.');
    return;
  }

  const COUPON_INPUT_SELECTOR = 'input#coupon-input';
  const COUPON_APPLY_BTN_SELECTOR = 'button#coupon-apply';

  // Утилита ожидания ответа от сервера
  async function waitForApplyCouponResponse() {
    console.log('[applyCoupon] -> Ждём POST /api/Carts/v2/applyCoupon...');
    const response = await page.waitForResponse(
      resp =>
        resp.url().includes('/api/Carts/v2/applyCoupon') &&
        resp.request().method() === 'POST',
      { timeout: 15000 }
    );
    const status = response.status();
    console.log(`[applyCoupon] -> /api/Carts/v2/applyCoupon статус=${status}`);
    if (!response.ok()) {
      throw new Error(`[applyCoupon] -> Ответ не OK, status=${status}`);
    }
    return await response.json();
  }

  // Функция повторного клика: пытаемся нажать кнопку до maxAttempts раз,
  // создавая промис ожидания ответа до клика.
  async function safeClickWithRetry(page, selector, label, waitForResponseFunc) {
    const maxAttempts = 3;
    let attempt = 0;
    let lastError;
    while (attempt < maxAttempts) {
      try {
        // Ждём, пока элемент станет видимым
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        // Создаём промис ожидания ответа до клика
        const responsePromise = waitForResponseFunc();
        await safeClick(page, selector, label);
        const response = await responsePromise;
        return response;
      } catch (error) {
        lastError = error;
        attempt++;
        console.log(`[applyCoupon] -> Попытка ${attempt} для ${label} не удалась: ${error.message}`);
        if (attempt < maxAttempts) {
          console.log(`[applyCoupon] -> Повторная попытка нажатия ${label}...`);
          await sleep(500); // небольшая задержка перед повторной попыткой
        }
      }
    }
    throw new Error(`[applyCoupon] -> Не удалось получить корректный ответ после ${maxAttempts} попыток для ${label}: ${lastError.message}`);
  }

  // Основной метод применения кода
  async function applyOneCode(codeValue, codeLabel) {
    console.log(`[applyCoupon] -> Применяем ${codeLabel}="${codeValue}"`);
  
    // Ждём, пока поле ввода станет видимым
    await page.waitForSelector(COUPON_INPUT_SELECTOR, { visible: true, timeout: 5000 });
  
    // Очищаем поле: кликаем и нажимаем Backspace несколько раз
    await page.click(COUPON_INPUT_SELECTOR, { clickCount: 3 });
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Backspace');
    }
  
    // Вводим код
    await page.type(COUPON_INPUT_SELECTOR, codeValue, { delay: 50 });
    
    // Проверяем, есть ли всплывающее окно и удаляем его, если оно присутствует
    await page.evaluate(() => {
      const toast = document.getElementById('toastMsg');
      if (toast) {
        toast.remove();
        console.log('[applyCoupon] -> Всплывающее окно удалено.');
      }
    });
  
    // Нажимаем "Применить" с повторными попытками до получения корректного ответа
    const jsonData = await safeClickWithRetry(page, COUPON_APPLY_BTN_SELECTOR, `"Применить" (${codeLabel})`, waitForApplyCouponResponse);
  
    console.log(`[applyCoupon] -> Ответ JSON для ${codeLabel}: promoCode: ${jsonData.promoCode}, referralCode: ${jsonData.referralCode}`);
  
    if (codeLabel === 'promoCode') {
      const appliedPromo = (jsonData.promoCode || '').toLowerCase();
      if (appliedPromo === codeValue.toLowerCase()) {
        console.log(`[applyCoupon] -> Промокод "${codeValue}" применён успешно!`);
      } else {
        throw new Error(`[applyCoupon] -> Промокод "${codeValue}" не применился (jsonData="${appliedPromo}")`);
      }
    } else {
      const appliedRef = (jsonData.referralCode || '').toLowerCase();
      if (appliedRef === codeValue.toLowerCase()) {
        console.log(`[applyCoupon] -> Рефкод "${codeValue}" применён успешно!`);
      } else {
        throw new Error(`[applyCoupon] -> Рефкод "${codeValue}" не применился (jsonData="${appliedRef}")`);
      }
    }
  
    // Небольшая пауза
    await sleep(2000);
  }
  

  // Применяем promoCode
  if (promoCode) {
    await applyOneCode(promoCode, 'promoCode');
  }

  // Применяем referralCode
  if (referralCode) {
    await applyOneCode(referralCode, 'referralCode');
  }

  // Финальная пауза
  console.log('[applyCoupon] -> Завершаем, ждём 5 секунд...');
  await sleep(5000);
  console.log('[applyCoupon] -> Применение купонов/рефкодов завершено.');
}

/**
 * Безопасный клик.
 * Ждёт появления элемента, скроллит к нему и производит клик.
 */
async function safeClick(page, selector, label) {
  await page.waitForSelector(selector, { visible: true, timeout: 5000 });
  // Скроллим к элементу
  await page.evaluate((sel) => {
    const btn = document.querySelector(sel);
    if (!btn) throw new Error(`Элемент ${sel} не найден для safeClick`);
    btn.scrollIntoView({ block: 'center', inline: 'center' });
  }, selector);

  await page.click(selector, { delay: 50 });
  console.log(`[applyCoupon] -> Клик по кнопке: ${label}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { applyCoupon };
