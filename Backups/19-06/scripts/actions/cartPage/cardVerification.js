// D:\Didar1520\CRM\scripts\actions\cartPage\cardVerification.js
// -----------------------------------------------------------------------------
// Улучшенная версия функции проверки повторного ввода номера карты.
//  • Надёжно определяет, действительно ли показано требование повторного ввода:
//      – предупреждение panel‑error ДОЛЖНО быть видимым;
//      – должен появиться iframe с классом .js-iframe или инпут adyen‑verify‑cc.
//  • Исключены "ложные срабатывания" при свёрнутой секции или скрытом сообщении.
//  • Все ошибки ловятся и логируются, поток не прерывается.
//  • При невозможности ввести карту (нет iframe / нет карты в списке) сценарий
//    продолжает работу: нажимаем «Продолжить» и выходим, чтобы не крашить задачу.
//  • Таймауты вынесены в константы.

const { cards } = require('./cads.js');

// -----------------------------------------------------------------------------
// Константы таймаутов и задержек
// -----------------------------------------------------------------------------
const DELAY_AFTER_START      = 500;   // мс, пауза перед проверкой
const TIMEOUT_SHORT_VISIBLE  = 3000;  // мс, ожидание видимости элементов
const TIMEOUT_IFRAME_VISIBLE = 10000; // мс, ожидание iframe для ввода
const FIELD_TYPE_DELAY       = 100;   // мс, задержка между символами при вводе

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Проверяет, действительно ли элемент видим на странице (не display:none, не
 *  visibility:hidden, имеет ненулевые размеры).
 *  @param {ElementHandle|null} handle
 *  @returns {Promise<boolean>}
 */
async function isElementVisible (handle) {
  if (!handle) return false;
  try {
    return await handle.evaluate(el => {
      const style = window.getComputedStyle(el);
      const rect  = el.getBoundingClientRect();
      return style && style.display !== 'none' && style.visibility !== 'hidden' &&
             rect.width > 0 && rect.height > 0;
    });
  } catch (_) {
    return false; // если контекст уничтожен – считаем, что не видим
  }
}

// Если cards содержит одну строку со списком карт, разделяем её на массив
let cardList = cards;
if (cards.length === 1 && cards[0].includes(',')) {
  cardList = cards[0].split(',').map(c => c.trim());
}

async function cardVerification (page) {
  console.log('[cardVerification] -> Начало проверки номера карты.');

  // Небольшая пауза после предыдущих действий
  await sleep(DELAY_AFTER_START);

  // 1) Проверяем наличие и видимость panel-error
  let needReenter = false;
  try {
    const warningHandle = await page.$('[data-testid="panel-error"]');
    needReenter = await isElementVisible(warningHandle);
  } catch (err) {
    console.log('[cardVerification] -> Ошибка при проверке panel-error:', err.message);
  }

  // 2) Если предупреждение потенциально есть – убеждаемся, что действительно нужен ввод
  if (needReenter) {
    // Проверяем, появился ли iframe для ввода или контейнер #adyen-verify-cc
    const hasIframeOrField = await Promise.race([
      page.waitForSelector('.js-iframe, #adyen-verify-cc', { visible: true, timeout: TIMEOUT_SHORT_VISIBLE })
          .then(() => true)
          .catch(() => false),
    ]);

    if (!hasIframeOrField) {
      console.log('[cardVerification] -> panel-error обнаружен, но полей ввода нет – пропускаем повторный ввод.');
      needReenter = false;
    }
  }

  if (!needReenter) {
    console.log('[cardVerification] -> Повторный ввод карты не требуется, продолжаем.');
    console.log('[cardVerification] -> Завершение проверки номера карты.');
    return; // выходим без изменений
  }

  // ---------------------------------------------------------------------------
  // Ниже логика, когда действительно требуется ввести карту заново
  // ---------------------------------------------------------------------------
  console.log('[cardVerification] -> Обнаружено требование повторного ввода карты.');

  // Извлекаем последние 4 цифры показанной карты
  let displayedLast4 = null;
  try {
    const cardInfoText = await page.$eval(
      'div.CreditCardPayment__CardDigitsExpiry-sc-lcaa6f-2',
      el => el.textContent || ''
    );
    const match = cardInfoText.match(/(\d{4})/);
    if (match) {
      displayedLast4 = match[1];
      console.log(`[cardVerification] -> Извлечены последние 4 цифры: ${displayedLast4}`);
    }
  } catch (err) {
    console.log('[cardVerification] -> Не удалось извлечь последние 4 цифры карты:', err.message);
  }

  // Пытаемся найти полную карту в локальном списке
  let selectedCard = null;
  if (displayedLast4) {
    for (const raw of cardList) {
      const clean = raw.replace(/\s+/g, '');
      if (clean.slice(-4) === displayedLast4) {
        selectedCard = clean;
        break;
      }
    }
  }

  if (!selectedCard) {
    console.log('[cardVerification] -> Карта не найдена в списке, ожидаем ручной ввод…');
    await page.waitForSelector('button#credit-card-continue-button', { visible: true, timeout: 0 });
  } else {
    // Вводим найденную карту во фрейм
    console.log(`[cardVerification] -> Вводим карту ${selectedCard}`);
    try {
      const frameHandle = await page.waitForSelector('.js-iframe', { visible: true, timeout: TIMEOUT_IFRAME_VISIBLE });
      const frame       = await frameHandle.contentFrame();
      if (frame) {
        await frame.waitForSelector('#encryptedCardNumber', { visible: true, timeout: TIMEOUT_IFRAME_VISIBLE });
        await frame.click('#encryptedCardNumber', { clickCount: 3 });
        await frame.$eval('#encryptedCardNumber', el => (el.value = ''));
        await frame.type('#encryptedCardNumber', selectedCard, { delay: FIELD_TYPE_DELAY });
        console.log('[cardVerification] -> Номер карты введён внутри iframe.');
      } else {
        console.log('[cardVerification] -> Не удалось получить контекст iframe – пропускаем ввод.');
      }
    } catch (err) {
      console.log('[cardVerification] -> Ошибка при вводе номера карты:', err.message);
    }
  }

  // Нажимаем «Продолжить» – даже если карта не была введена, чтобы не блокировать поток
  try {
    await page.waitForSelector('button#credit-card-continue-button', { visible: true, timeout: TIMEOUT_SHORT_VISIBLE })
            .then(btn => btn.click())
            .catch(() => page.click('button#credit-card-continue-button'));
    console.log('[cardVerification] -> Нажата кнопка "Продолжить".');
  } catch (err) {
    console.log('[cardVerification] -> Не удалось нажать "Продолжить":', err.message);
  }

  // Ждём исчезновения спиннера или короткую паузу
  try {
    await page.waitForSelector('div.ConnectedLoading__SpinnerWrapper-sc-1245kmi-0', {
      hidden: true,
      timeout: 15000,
    });
  } catch (_) {
    await sleep(3000);
  }

  console.log('[cardVerification] -> Завершение проверки номера карты.');
}

module.exports = { cardVerification };
