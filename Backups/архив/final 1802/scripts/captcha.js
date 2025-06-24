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

    // Ищем элемент #px-captcha, если нет — считаем капча пройдена
    const rect = await page.evaluate(() => {
      const captchaElement = document.querySelector('#px-captcha');
      if (!captchaElement) return null;

      const { x, y, width, height } = captchaElement.getBoundingClientRect();
      const isHidden = window.getComputedStyle(captchaElement).display === 'none';
      return { x, y, width, height, isHidden };
    });

    if (!rect) {
      console.log('Элемент #px-captcha не найден, возможно, капча уже пройдена.');
      return true;
    }

    // ---- ДОБАВЛЕНА ПРОВЕРКА на слишком маленькую капчу ----
    // Если элемент существует, но имеет очень маленькие размеры,
    // считаем, что это "фейк" или уже решённая капча.
    if (rect.width < 5 || rect.height < 5) {
      console.log(`[captcha.js] #px-captcha найден, но имеет крайне малый размер (${rect.width}x${rect.height}). Пропускаем...`);
      return true;
    }
    // --------------------------------------

    if (rect.isHidden) {
      console.log('Капча есть в DOM, но display:none => считаем решённой.');
      return true;
    }

    // Перед нажатием - имитируем небольшие движения мышью
    await humanMouseMovements(page, 2000);

    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    const offsetXStart = (Math.random() * 4 - 2) / 100 * rect.width;
    const offsetYStart = (Math.random() * 2 - 1) / 100 * rect.height;

    const startX = centerX + offsetXStart;
    const startY = centerY + offsetYStart;

    console.log(`Наведение мыши на: (${startX.toFixed(2)}, ${startY.toFixed(2)})`);

    await page.mouse.move(startX, startY, { steps: 10 });
    await page.mouse.down();

    // Удерживаем 9-13 секунд
    const holdTime = Math.random() * 4000 + 9000;
    await sleep(holdTime);

    await page.mouse.up();
    console.log('Удержание мыши завершено');
    await sleep(3000);

    // Проверяем, осталась ли капча
    const stillThere = await page.evaluate(() => {
      const el = document.querySelector('#px-captcha');
      if (!el) return false; // пропала из DOM => решена
      return window.getComputedStyle(el).display !== 'none';
    });

    if (!stillThere) {
      console.log('Капча успешно пройдена');
      return true;
    }
    console.log('Капча ещё видна, повторяем удержание...');
  }

  console.log('Не удалось пройти Press & HOLD капчу после 15 попыток');
  return false;
}

/**
 * Дополнительная «точечная» проверка капчи
 * Расширена, чтобы учитывать «новый поп-ап» (modal-content-wrap / perimeterx-modal).
 */
async function checkAndSolveCaptchaInPlace(page, ws, timeout = 5000) {
  try {
    // Сначала проверяем «новый поп-ап»:
    const newPopup = await page.evaluate(() => {
      // Ищем .modal-content-wrap.modal-content-desktop-wrap или .perimeterx-modal
      const pop = document.querySelector('.modal-content-wrap.modal-content-desktop-wrap')
        || document.querySelector('.perimeterx-modal');
      if (!pop) return false;
      // Проверяем, есть ли внутри #px-captcha
      const px = pop.querySelector('#px-captcha');
      if (!px) return false;
      // Проверим, не скрыт ли он
      if (window.getComputedStyle(px).display === 'none') return false;
      return true;
    });

    if (newPopup) {
      console.log('[captcha.js] -> Найдена «новая» капча (modal-content-wrap/perimeterx-modal). Решаем...');
      if (ws) {
        ws.send(JSON.stringify({
          status: 'in-progress',
          message: 'Обнаружен новый pop-up капчи, решаем Press & Hold...'
        }));
      }
      const ok = await solvePressAndHoldCaptcha(page);
      if (ok) {
        if (ws) {
          ws.send(JSON.stringify({
            status: 'success',
            message: 'Новая pop-up капча успешно решена'
          }));
        }
      } else {
        if (ws) {
          ws.send(JSON.stringify({
            status: 'error',
            message: 'Не удалось решить новую pop-up капчу'
          }));
        }
      }
      return;
    }

    // Если «новый» не обнаружен, проверяем «старый» вариант (#px-captcha) — ждём появления
    await page.waitForSelector('#px-captcha', { timeout });
    // Раз капча появилась, пробуем решить
    if (ws) {
      ws.send(JSON.stringify({
        status: 'in-progress',
        message: 'Обнаружена классическая капча (Press & Hold), решаем...'
      }));
    }
    const solved = await solvePressAndHoldCaptcha(page);
    if (solved) {
      if (ws) {
        ws.send(JSON.stringify({
          status: 'success',
          message: 'Классическая капча успешно решена'
        }));
      }
    } else {
      if (ws) {
        ws.send(JSON.stringify({
          status: 'error',
          message: 'Не удалось решить классическую капчу'
        }));
      }
    }

  } catch (err) {
    // Если не нашли селектор за указанный timeout => капча, скорее всего, не появилась
    if (err.name === 'TimeoutError') {
      return; // Нет капчи => всё ок
    }
    console.log('[checkAndSolveCaptchaInPlace] Ошибка при проверке капчи:', err);
  }
}

module.exports = {
  solvePressAndHoldCaptcha,
  checkAndSolveCaptchaInPlace
};
