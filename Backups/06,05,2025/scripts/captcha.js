/* File: scripts/captcha.js
 * -----------------------------------------------------------------------------
 * Решение капчи PerimeterX «Press & Hold» с учётом:
 *   • точных координат «овала» (без промахов по контейнеру)
 *   • проверки elementFromPoint перед нажатием
 *   • ловли красного сообщения «try again» в любых локалях
 *   • первых нажатий без рандома, далее — в «safe-зоне»
 *   • повторной попытки при ошибке или навигации
 */

const { humanMouseMovements } = require('./utils.js');
const { sleep } = require('./actions/utils/pageLoadHelper.js');

/* -------------------------------------------------------------------------- */
/*  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Возвращает безопасную точку для клика по «овалу» капчи.
 * Rect — геометрия контейнера #px-captcha.
 * attemptIdx = 0 ⇒ ровно центр; далее случайная точка в safe-зоне.
 */
function pickSafePoint(rect, attemptIdx) { // начало тела функции
  /* ── безопасный прямоугольник ──────────────────────────────
     • по X: центральные 80 % (от 10 % до 90 %)
     • по Y: только верхняя треть овала (20 – 40 %)
  ------------------------------------------------------------- */
  const safeMinX = rect.x + rect.width  * 0.35;   // было 10 %
  const safeMaxX = rect.x + rect.width  * 0.65;   // было 90 %
  const safeMinY = rect.y + rect.height * 0.20;
  const safeMaxY = rect.y + rect.height * 0.40;

  // первая попытка — ровно центр safe-зоны
  if (attemptIdx === 0) {
    return {
      x: (safeMinX + safeMaxX) / 2,
      y: (safeMinY + safeMaxY) / 2
    };
  }

  // остальные — случайная точка внутри safe-зоны
  return {
    x: safeMinX + Math.random() * (safeMaxX - safeMinX),
    y: safeMinY + Math.random() * (safeMaxY - safeMinY)
  };
} // конец тела функции

/**
 * Проверяем, попадает ли курсор в нужный элемент перед mouse.down().
 */
async function isPointOnCaptcha(page, x, y) {
  return await page.evaluate(
    (pt) => {
      const el = document.elementFromPoint(pt.x, pt.y);
      return el && el.id === 'px-captcha';
    },
    { x, y }
  );
}

/**
 * Проверяем статус после отпускания мыши (≤ 5 с):
 *   • появилось красное «try again»  → false
 *   • контейнер исчез               → true
 *   • истек timeout                 → false
 */
async function waitPostHoldStatus(page, checksDuration = 5000) {
  const start = Date.now();
  while (Date.now() - start < checksDuration) {
    try {
      const state = await page.evaluate(() => {
        const root = document.querySelector('#px-captcha');
        if (!root) {                // контейнер пропал → успех
          return { done: true, fail: false };
        }

        // ищем красный текст в пределах контейнера
        const err = [...root.querySelectorAll('div')]
          .find((n) => {
            const st = window.getComputedStyle(n);
            if (!st) return false;
            const color = st.color.replace(/\s+/g, '').toLowerCase();
            return (
              (color.includes('ce0e2d') || color.includes('rgb(206,14,45)')) &&
              st.display !== 'none'
            );
          });

        return { done: false, fail: !!err };
      });

      if (state.done) {
        console.log('[captcha.js] -> Капча пропала => успех.');
        return true;
      }
      if (state.fail) {
        console.log('[captcha.js] -> «Please try again» => неудачно.');
        return false;
      }

      await sleep(300);             // короткий интервал проверки
    } catch (errEval) {
      if (errEval.message.includes('Execution context was destroyed')) {
        console.log('[captcha.js] -> Навигация в waitPostHoldStatus, повторим...');
        return false;
      }
      throw errEval;
    }
  }
  console.log('[captcha.js] -> 5 сек прошли, считаем попытку неудачной.');
  return false;
}

/**
 * Ожидает скрытия контейнера ‘#px-captcha’ (≤ maxWait мс).
 */
async function waitForCaptchaToVanish(page, maxWait = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxWait) {
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
        return false;
      }
      throw errEval;
    }
    await sleep(500);
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*  ОСНОВНАЯ ЛОГИКА РЕШЕНИЯ КАПЧИ                                             */
/* -------------------------------------------------------------------------- */

/**
 * solvePressAndHoldCaptcha(page)
 *   • до 4 попыток клика подряд
 *   • до 3 перезагрузок страницы
 */
async function solvePressAndHoldCaptcha(page) {
  let reloadCount = 0;

  // одна серия из ≤ 4 нажатий
  async function solveOneCycle() {
    for (let attemptIdx = 0; attemptIdx < 4; attemptIdx++) {
      console.log(`[captcha.js] -> Попытка #${attemptIdx + 1} Press&Hold...`);

      // прокручиваем капчу в центр экрана
      await page.evaluate(() => {
        const el = document.querySelector('#px-captcha');
        if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      });

      // геометрия контейнера
      const rect = await page.evaluate(() => {
        const el = document.querySelector('#px-captcha');
        if (!el) return null;
        const st = window.getComputedStyle(el);
        if (st.display === 'none') return null;
        const r = el.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) return null;
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });

      if (!rect) {
        console.log('[captcha.js] -> Капча отсутствует/скрыта => успех.');
        return true;
      }

      // выбираем координату
      const point = pickSafePoint(rect, attemptIdx);
      console.log(
        `[captcha.js] -> Координаты клика (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`
      );

      // проверяем, что попадём точно в контейнер
      const onTarget = await isPointOnCaptcha(page, point.x, point.y);
      if (!onTarget) {
        console.log('[captcha.js] -> Point outside captcha, пробуем другую точку...');
        continue;                   // берём новую попытку без mouse-move
      }

      // «человеческие» движения
      await humanMouseMovements(page, 1500);
      await page.mouse.move(point.x, point.y, { steps: 10 });


      /* ── визуальная отметка точки клика ── */
await page.evaluate(({ x, y }) => {
  const dot = document.createElement('div');
  dot.style.cssText =
    `position:fixed;left:${x - 6}px;top:${y - 6}px;` +  // центрируем кружок
    'width:12px;height:12px;border-radius:50%;' +
    'background:#ff3c00;opacity:0.8;z-index:9999999;pointer-events:none;' +
    'box-shadow:0 0 6px 2px #ff3c00;';
  document.body.appendChild(dot);
  setTimeout(() => dot.remove(), 2000);                // исчезнет через 2 с
}, { x: point.x, y: point.y });
/* ── конец отметки ── */

      /* --- диагностика «дошёл ли mousedown?» --- */
      await page.evaluate(() => {
        const px = document.querySelector('#px-captcha');
        if (px && !px.__dbg) {
          px.__dbg = true;
          px.addEventListener('mousedown', () => {
            window.__pxHit = Date.now();
          });
        }
      });

      await page.mouse.down();

      const hit = await page
        .waitForFunction(() => window.__pxHit, { timeout: 800 })
        .catch(() => null);
      console.log('[captcha.js] -> mousedown received by element?', !!hit);
      const elementOk = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        // ok, если это сам контейнер или iframe внутри него
        return (
          (el && el.id === 'px-captcha') ||
          (el && el.tagName === 'IFRAME' && el.parentElement?.id === 'px-captcha')
        );
      }, { x: point.x, y: point.y });
      
      if (!elementOk) {
        console.log('[captcha.js] -> Точка вне овала, пробуем другую…');
        await page.mouse.up();
        continue;                                 // новый выбор координаты
      }

      // удерживаем 9–13 с
      const holdTime = 9000 + Math.random() * 4000;
      await sleep(holdTime);
      await page.mouse.up();
      console.log('[captcha.js] -> Отпустили мышь, ждём итог...');

      // проверяем статус
      const ok = await waitPostHoldStatus(page, 5000);
      if (ok) return true;

      console.log('[captcha.js] -> Эта попытка не удалась. Продолжаем...');
    }
    return false;
  }

  /* -- главный цикл: ≤ 3 перезагрузок -- */
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
 *   1) ищет pop-up-капчу (новый дизайн)
 *   2) иначе – классическую #px-captcha
 */
async function checkAndSolveCaptchaInPlace(page, ws, timeout = 5000) {
  try {
    // новая pop-up
    const newPopup = await page.evaluate(() => {
      const pop =
        document.querySelector('.modal-content-wrap.modal-content-desktop-wrap') ||
        document.querySelector('.perimeterx-modal');
      if (!pop) return false;
      const px = pop.querySelector('#px-captcha');
      if (!px) return false;
      const st = window.getComputedStyle(px);
      return st.display !== 'none' && px.getBoundingClientRect().width > 5;
    });

    if (newPopup) {
      console.log('[captcha.js] -> Найдена новая pop-up капча, решаем...');
      ws?.send(
        JSON.stringify({
          status: 'in-progress',
          message: 'New pop-up captcha found, pressing & holding...'
        })
      );
      const ok = await solvePressAndHoldCaptcha(page);
      ws?.send(
        JSON.stringify({
          status: ok ? 'success' : 'error',
          message: ok
            ? 'New pop-up captcha solved!'
            : 'Failed to solve new pop-up captcha'
        })
      );
      return;
    }

    /* классическая капча ---------------------------------------------------- */
    await page.waitForSelector('#px-captcha', { timeout });
    ws?.send(
      JSON.stringify({
        status: 'in-progress',
        message: 'Classic Press & Hold captcha found, solving...'
      })
    );

    const solved = await solvePressAndHoldCaptcha(page);
    ws?.send(
      JSON.stringify({
        status: solved ? 'success' : 'error',
        message: solved
          ? 'Classic Press & Hold captcha solved!'
          : 'Failed to solve classic Press & Hold captcha'
      })
    );
  } catch (err) {
    if (err.name !== 'TimeoutError') {
      console.log('[checkAndSolveCaptchaInPlace] -> Ошибка при проверке капчи:', err);
    }
  }
}

module.exports = {
  solvePressAndHoldCaptcha,
  checkAndSolveCaptchaInPlace
};
