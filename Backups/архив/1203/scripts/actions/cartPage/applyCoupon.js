// applyCoupon.js

/**
 * applyCoupon(page, { promoCode, referralCode })
 * ----------------------------------------------------------------------------
 * 1) Если есть promoCode => вводим, нажимаем "Применить", ждём POST /applyCoupon, 2с пауза.
 * 2) Если есть referralCode => аналогично.
 * 3) В конце 5с пауза.
 * 
 * Исправлено:
 *  - Используем safeClick для надёжного нажатия.
 *  - Если ответ не OK, сразу выбрасываем ошибку.
 *  - Если что-то не так — бросаем Error.
 */

async function applyCoupon(page, { promoCode, referralCode }) {
  console.log('[applyCoupon] -> Начинаем процесс применения промокодов/рефкодов...');

  if (!promoCode && !referralCode) {
    console.log('[applyCoupon] -> Нет promoCode/referralCode, выходим.');
    return;
  }

  const COUPON_INPUT_SELECTOR = 'input#coupon-input';
  const COUPON_APPLY_BTN_SELECTOR = 'button#coupon-apply';

  // Утилита ожидания ответа
  async function waitForApplyCouponResponse() {
    console.log('[applyCoupon] -> Ждём POST /api/Carts/v2/applyCoupon...');
    const [response] = await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes('/api/Carts/v2/applyCoupon') && resp.request().method() === 'POST',
        { timeout: 15000 }
      ),
      // параллельно будет клик
    ]);
    const status = response.status();
    console.log(`[applyCoupon] -> /api/Carts/v2/applyCoupon статус=${status}`);
    if (!response.ok()) {
      throw new Error(`[applyCoupon] -> Ответ не OK, status=${status}`);
    }
    return await response.json();
  }

  // Основной метод применения кода
  async function applyOneCode(codeValue, codeLabel) {
    console.log(`[applyCoupon] -> Применяем ${codeLabel}="${codeValue}"`);

    // Ждём поле ввода
    await page.waitForSelector(COUPON_INPUT_SELECTOR, { visible: true, timeout: 5000 });

    // Очищаем поле (кликаем и Backspace несколько раз)
    await page.click(COUPON_INPUT_SELECTOR, { clickCount: 3 });
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Backspace');
    }

    // Вводим код
    await page.type(COUPON_INPUT_SELECTOR, codeValue, { delay: 50 });

    // Нажимаем "Применить" и ждём ответ
    const [jsonData] = await Promise.all([
      (async () => {
        const respJson = await waitForApplyCouponResponse();
        return respJson;
      })(),
      safeClick(page, COUPON_APPLY_BTN_SELECTOR, `"Применить" (${codeLabel})`)
    ]);

    console.log(`[applyCoupon] -> Ответ JSON для ${codeLabel}:`, jsonData);

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

  // финальная пауза
  console.log('[applyCoupon] -> Завершаем, ждём 5 секунд...');
  await sleep(5000);
  console.log('[applyCoupon] -> Применение купонов/рефкодов завершено.');
}

/**
 * Безопасный клик
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
