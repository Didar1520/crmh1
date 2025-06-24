// scripts/captcha.js

/**
 * Логика решения капчи Press & Hold.
 * Исправлено:
 *  - Импорт sleep из pageLoadHelper.js
 *  - Импорт humanMouseMovements из utils.js
 *  - Перехват "Execution context was destroyed" с повтором
 */

const { humanMouseMovements } = require('./utils.js');
// Предполагаем, что utils.js экспортирует { humanMouseMovements }
// Если у вас другой файл — поправьте путь.

const {
  sleep
} = require('./actions/utils/pageLoadHelper.js');
// Берём sleep из pageLoadHelper

async function waitForCaptchaToVanish(page, maxWait = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxWait) {
    // Тут может быть риск "Execution context was destroyed" при резком редиректе
    try {
      const stillThere = await page.evaluate(() => {
        const el = document.querySelector('#px-captcha');
        if (!el) return false;
        return window.getComputedStyle(el).display !== 'none';
      });
      if (!stillThere) return true;
    } catch (errEval) {
      if (errEval.message.includes('Execution context was destroyed')) {
        console.log('[captcha.js] -> Навигация во время waitForCaptchaToVanish, повторим...');
        return false; // Посчитаем, что капча уже исчезла или всё перепрыгнуло
      }
      throw errEval;
    }
    await sleep(500);
  }
  return false;
}

/**
 * После отпускания мыши — проверяем 1-2 сек, до 5 сек, не решилась ли капча
 * или "Please try again".
 */
async function waitPostHoldStatus(page, checksDuration = 5000) {
  const start = Date.now();
  while (Date.now() - start < checksDuration) {
    try {
      const result = await page.evaluate(() => {
        const errEl = document.querySelector('#nZwcQQNjfLcGenf'); // "Please try again"
        const doneEl = document.querySelector('#McDTrZNqmXRCVTQ'); // "Human Challenge completed..."
        const px = document.querySelector('#px-captcha');

        const errVisible = errEl && errEl.style.display !== 'none';
        const doneVisible = doneEl && doneEl.style.display !== 'none';
        let captchaStillThere = false;

        if (px) {
          const st = window.getComputedStyle(px);
          if (st.display !== 'none') {
            captchaStillThere = true;
          }
        }

        return { err: errVisible, done: doneVisible, still: captchaStillThere };
      });

      if (result.err) {
        console.log('[captcha.js] -> "Please try again" => неудачно.');
        return false;
      }
      if (!result.still) {
        console.log('[captcha.js] -> Капча пропала => успех.');
        return true;
      }
      if (result.done) {
        console.log('[captcha.js] -> "Human Challenge completed...", ждём исчезновения...');
        const vanishOk = await waitForCaptchaToVanish(page, 10000);
        if (vanishOk) {
          console.log('[captcha.js] -> Капча исчезла => успех.');
          return true;
        } else {
          console.log('[captcha.js] -> Не исчезла за 10 сек, пробуем ещё...');
        }
      }

      await sleep(1000 + Math.random() * 1000);
    } catch (errEval) {
      // Если во время evaluate произошла навигация
      if (errEval.message.includes('Execution context was destroyed')) {
        console.log('[captcha.js] -> Навигация при postHoldStatus, повторим...');
        return false; // Считаем неудачей текущей попытки
      }
      throw errEval;
    }
  }
  console.log('[captcha.js] -> 5 сек прошли, считаем капчу не решённой.');
  return false;
}

/**
 * solvePressAndHoldCaptcha(page)
 *  - До 4 попыток подряд
 *  - Если нет успеха, перезагрузить страницу (до 3 раз)
 */
async function solvePressAndHoldCaptcha(page) {
  let reloadCount = 0;

  // Функция, которая делает 4 попытки подряд
  async function solveOneCycle() {
    let attemptCount = 0;
    while (attemptCount < 4) {
      attemptCount++;
      console.log(`[captcha.js] -> Попытка #${attemptCount} Press&Hold...`);

      // Проверяем есть ли капча
      let cRect;
      try {
        cRect = await page.evaluate(() => {
          const el = document.querySelector('#px-captcha');
          if (!el) return null;
          const st = window.getComputedStyle(el);
          if (st.display === 'none') return null;
          const rect = el.getBoundingClientRect();
          if (rect.width < 5 || rect.height < 5) return null;
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });
      } catch (errEval) {
        if (errEval.message.includes('Execution context was destroyed')) {
          console.log('[captcha.js] -> Навигация при getCaptchaRect, повторим...');
          return false; // перескочим к след. попытке
        }
        throw errEval;
      }

      if (!cRect) {
        console.log('[captcha.js] -> Капча отсутствует/скрыта => успех.');
        return true;
      }

      // Движения мыши
      await humanMouseMovements(page, 1500);

      // Считаем координаты
      const centerX = cRect.x + cRect.width / 2;
      const centerY = cRect.y + cRect.height / 2;
      const offsetX = (Math.random() * 4 - 2) / 100 * cRect.width;
      const offsetY = (Math.random() * 2 - 1) / 100 * cRect.height;
      const startX = centerX + offsetX;
      const startY = centerY + offsetY;

      console.log(`[captcha.js] -> Наводим мышь на (${startX.toFixed(2)}, ${startY.toFixed(2)})`);
      await page.mouse.move(startX, startY, { steps: 10 });
      await page.mouse.down();

      // Удерживаем 9-13 сек
      const holdTime = 9000 + Math.random() * 4000; 
      await sleep(holdTime);
      await page.mouse.up();
      console.log('[captcha.js] -> Отпустили мышь, ждём итог.');

      // Проверка
      const postOk = await waitPostHoldStatus(page, 5000);
      if (postOk) return true;

      console.log('[captcha.js] -> Эта попытка не удалась. Продолжаем...');
    }
    return false;
  }

  // Главный цикл: до 3 перезагрузок
  while (reloadCount < 3) {
    const success = await solveOneCycle();
    if (success) return true;

    console.log(`[captcha.js] -> Капча не решена, перезагружаем (#${reloadCount + 1})...`);
    reloadCount++;
    try {
      await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(4000);
    } catch (errReload) {
      console.log('[captcha.js] -> Ошибка reload:', errReload);
    }
  }

  console.log('[captcha.js] -> Не удалось пройти капчу после 3 перезагрузок!');
  return false;
}

/**
 * checkAndSolveCaptchaInPlace(page, ws, timeout)
 * ----------------------------------------------------------------------------
 * 1) Ищет «новую» капчу, если нет — классическую #px-captcha
 * 2) Вызывает solvePressAndHoldCaptcha
 */
async function checkAndSolveCaptchaInPlace(page, ws, timeout = 5000) {
  try {
    // "Новая" pop-up
    const newPopup = await page.evaluate(() => {
      const pop = document.querySelector('.modal-content-wrap.modal-content-desktop-wrap')
        || document.querySelector('.perimeterx-modal');
      if (!pop) return false;
      const px = pop.querySelector('#px-captcha');
      if (!px) return false;
      const st = window.getComputedStyle(px);
      return st.display !== 'none' && px.getBoundingClientRect().width > 5 && px.getBoundingClientRect().height > 5;
    });

    if (newPopup) {
      console.log('[captcha.js] -> Найдена новая pop-up капча, решаем...');
      if (ws) {
        ws.send(JSON.stringify({
          status: 'in-progress',
          message: 'New pop-up captcha found, pressing & holding...'
        }));
      }
      const ok = await solvePressAndHoldCaptcha(page);
      if (ok && ws) {
        ws.send(JSON.stringify({ status: 'success', message: 'New pop-up captcha solved!' }));
      } else if (!ok && ws) {
        ws.send(JSON.stringify({ status: 'error', message: 'Failed to solve new pop-up captcha' }));
      }
      return;
    }

    // "Старая" капча #px-captcha
    await page.waitForSelector('#px-captcha', { timeout });
    if (ws) {
      ws.send(JSON.stringify({
        status: 'in-progress',
        message: 'Classic Press & Hold captcha found, solving...'
      }));
    }
    const solved = await solvePressAndHoldCaptcha(page);
    if (solved && ws) {
      ws.send(JSON.stringify({ status: 'success', message: 'Classic Press & Hold captcha solved!' }));
    } else if (!solved && ws) {
      ws.send(JSON.stringify({ status: 'error', message: 'Failed to solve classic Press & Hold captcha' }));
    }

  } catch (err) {
    if (err.name === 'TimeoutError') {
      // не нашли #px-captcha => капчи нет
      return;
    }
    console.log('[checkAndSolveCaptchaInPlace] -> Ошибка при проверке капчи:', err);
  }
}

module.exports = {
  solvePressAndHoldCaptcha,
  checkAndSolveCaptchaInPlace
};
