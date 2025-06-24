// scripts/actions/cartTutorial.js
/**
 * closeTutorialIfPresent(page):
 * -----------------------------------------
 *  - Проверяет, показывает ли iHerb «туториал» (react-joyride) на странице корзины.
 *  - Если да, по очереди нажимает:
 *     1) "Продолжить"
 *     2) "Продолжить"
 *     3) "Закрыть"
 *  - Если нет — выходит быстро.
 *  
 * Использует селекторы data-test-id="button-primary" (кнопка "Продолжить"/"Закрыть")
 * и data-test-id="overlay" (оверлей).
 *
 * Обратите внимание, что при локализации текста кнопок 
 * могут быть "Продолжить", "Закрыть" или другие переводы. 
 * Селектор data-action="primary" 
 * также может подойти. При необходимости обновите под текущий UI.
 */

const { sleep } = require('../../utils');

async function closeTutorialIfPresent(page) {
    console.log('[cartTutorial] -> Проверяем, не запущен ли туториал...');
  
    // 1) Проверяем наличие оверлея (react-joyride__overlay)
    // Может быть data-test-id="overlay" или класс "react-joyride__overlay".
    // Если его нет, значит туториал не показывается — выходим.
    const overlaySelector = '.react-joyride__overlay, [data-test-id="overlay"]';
  
    // Попробуем найти оверлей за 2 секунды (2000 мс). Если нет — значит туториала нет.
    const overlayHandle = await page.waitForSelector(overlaySelector, { 
      timeout: 2000, 
      visible: true 
    }).catch(() => null);
  
    if (!overlayHandle) {
      console.log('[cartTutorial] -> Туториал (overlay) не найден, продолжаем без закрытия.');
      return;
    }
    console.log('[cartTutorial] -> Обнаружен overlay (react-joyride), закрываем туториал...');
  
    // Небольшая вспомогательная функция: клик по кнопке "Продолжить" или "Закрыть"
     async function clickPrimaryButton(stepName) {
      // Пробуем нажать «Продолжить» или «Закрыть»
      const btnSelector = '[data-test-id="button-primary"], [data-action="primary"]';
      const closeSelector = 'button[aria-label="Закрыть"], button[title="Закрыть"]';

      try {
        // Ждём любую подходящую кнопку (до 3 с)
        await page.waitForSelector(`${btnSelector}, ${closeSelector}`, {
          timeout: 3000,
          visible: true
        });

        // Нажимаем первую видимую кнопку
        const clicked = await page.$$eval(
          `${btnSelector}, ${closeSelector}`,
          els => {
            const target = els.find(el => el.offsetParent !== null);
            if (target) { target.click(); return true; }
            return false;
          }
        );

        if (clicked) {
          console.log(`[cartTutorial] -> Шаг "${stepName}": кнопка нажата`);
          await sleep(800);
          return true;
        }
      } catch (_) {
        /* игнор – перейдём к принудительному удалению оверлея */
      }

      console.log(`[cartTutorial] -> Шаг "${stepName}": кнопку не нашли`);
      return false;
    }

  
    // 2) Нажимаем "Продолжить" в первом блоке
    await clickPrimaryButton('Продолжить (шаг 1)');
  
    // 3) Нажимаем "Продолжить" во втором блоке
    await clickPrimaryButton('Продолжить (шаг 2)');
  
    // 4) Нажимаем "Закрыть" в третьем (последнем) блоке
    //    (на самом деле это тоже data-test-id="button-primary", 
    //     но текст может быть "Закрыть")
    await clickPrimaryButton('Закрыть (шаг 3)');
  
    // 5) После нажатия "Закрыть" туториал обычно пропадает, но подождём чуть-чуть
    // 5) Проверяем, ушёл ли оверлей. Если нет – убираем вручную
    await sleep(1000);

    const stillVisible = await page.$(overlaySelector);
    if (stillVisible) {
      console.log('[cartTutorial] -> Оверлей не исчез, удаляем вручную...');
      await page.evaluate(() => {
        document
          .querySelectorAll('.react-joyride__overlay,[data-test-id="overlay"],.__floater')
          .forEach(n => n.remove());
      });
    }

    console.log('[cartTutorial] -> Туториал закрыт (или принудительно удалён).');

}
  
module.exports = { closeTutorialIfPresent };
