// scripts/actions/utils/pageLoadHelper.js

const defaultWaitTime = 60000; // 60 секунд таймаут

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * safeGoto(page, url, options = {})
 * -----------------------------------------------------------------------------
 * - Переходит на адрес url, не дожидаясь "domcontentloaded" или "networkidle2".
 *   Puppeteer вернёт управление, как только навигация «стартует» и не упадёт по
 *   таймауту сети.
 * - Если случился таймаут/ошибка, делает reload() и повторяет, maxRetries раз.
 * - По умолчанию timeout = 30000, чтобы дать сайту больше времени ответить.
 */
async function safeGoto(page, url, options = {}) {
  const {
    timeout = 30000,     // Увеличиваем время ожидания ответа на запрос
    referer = 'https://google.com',
    extraWait = 0,       
    maxRetries = 1       
  } = options;

  let attempt = 0;
  const startTime = Date.now();

  while (attempt <= maxRetries) {
    try {
      console.log(`[safeGoto] -> Попытка #${attempt} перехода на: ${url}`);
      // Убираем waitUntil, тогда Puppeteer вернётся как только не будет мгновенной сети-ошибки
      await page.goto(url, { timeout, referer });

      const loadTime = Date.now() - startTime;
      console.log(`[safeGoto] -> Успешно вызван goto() для: ${url} (попытка #${attempt}), время: ${loadTime} мс`);

      // При желании здесь можно вызвать safeWaitForLoad(page), если нужно
      if (extraWait > 0) {
        await sleep(extraWait);
      }
      return; // если всё ОК
    } catch (err) {
      console.log(`[safeGoto] -> Ошибка при переходе на "${url}" (попытка #${attempt}): ${err.message}`);

      if (attempt < maxRetries) {
        console.log('[safeGoto] -> Пробуем перезагрузить страницу и повторить...');
        try {
          await page.reload({ timeout });
          console.log('[safeGoto] -> reload() завершился, повторяем попытку...');
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
 * - Без лишних ожиданий: если документ загружен быстро, продолжаем сразу.
 * - При необходимости подстраховаться — extraWait > 0.
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
