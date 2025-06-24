// scripts/captcha.js

const { humanMouseMovements, sleep } = require('./utils');

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

module.exports = { solvePressAndHoldCaptcha };
