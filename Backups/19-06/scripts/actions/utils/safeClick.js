/**
 * safeClickWithRetry(page, options)
 * ------------------------------------------------------------
 * Универсальный «умный» клик с несколькими попытками.
 * Подходит для:
 *   • обычных кликов;
 *   • кликов, после которых ждём перехода (navigation);
 *   • кликов, после которых ждём сетевой ответ (waitForResponseFunc).
 *
 * Параметры:
 *   selector            — CSS-селектор для клика
 *   label               — подпись для логов
 *   waitForNavigation   — true | false  (нужно ли ожидать перехода)
 *   expectedUrls        — строка или массив URL, на которые должен перейти браузер
 *   waitForResponseFunc — () => Promise  (функция, создающая ожидание ответа)
 *   maxAttempts         — сколько раз пробовать (по умолч. 3)
 */

async function safeClickWithRetry(
  page,
  {
    selector,
    label = 'кнопка',
    waitForNavigation = false,
    expectedUrls = [],
    waitForResponseFunc = null,
    maxAttempts = 3,
    visibleTimeout = 10000,
    navigationTimeout = 10000
  }
) {
  let attempt = 0;
  let lastError;

  while (attempt < maxAttempts) {
    try {
      // 1) ждём появления/видимости
      await page.waitForSelector(selector, { visible: true, timeout: visibleTimeout });

      // 2) подготавливаем обещания до клика
      const navPromise = waitForNavigation
        ? page.waitForNavigation({ waitUntil: 'load', timeout: navigationTimeout })
        : null;

      const respPromise = typeof waitForResponseFunc === 'function' ? waitForResponseFunc() : null;

      // 3) скролл к элементу
      await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Элемент ${sel} не найден для клика.`);
        el.scrollIntoView({ block: 'center', inline: 'center' });
      }, selector);

      // 4) сам клик
      await page.click(selector, { delay: 50 });

      // 5) ждём навигацию, если надо
      if (navPromise) {
        try {
          await navPromise;
        } catch (err) {
          // если был таймаут — проверяем, может, переход всё-таки состоялся
          const cur = page.url();
         const ok = Array.isArray(expectedUrls)
  ? expectedUrls.some(u => cur.includes(u))
  : cur.includes(expectedUrls);

          if (!ok) throw err;
          console.log(`[safeClick] -> Навигация произошла (URL: ${cur}) несмотря на таймаут.`);
        }

        // финальная проверка URL
        const cur = page.url();
        if (expectedUrls.length) {
          const ok = Array.isArray(expectedUrls)
  ? expectedUrls.some(u => cur.includes(u))
  : cur.includes(expectedUrls);

          if (!ok) throw new Error(`После клика URL "${cur}" не совпадает с ожидаемыми: ${expectedUrls}`);
        }
      }

      // 6) ждём сетевой ответ, если нужно
      if (respPromise) await respPromise;

      console.log(`[safeClick] -> Успешно нажата ${label}`);
      return; // успех
    } catch (error) {
      attempt++;
      lastError = error;
      console.log(`[safeClick] -> Попытка ${attempt} для ${label} не удалась: ${error.message}`);
      if (attempt < maxAttempts) await sleep(500);
    }
  }

  throw new Error(
    `[safeClick] -> Не удалось выполнить ${label} (${selector}) за ${maxAttempts} попыток: ${lastError.message}`
  );
}

// небольшая пауза
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

module.exports = { safeClickWithRetry };
