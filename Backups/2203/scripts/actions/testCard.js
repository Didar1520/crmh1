// cardVerification.js

const { cards } = require('./cads.js');
const { launchBrowserForAccount } = require('../browserManager.js');




function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Если cards содержит одну строку со списком карт, разделяем её на массив
let cardList = cards;
if (cards.length === 1 && cards[0].includes(',')) {
  cardList = cards[0].split(',').map(card => card.trim());
}

async function cardVerification(page) {
  console.log('[cardVerification] -> Начало проверки номера карты.');

  // Небольшая пауза для стабильности (после предыдущих шагов)
  await sleep(3000);

  // Проверяем, нужно ли повторно вводить номер карты
  const cardWarning = await page.$('[data-testid="panel-error"]');
  if (cardWarning) {
    console.log('[cardVerification] -> Обнаружено предупреждение о необходимости повторного ввода номера карты.');

    // Извлекаем последние 4 цифры карты из текстового блока
    let displayedLast4;
    try {
      const cardInfoText = await page.$eval(
        'div.CreditCardPayment__CardDigitsExpiry-sc-lcaa6f-2.gDLHRb',
        el => el.textContent
      );
      // Ищем последовательность из 4 цифр
      const match = cardInfoText.match(/(\d{4})/);
      if (match) {
        displayedLast4 = match[1];
        console.log(`[cardVerification] -> Извлечены последние 4 цифры: ${displayedLast4}`);
      } else {
        throw new Error('Не удалось извлечь последние 4 цифры.');
      }
    } catch (error) {
      throw new Error(`[cardVerification] -> Ошибка при извлечении цифр: ${error.message}`);
    }

    // Ищем карту в массиве cardList по последним 4 цифрам
    let selectedCard = null;
    for (const card of cardList) {
      const trimmedCard = card.replace(/\s+/g, '');
      if (trimmedCard.slice(-4) === displayedLast4) {
        selectedCard = trimmedCard;
        break;
      }
    }

    if (!selectedCard) {
      // Если карта не найдена, ждём, пока пользователь сам введёт номер
      console.log(`[cardVerification] -> Карта с последними 4 цифрами ${displayedLast4} не найдена в списке. Ожидается ручной ввод.`);

      // Здесь можно реализовать любую логику ожидания ручного ввода:
      // - Ждать нажатия кнопки "Продолжить"
      // - Ждать изменения значения в iframe
      // Ниже для примера просто ждём, пока пользователь нажмёт кнопку "Продолжить".
      await page.waitForSelector('button#credit-card-continue-button', { visible: true, timeout: 0 });
      console.log('[cardVerification] -> Предполагаем, что пользователь ввёл номер карты вручную.');
    } else {
      // Если карта найдена, вводим её внутри iframe
      console.log(`[cardVerification] -> Выбрана карта: ${selectedCard}`);
      try {
        // 1) Ждём появления элемента iframe
        const frameHandle = await page.waitForSelector('.js-iframe', { visible: true, timeout: 10000 });
        // 2) Получаем объект фрейма
        const frame = await frameHandle.contentFrame();
        if (!frame) {
          throw new Error('[cardVerification] -> Не удалось получить контекст фрейма .js-iframe');
        }

        // 3) В контексте фрейма ждём и кликаем по #encryptedCardNumber
        await frame.waitForSelector('#encryptedCardNumber', { visible: true, timeout: 10000 });
        await frame.click('#encryptedCardNumber', { clickCount: 3 });

        // 4) Очищаем поле, имитируя нажатие Backspace
        for (let i = 0; i < 10; i++) {
          await frame.keyboard.press('Backspace');
        }

        // 5) Вводим номер карты
        await frame.type('#encryptedCardNumber', selectedCard, { delay: 100 });
        console.log('[cardVerification] -> Номер карты введён внутри iframe.');
      } catch (error) {
        throw new Error(`[cardVerification] -> Ошибка при вводе номера карты: ${error.message}`);
      }
    }

    // Нажимаем кнопку "Продолжить"
    try {
      await page.waitForSelector('button#credit-card-continue-button', { visible: true, timeout: 10000 });
      await page.click('button#credit-card-continue-button');
      console.log('[cardVerification] -> Нажата кнопка "Продолжить".');
    } catch (error) {
      throw new Error(`[cardVerification] -> Ошибка при нажатии кнопки "Продолжить": ${error.message}`);
    }

    // Ждём исчезновения спиннера (или делаем паузу, если не исчез)
    try {
      await page.waitForSelector('div.ConnectedLoading__SpinnerWrapper-sc-1245kmi-0', { hidden: true, timeout: 15000 });
      console.log('[cardVerification] -> Спиннер исчез, страница обновилась.');
    } catch (error) {
      console.log('[cardVerification] -> Спиннер не исчез вовремя, продолжаем.');
      await sleep(3000);
    }
  } else {
    console.log('[cardVerification] -> Предупреждение о повторном вводе карты не обнаружено, продолжаем без ввода.');
  }

  console.log('[cardVerification] -> Завершение проверки номера карты.');
}

module.exports = { cardVerification };
