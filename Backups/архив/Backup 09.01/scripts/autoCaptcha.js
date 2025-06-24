// scripts/autoCaptcha.js
const { handleCaptcha } = require('./captcha');

/**
 * Подключаем "глобальный" обработчик, который будет
 * слушать событие framenavigated у страницы и проверять:
 *  - Есть ли элемент #px-captcha
 *  - Если есть — вызываем решение капчи handleCaptcha
 *
 * При необходимости можно слушать другие события:
 *  - 'domcontentloaded'
 *  - 'load'
 *  - и т.д.
 *
 * Также можно дописать любую логику защиты от повторных срабатываний,
 * чтобы не решать капчу одновременно в нескольких навигациях.
 */
function attachGlobalCaptchaSolver(page, ws) {
  let isSolvingCaptcha = false; // чтобы не ловить несколько капч одновременно

  page.on('framenavigated', async (frame) => {
    try {
      // Если уже в процессе решения капчи — пропускаем
      if (isSolvingCaptcha) return;

      // Ищем элемент #px-captcha
      const captchaHandle = await frame.$('#px-captcha');
      if (captchaHandle) {
        isSolvingCaptcha = true;
        console.log('[autoCaptcha] Обнаружен #px-captcha, решаем...');

        // Пытаемся решить капчу
        const solved = await handleCaptcha(page, ws);
        if (!solved) {
          console.log('[autoCaptcha] Не удалось решить капчу.');
        } else {
          console.log('[autoCaptcha] Капча успешно решена.');
        }

        isSolvingCaptcha = false;
      }
    } catch (err) {
      console.log('[autoCaptcha] Ошибка при проверке капчи:', err);
    }
  });
}

module.exports = {
  attachGlobalCaptchaSolver
};
