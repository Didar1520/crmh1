// scripts/actions/utils/pageLoadHelper.js

const defaultWaitTime = 60000; // 60 секунд таймаут

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * safeGoto(page, url, options = {}, ws = null)
 * -----------------------------------------------------------------------------
 * - Переходит по адресу url, дожидается networkidle2, логирует и ловит ошибку.
 * - Параметры: waitUntil, timeout, referer, extraWait.
 */
async function safeGoto(page, url, options = {}, ws = null) {
  const {
    waitUntil = 'networkidle2',
    timeout = defaultWaitTime,
    referer = 'https://google.com',
    extraWait = 2000
  } = options;

  const gotoStart = Date.now();
  console.log(`[safeGoto] -> Начинаем переход на: ${url}`);

  try {
    await page.goto(url, {
      waitUntil,
      timeout,
      referer
    });
    console.log(`[safeGoto] -> Успешно перешли на: ${url}`);
    console.log(`[safeGoto] -> Время загрузки: ${Date.now() - gotoStart} мс`);
    await sleep(extraWait);
  } catch (errGoto) {
    console.log(`[safeGoto] -> Ошибка при переходе на "${url}":`, errGoto);
    console.log(`[safeGoto] -> Время до ошибки: ${Date.now() - gotoStart} мс`);
    throw errGoto;
  }
}

/**
 * safeWaitForLoad(page, extraWait = 2000)
 * -----------------------------------------------------------------------------
 * - Ждёт, пока документ полностью загрузится (document.readyState === 'complete'),
 *   затем выдерживает паузу extraWait мс.
 *
 * Эта реализация не полагается на waitForNavigation, а использует
 * document.readyState, что позволяет определить момент завершения загрузки,
 * когда индикатор обновления меняется.
 */
async function safeWaitForLoad(page, extraWait = 2000) {
  const start = Date.now();
  console.log('[safeWaitForLoad] -> Ожидаем полной загрузки страницы (document.readyState === "complete")...');
  try {
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: defaultWaitTime });
    console.log(`[safeWaitForLoad] -> Документ загружен (readyState === "complete"). Время: ${Date.now() - start} мс`);
    await sleep(extraWait);
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
