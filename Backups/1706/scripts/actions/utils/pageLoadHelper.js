// scripts/actions/utils/pageLoadHelper.js
// -----------------------------------------------------------------------------
// Обновлено: safeWaitForLoad теперь:
//
// 1. Не ждёт лишних ресурсов – проверяет только состояние DOM.
// 2. Сам останавливает «бесконечную» загрузку (window.stop()),
//    если за 8 сек документ не стал complete.
// 3. Сохраняет прежний интерфейс и логику вызова.

const defaultWaitTime = 60000; // общий верхний таймаут

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ---------------------------------------------------------------- safeGoto */

async function safeGoto(page, url, options = {}) {
  const {
    timeout = 30000,
    referer = 'https://google.com',
    extraWait = 0,
    maxRetries = 1,
  } = options;

  let attempt = 0;
  const startTime = Date.now();

  while (attempt <= maxRetries) {
    try {
      console.log(`[safeGoto] -> Попытка #${attempt} перехода на: ${url}`);
      await page.goto(url, { timeout, referer });

      const loadTime = Date.now() - startTime;
      console.log(
        `[safeGoto] -> goto() успешно: ${url} (попытка #${attempt}), ${loadTime} мс`,
      );

      if (extraWait) await sleep(extraWait);
      return;
    } catch (err) {
      console.log(
        `[safeGoto] -> Ошибка goto "${url}" (#${attempt}): ${err.message}`,
      );

      if (attempt < maxRetries) {
        console.log('[safeGoto] -> reload() и повтор...');
        try {
          await page.reload({ timeout });
        } catch (reloadErr) {
          console.log('[safeGoto] -> Ошибка reload():', reloadErr.message);
        }
      } else {
        throw new Error(
          `[safeGoto] -> Все попытки исчерпаны: ${err.message}`,
        );
      }
    }
    attempt++;
  }
}

/* ----------------------------------------------------------- safeWaitForLoad */

/**
 * safeWaitForLoad(page, extraWait = 0)
 * ---------------------------------------------------------------------------
 * - Проверяет готовность DOM: document.readyState === 'complete'.
 * - Если за 8 с состояние 'complete' не достигнуто, вызывает window.stop()
 *   и ждёт ещё до 5 с, затем продолжает.
 * - Без «рандомных» пауз: ждём строго необходимое.
 */
async function safeWaitForLoad(page, extraWait = 0) {
  const start = Date.now();
  console.log('[safeWaitForLoad] -> Ожидаем готовности страницы…');

  const waitComplete = (t) =>
    page.waitForFunction(() => document.readyState === 'complete', { timeout: t });

  let isComplete = false;
  try {
    await waitComplete(8000); // быстрое ожидание
    isComplete = true;
  } catch {
    console.log(
      '[safeWaitForLoad] -> >8 с без complete, останавливаем загрузку (window.stop())',
    );
    try {
      await page.evaluate(() => window.stop());
    } catch {/* ignore */}
    try {
      await waitComplete(5000); // даём шанс стать complete после stop()
      isComplete = true;
    } catch {/* продолжаем даже без complete */}
  }

  const loadTime = Date.now() - start;
  console.log(
    `[safeWaitForLoad] -> ${
      isComplete ? 'Страница готова' : 'Переходим без complete'
    }. Время: ${loadTime} мс`,
  );

  if (extraWait) await sleep(extraWait);
}

module.exports = {
  safeGoto,
  safeWaitForLoad,
  sleep,
};
