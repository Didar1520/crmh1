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
        await hideToast(page);
        await scrollElementIntoView(page, selector);
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
    await scrollElementIntoView(page, COUPON_INPUT_SELECTOR);

    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ block: 'center', inline: 'center' }); // возвращаем инпут в центр
    }, COUPON_INPUT_SELECTOR);


    // Очищаем поле: кликаем и нажимаем Backspace несколько раз
    await page.click(COUPON_INPUT_SELECTOR, { clickCount: 3 });
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Backspace');
    }

    // Вводим код
    await page.type(COUPON_INPUT_SELECTOR, codeValue.trim(), { delay: 50 });





    // Нажимаем "Применить" с повторными попытками до получения корректного ответа
    const jsonData = await safeClickWithRetry(page, COUPON_APPLY_BTN_SELECTOR, `"Применить" (${codeLabel})`, waitForApplyCouponResponse);

    console.log(`[applyCoupon] -> Ответ JSON для ${codeLabel}: promoCode: ${jsonData.promoCode}, referralCode: ${jsonData.referralCode}`);

      const normalize = (s) => (s || '').trim().toLowerCase();

    if (codeLabel === 'promoCode') {
      const promoFromServer   = normalize(jsonData.promoCode);
      const betterPromoMsg    = (jsonData.invalidPromoCodeMessage || jsonData.discountMessage || '').toLowerCase();
      const promoMentioned    = (jsonData.invalidPromoCodeMessage || '').toLowerCase().includes(normalize(codeValue));

      if (
        promoFromServer === normalize(codeValue) ||                       // применён точно наш код
        betterPromoMsg.includes('промокод с наибольшей скидкой') ||       // сервер сообщил о более выгодной скидке
        promoMentioned                                                 // серверная фраза упоминает наш код
      ) {
        console.log(`[applyCoupon] -> Промокод "${codeValue}" либо применён, либо уже действует более выгодная скидка. Продолжаем.`);
      } else {
        throw new Error(`[applyCoupon] -> Промокод "${codeValue}" не применился (server promoCode="${jsonData.promoCode}")`);
      }

    } else { // referralCode
      const referralFromServer = normalize(jsonData.referralCode);
      const invalidReferralMsg = (jsonData.invalidReferalCodeMessage || '').toLowerCase();
      const referralMentioned  = invalidReferralMsg.includes(normalize(codeValue));

      if (
        referralFromServer === normalize(codeValue) ||
        invalidReferralMsg.includes('наибольш') ||   // аналогичное сообщение о лучшей скидке
        referralMentioned
      ) {
        console.log(`[applyCoupon] -> Рефкод "${codeValue}" либо применён, либо уже действует более выгодная скидка. Продолжаем.`);
      } else {
        throw new Error(`[applyCoupon] -> Рефкод "${codeValue}" не применился (server referralCode="${jsonData.referralCode}")`);
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
  console.log('[applyCoupon] -> Завершаем, ждём 2 секунд...');
  await sleep(2000);
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
    // освобождаем кнопку из-под шапки

  }, selector);


  // гарантия, что элемент целиком в зоне видимости
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight &&
      r.left >= 0 && r.right <= window.innerWidth;
  }, {}, selector);



  await page.click(selector, { delay: 50 });
  console.log(`[applyCoupon] -> Клик по кнопке: ${label}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- вставьте сразу после объявления sleep() внизу файла ---
async function hideToast(page) {
  // ждём, пока всплывашка исчезнет сама
  try {
    await page.waitForSelector('#toastMsg', { hidden: true, timeout: 3000 });
    return;
  } catch (_) { /* всплывашка всё ещё видна */ }

  // если не скрылась — убираем вручную
  await page.evaluate(() => {
    const t = document.getElementById('toastMsg');
    if (t) {
      // первый вариант — убрать из DOM
      // t.remove();

      // более «мягко»: делаем прозрачной и выключаем события мыши
      t.style.opacity = '0';
      t.style.pointerEvents = 'none';
    }
  });
}

async function scrollElementIntoView(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;

    // сначала обычный scrollIntoView
    el.scrollIntoView({ block: 'center', inline: 'center' });

    // затем смещаем всё вверх на высоту зелёной шапки iHerb + небольшой запас
    const header = document.querySelector('header');
    const offset = (header ? header.offsetHeight : 80) + 10; // 10 px – запас
    window.scrollBy(0, -offset);
  }, selector);

  // даём верстке «устаканиться»
  await new Promise(r => setTimeout(r, 300));
}




module.exports = { applyCoupon };
