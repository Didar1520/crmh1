// scripts/captcha.js
/**
 * КЛЮЧЕВОЙ МОДУЛЬ: РЕШЕНИЕ КАПЧИ "PRESS & HOLD"
 * ----------------------------------------------------------------
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * ВНИМАНИЕ: НЕ МЕНЯТЬ СТРОКИ, СИМВОЛЫ И ЛОГИКУ ВНУТРИ
 * solvePressAndHoldCaptcha БЕЗ ЯВНОГО СОГЛАСИЯ! 
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * 
 * + ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ checkAndSolveCaptchaInPlace(...)
 * чтобы вызывать капчу на любой странице:
 *   - page.waitForSelector('#px-captcha') c таймаутом
 *   - если капча есть — solvePressAndHoldCaptcha
 */

const { humanMouseMovements, sleep } = require('./utils');

/**
 * Функция полностью из "старого" рабочего кода:
 */
async function solvePressAndHoldCaptcha(page) {
  let attemptCount = 0;

  while (attemptCount < 15) {
    attemptCount += 1;
    console.log(`[captcha.js] -> Попытка ${attemptCount}: Капча Press & HOLD`);

    const rect = await page.evaluate(() => {
      const captchaElement = document.querySelector('#px-captcha');
      if (!captchaElement) return null;
      const { x, y, width, height } = captchaElement.getBoundingClientRect();
      return { x, y, width, height };
    });

    if (!rect) {
      console.log('[captcha.js] -> #px-captcha не найден, возможно капча пройдена.');
      return true;
    }

    // Движения мыши
    await humanMouseMovements(page, 2000);

    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    const offsetXStart = (Math.random() * 4 - 2) / 100 * rect.width;
    const offsetYStart = (Math.random() * 2 - 1) / 100 * rect.height;
    const offsetXEnd = (Math.random() * 4 - 2) / 100 * rect.width;
    const offsetYEnd = (Math.random() * 2 - 1) / 100 * rect.height;

    const startX = centerX + offsetXStart;
    const startY = centerY + offsetYStart;
    const endX = centerX + offsetXEnd;
    const endY = centerY + offsetYEnd;

    console.log(`[captcha.js] -> Наводим мышь на: (${startX.toFixed(2)}, ${startY.toFixed(2)})`);
    await page.mouse.move(startX, startY, { steps: 10 });
    await page.mouse.down();

    // Удерживаем 9-13 секунд
    const holdTime = Math.random() * 4000 + 9000;
    console.log(`[captcha.js] -> Удерживаем мышь: ~${Math.round(holdTime / 1000)} сек`);
    await sleep(holdTime);

    await page.mouse.up();
    console.log('[captcha.js] -> Отпустили мышь, проверяем результат...');
    await sleep(3000);

    const captchaStillPresent = await page.evaluate(
      () => !!document.querySelector('#px-captcha')
    );
    if (!captchaStillPresent) {
      console.log('[captcha.js] -> Капча успешно пройдена!');
      return true;
    }

    console.log('[captcha.js] -> Капча всё ещё есть, повторяем...');
  }

  console.log('[captcha.js] -> Не удалось пройти капчу после нескольких попыток');
  return false;
}

/**
 * Дополнительная "точечная" функция:
 *  - Проверяем наличие #px-captcha
 *  - Если появляется — решаем solvePressAndHoldCaptcha
 *  - Если нет — просто логируем, что капча не появилась
 */
async function checkAndSolveCaptchaInPlace(page, ws, timeout = 10000) {
  console.log(`[captcha.js] -> checkAndSolveCaptchaInPlace(): ждём #px-captcha (timeout=${timeout}ms)`);
  try {
    await page.waitForSelector('#px-captcha', { timeout });
    // Капча появилась
    console.log('[captcha.js] -> Капча найдена (checkAndSolveCaptchaInPlace), решаем...');
    // Для наглядности можно что-то отправить в ws
    if (ws) {
      ws.send(JSON.stringify({
        status: 'in-progress',
        message: '[captcha.js] -> Капча найдена, решаем...'
      }));
    }
    await solvePressAndHoldCaptcha(page);
  } catch (err) {
    console.log(`[captcha.js] -> Капча НЕ появилась (или ошибка): ${err}`);
    // Обычно это TimeoutError: 10с прошло, капча не вышла
  }
}

module.exports = {
  solvePressAndHoldCaptcha,
  checkAndSolveCaptchaInPlace
};
