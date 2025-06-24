// scripts/captcha.js

const { humanMouseMovements, sleep } = require('./utils');

/** 
 * СТАРЫЙ РАБОЧИЙ КОД НЕ ТРОГАЕМ 
 */
async function solvePressAndHoldCaptcha(page) {
  let attemptCount = 0;

  while (attemptCount < 15) {
    attemptCount += 1;
    console.log(`Попытка ${attemptCount}: Была обнаружена капча Press & HOLD`);

    const rect = await page.evaluate(() => {
      const captchaElement = document.querySelector('#px-captcha');
      if (!captchaElement) return null;
      const { x, y, width, height } = captchaElement.getBoundingClientRect();
      return { x, y, width, height };
    });

    if (!rect) {
      console.log('Элемент #px-captcha не найден, возможно, капча пройдена.');
      return true;
    }

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

    console.log(`Наведение мыши на координаты: (${startX.toFixed(2)}, ${startY.toFixed(2)})`);

    await page.mouse.move(startX, startY, { steps: 10 });
    await page.mouse.down();

    // Удерживаем 9-13 секунд
    const holdTime = Math.random() * 4000 + 9000;
    await sleep(holdTime);

    await page.mouse.up();
    console.log('Удержание мыши завершено');
    await sleep(3000);

    const captchaStillPresent = await page.evaluate(() => !!document.querySelector('#px-captcha'));
    if (!captchaStillPresent) {
      console.log('Капча успешно пройдена');
      return true;
    }

    console.log('Капча всё ещё присутствует, повторяем нажатие...');
  }

  console.log('Не удалось пройти капчу после нескольких попыток');
  return false;
}

/**
 * Дополнительная «точечная» функция,
 * если хотите быстро проверить наличие #px-captcha после page.goto(...)
 */
async function checkAndSolveCaptchaInPlace(page, ws, timeout = 5000) {
  try {
    // Ждём появления #px-captcha, если не появится за timeout — ловим TimeoutError
    await page.waitForSelector('#px-captcha', { timeout });
    if (ws) {
      ws.send(JSON.stringify({
        status: 'in-progress',
        message: 'Обнаружена капча, начинаем её решать...'
      }));
    }
    const solved = await solvePressAndHoldCaptcha(page);
    if (solved) {
      if (ws) {
        ws.send(JSON.stringify({
          status: 'success',
          message: 'Капча успешно решена'
        }));
      }
    } else {
      if (ws) {
        ws.send(JSON.stringify({
          status: 'error',
          message: 'Не удалось решить капчу (Try again)'
        }));
      }
    }
  } catch (err) {
    // Если это TimeoutError => капча не появилась — значит, всё норм
    if (err.name === 'TimeoutError') {
      // Капча не появилась, ничего страшного
      return;
    }
    // Иные ошибки
    console.log('[checkAndSolveCaptchaInPlace] Ошибка при проверке капчи:', err);
  }
}

module.exports = {
  solvePressAndHoldCaptcha,
  checkAndSolveCaptchaInPlace
};
