// scripts/actions/utils/pageLoadHelper.js

const defaultWaitTime = 60000; // 60 секунд таймаут

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * safeGoto(page, url, options = {})
 * -----------------------------------------------------------------------------
 * - Переходит на адрес url с waitUntil/timeout/referer.
 * - Если случился таймаут или ошибка при переходе, делает reload() и повторяет.
 * - Кол-во попыток регулируется maxRetries (по умолчанию 1 повтор, т.е. 2 попытки).
 * - Если страница грузится быстро, никаких лишних ожиданий нет (extraWait=0).
 */
async function safeGoto(page, url, options = {}) {
  const {
    waitUntil = 'networkidle2',
    timeout = defaultWaitTime,
    referer = 'https://google.com',
    extraWait = 0,       // если нужно чуть подождать после загрузки
    maxRetries = 1       // кол-во повторов при ошибке (таймаут и т.п.)
  } = options;

  let attempt = 0;
  const startTime = Date.now();

  while (attempt <= maxRetries) {
    try {
      console.log(`[safeGoto] -> Попытка #${attempt} перехода на: ${url}`);
      await page.goto(url, { waitUntil, timeout, referer });

      const loadTime = Date.now() - startTime;
      console.log(`[safeGoto] -> Успешно перешли на: ${url} (попытка #${attempt}), время: ${loadTime} мс`);

      if (extraWait > 0) {
        await sleep(extraWait);
      }
      // Если всё ОК, выходим из функции
      return;
    } catch (err) {
      console.log(`[safeGoto] -> Ошибка при переходе на "${url}" (попытка #${attempt}): ${err.message}`);

      if (attempt < maxRetries) {
        console.log('[safeGoto] -> Пробуем перезагрузить страницу и повторить...');
        try {
          await page.reload({ waitUntil, timeout });
          console.log('[safeGoto] -> reload() завершился, перейдём к повторной попытке...');
        } catch (reloadErr) {
          console.log('[safeGoto] -> Ошибка при reload():', reloadErr.message);
        }
      } else {
        console.log('[safeGoto] -> Достигнут предел повторов, выбрасываем ошибку...');
        throw new Error(
          `[safeGoto] -> Все попытки загрузить "${url}" исчерпаны: ${err.message}`
        );
      }
    }

    attempt++;
  }
}

/**
 * safeWaitForLoad(page, extraWait = 0)
 * -----------------------------------------------------------------------------
 * - Ждёт, пока document.readyState === 'complete'.
 * - Без лишних задержек: если документ загружен быстро, сразу продолжаем.
 * - Если всё же надо подстраховаться/подождать чуть дольше, используйте extraWait > 0.
 */
async function safeWaitForLoad(page, extraWait = 0) {
  const start = Date.now();
  console.log('[safeWaitForLoad] -> Ожидаем document.readyState === "complete"...');

  try {
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: defaultWaitTime }
    );
    const loadTime = Date.now() - start;
    console.log(`[safeWaitForLoad] -> Страница загружена. Время: ${loadTime} мс`);

    if (extraWait > 0) {
      await sleep(extraWait);
    }
  } catch (err) {
    console.log('[safeWaitForLoad] -> Ошибка ожидания загрузки документа:', err);
    throw err;
  }
}

module.exports = {
  safeGoto,
  safeWaitForLoad,
  sleep
};
