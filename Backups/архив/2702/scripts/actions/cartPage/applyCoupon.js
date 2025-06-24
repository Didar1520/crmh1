// scripts/actions/cartPage/applyCoupon.js
/**
 * applyCoupon(page, { promoCode, referralCode })
 * --------------------------------------------------------
 * 1) Если promoCode есть:
 *    - Вводим (с очищением) в input#coupon-input
 *    - Ждём ответ POST /api/Carts/v2/applyCoupon
 *    - Сверяем promoCode в JSON (promoCode)
 *    - Задержка 1–2 сек
 * 2) Если referralCode есть:
 *    - Аналогично, вводим, кликаем, ждём ответ, проверяем referralCode
 */

async function applyCoupon(page, { promoCode, referralCode }) {
    console.log('[applyCoupon] -> Начало применения промокода и реф.кода...');
  
    // Если нет ни промокода, ни реф.кода — уходим.
    if (!promoCode && !referralCode) {
      console.log('[applyCoupon] -> Нет promoCode/referralCode, выходим.');
      return;
    }
  
    // Селекторы
    const COUPON_INPUT_SELECTOR = 'input#coupon-input';
    const COUPON_APPLY_BTN_SELECTOR = 'button#coupon-apply';
  
    // Мелкая функция sleep
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  
    // Функция ожидания запроса /api/Carts/v2/applyCoupon
    async function waitForApplyCouponResponse() {
      console.log('[applyCoupon] -> Ждём ответ POST /api/Carts/v2/applyCoupon...');
      const [response] = await Promise.all([
        page.waitForResponse(resp =>
          resp.url().includes('/api/Carts/v2/applyCoupon') &&
          resp.request().method() === 'POST'
        , { timeout: 10000 }),
        // Клик по кнопке "Применить" будет во внешнем коде
      ]);
      const status = response.status();
      console.log(`[applyCoupon] -> /api/Carts/v2/applyCoupon ответ статус=${status}`);
      if (!response.ok()) {
        throw new Error(`[applyCoupon] -> Ответ /applyCoupon не OK, status=${status}`);
      }
      const json = await response.json();
      return json;
    }
  
    // Универсальная функция для применения одного кода (промо/реф)
    async function applyOneCode(codeValue, codeTypeLabel) {
      console.log(`[applyCoupon] -> Применяем ${codeTypeLabel}="${codeValue}"`);
  
      // Ждём инпут
      await page.waitForSelector(COUPON_INPUT_SELECTOR, { visible: true, timeout: 5000 });
  
      // Очищаем поле (если в нём что-то есть)
      await page.click(COUPON_INPUT_SELECTOR, { clickCount: 3 });
      await page.keyboard.press('Backspace');
      // Вводим код
      await page.type(COUPON_INPUT_SELECTOR, codeValue, { delay: 50 });
  
      // Готовимся словить ответ
      const applyCouponPromise = waitForApplyCouponResponse();
  
      // Жмём кнопку "Применить"
      await page.waitForSelector(COUPON_APPLY_BTN_SELECTOR, { visible: true, timeout: 3000 });
      await page.click(COUPON_APPLY_BTN_SELECTOR);
  
      // Ждём JSON
      const jsonData = await applyCouponPromise;
      console.log(`[applyCoupon] -> Ответ JSON для ${codeTypeLabel}:`, jsonData);
  
      // Проверяем промокод/рефкод в JSON
      if (codeTypeLabel === 'promoCode') {
        const appliedPromo = jsonData.promoCode || '';
        if (appliedPromo.toLowerCase() === codeValue.toLowerCase()) {
          console.log(`[applyCoupon] -> Промокод "${codeValue}" применён успешно!`);
        } else {
          console.log(`[applyCoupon] -> Промокод "${codeValue}" не совпадает в JSON.promoCode="${appliedPromo}"`);
        }
      } else {
        // referralCode
        const appliedRef = jsonData.referralCode || '';
        if (appliedRef.toLowerCase() === codeValue.toLowerCase()) {
          console.log(`[applyCoupon] -> Рефкод "${codeValue}" применён успешно!`);
        } else {
          console.log(`[applyCoupon] -> Рефкод "${codeValue}" не совпадает JSON.referralCode="${appliedRef}"`);
        }
      }
  
      // Подождём 2 сек, чтобы сайт пересчитал корзину и т.д.
      await sleep(2000);
    }
  
    // 1) Применяем PROMO-код
    if (promoCode) {
      try {
        await applyOneCode(promoCode, 'promoCode');
      } catch (errPromo) {
        console.log('[applyCoupon] -> Ошибка при применении промокода:', errPromo);
      }
    }
  
    // 2) Применяем REFERRAL-код
    if (referralCode) {
      try {
        await applyOneCode(referralCode, 'referralCode');
      } catch (errRef) {
        console.log('[applyCoupon] -> Ошибка при применении рефкода:', errRef);
      }
    }
  
    console.log('[applyCoupon] -> Применение купонов завершено.');
  }
  
  module.exports = { applyCoupon };
  