/**
 * setCartParams.js
 * ------------------------------------------------
 * Предназначение:
 *  - На уже открытой странице https://checkout12.iherb.com/cart (Puppeteer page)
 *    установить страну, язык, валюту и способ доставки.
 *  - Никаких переходов (goto), открытия браузера и лишних шагов не делает.
 *  - Не закрывает браузер, не читает inputConfig.json.
 *
 * Как вызывать (пример):
 *   const { setCartParams } = require('./setCartParams.js');
 *   await setCartParams(page, { country: 'KZ', lang: 'RU', currency: 'USD', shipping: 'EMEX' });
 *
 * Требования:
 *  - Перед вызовом setCartParams(page, options) страница page ДОЛЖНА быть открыта,
 *    авторизована (если нужно), и находиться на корзине iHerb (checkout12.iherb.com/cart).
 *  - Убедитесь, что элементы .iherb-header-ccl, carrier-item и т.д. доступны на странице.
 */

// Простая функция для паузы (аналог page.waitForTimeout)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * setCartParams(page, options)
 * ------------------------------------------------
 * На уже открытой странице корзины меняет страну/язык/валюту и способ доставки.
 * Использует параметры из options, если они переданы. Если какой-то параметр не передан,
 * используется значение по умолчанию: страна 'KZ', язык 'RU', валюта 'USD', доставка 'EMEX'.
 */
async function setCartParams(page, options) {
  const neededCountry = options && options.country ? options.country : 'KZ'; // страна: Казахстан
  const neededLang = options && options.lang ? options.lang : 'RU';         // язык: русский (RU)
  const neededCurrency = options && options.currency ? options.currency : 'USD';
  const neededShipping = options && options.shipping ? options.shipping : 'EMEX';

  console.log(`[setCartParams] -> Начинаем настройку корзины: страна=${neededCountry}, язык=${neededLang}, валюта=${neededCurrency}, доставка=${neededShipping}`);

  // 1) Проверяем страну/язык/валюту через DOM
  const [countryCode, languageCode, currencyCode] = await page.evaluate(() => {
    const country = document.querySelector('.country-code-flag')?.textContent?.trim() || '';
    const lang = document.querySelector('.language-select')?.textContent?.trim() || '';
    const curr = document.querySelector('.currency-select')?.textContent?.trim() || '';
    return [country, lang, curr];
  });

  console.log(`[setCartParams] -> Текущие настройки: country=${countryCode}, lang=${languageCode}, currency=${currencyCode}`);

  const needChange = (
    (options && options.country && countryCode !== neededCountry) ||
    (options && options.lang && languageCode !== neededLang) ||
    (options && options.currency && currencyCode !== neededCurrency)
  );

  // 2) Если надо изменить страну/язык/валюту
  if (needChange) {
    console.log('[setCartParams] -> Параметры НЕ совпадают, пытаемся открыть .iherb-header-ccl и сменить.');
    try {
      // Клик по панели .iherb-header-ccl
      await page.waitForSelector('.iherb-header-ccl', { visible: true, timeout: 5000 });
      await page.click('.iherb-header-ccl');
      await sleep(2000);

      // (a) Если страна не соответствует
      if (options && options.country && countryCode !== neededCountry) {
        try {
          await page.waitForSelector('.select-country .search-input', { visible: true, timeout: 5000 });
          await page.click('.select-country .search-input');
          await page.type('.select-country .search-input', neededCountry, { delay: 50 });
          await sleep(2000);

          await page.waitForSelector(`div.item[data-val="${neededCountry}"]`, { visible: true, timeout: 5000 });
          await page.click(`div.item[data-val="${neededCountry}"]`);
          console.log(`[setCartParams] -> Выбрали страну ${neededCountry}`);
          await sleep(2000);
        } catch (errC) {
          console.log(`[setCartParams] -> Ошибка при выборе страны=${neededCountry}:`, errC);
        }
      }

      // (b) Если язык не соответствует
      if (options && options.lang && languageCode !== neededLang) {
        try {
          await page.waitForSelector('.select-language .search-input', { visible: true, timeout: 5000 });
          await page.click('.select-language .search-input');
          // Для русского вводим "рус"
          await page.type('.select-language .search-input', 'рус', { delay: 50 });
          await sleep(2000);

          await page.waitForSelector('div.item[data-val="ru-RU"]', { visible: true, timeout: 5000 });
          await page.click('div.item[data-val="ru-RU"]');
          console.log('[setCartParams] -> Выбрали язык ru-RU');
          await sleep(2000);
        } catch (errLang) {
          console.log('[setCartParams] -> Ошибка при выборе языка RU:', errLang);
        }
      }

      // (c) Если валюта не соответствует
      if (options && options.currency && currencyCode !== neededCurrency) {
        try {
          await page.waitForSelector('.select-currency .search-input', { visible: true, timeout: 5000 });
          await page.click('.select-currency .search-input');
          await page.type('.select-currency .search-input', neededCurrency, { delay: 50 });
          await sleep(2000);

          await page.waitForSelector(`div.item[data-val="${neededCurrency}"]`, { visible: true, timeout: 5000 });
          await page.click(`div.item[data-val="${neededCurrency}"]`);
          console.log(`[setCartParams] -> Выбрали валюту ${neededCurrency}`);
          await sleep(2000);
        } catch (errCur) {
          console.log('[setCartParams] -> Ошибка при выборе валюты USD:', errCur);
        }
      }

      // (d) "Сохранить"
      try {
        await page.waitForSelector('.save-selection', { visible: true, timeout: 5000 });
        await page.click('.save-selection');
        console.log('[setCartParams] -> Нажали "Сохранить".');

        // Ждём перезагрузки до 15 секунд
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
          .catch(err => console.log('[setCartParams] -> Нет полной навигации после "Сохранить"?', err));
        console.log('[setCartParams] -> Вероятно, страница перезагрузилась.');
      } catch (errSave) {
        console.log('[setCartParams] -> Ошибка при нажатии "Сохранить":', errSave);
      }

    } catch (errCCL) {
      console.log('[setCartParams] -> Не нашли .iherb-header-ccl:', errCCL);
    }
  } else {
    console.log('[setCartParams] -> Параметры страны, языка и валюты совпадают. Изменения не требуются.');
  }

  // 3) Способ доставки
  console.log('[setCartParams] -> Проверяем/устанавливаем доставку ' + neededShipping + '...');
  try {
    const shippingIsNeeded = await page.evaluate((neededShipping) => {
      const selected = document.querySelector('a.carrier-item.selected');
      if (!selected) return false;
      const label = selected.getAttribute('data-ga-event-label') || '';
      return label.includes(neededShipping);
    }, neededShipping);

    if (shippingIsNeeded) {
      console.log('[setCartParams] -> Уже выбран ' + neededShipping + ', ничего не делаем.');
    } else {
      let foundShipping = false;
      try {
        await page.waitForSelector(`a.carrier-item[data-ga-event-label="${neededShipping}  доставка"]`,
          { visible: true, timeout: 5000 });
        await page.click(`a.carrier-item[data-ga-event-label="${neededShipping}  доставка"]`);
        console.log('[setCartParams] -> Кликнули "' + neededShipping + '  доставка".');
        foundShipping = true;
        await sleep(2000);
      } catch (errShip1) {
        console.log('[setCartParams] -> Не нашли "' + neededShipping + '  доставка". Попробуем альтернативный вариант.', errShip1);
      }

      if (!foundShipping) {
        try {
          await page.waitForSelector(`a.carrier-item[data-ga-event-label="${neededShipping} Home Delivery"]`,
            { visible: true, timeout: 5000 });
          await page.click(`a.carrier-item[data-ga-event-label="${neededShipping} Home Delivery"]`);
          console.log('[setCartParams] -> Кликнули "' + neededShipping + ' Home Delivery".');
          await sleep(2000);
        } catch (errShip2) {
          console.log('[setCartParams] -> Не удалось найти ' + neededShipping + ' вообще:', errShip2);
        }
      }
    }
  } catch (errShip) {
    console.log('[setCartParams] -> Ошибка при выборе доставки ' + neededShipping + ':', errShip);
  }

  console.log('[setCartParams] -> Завершили настройку корзины (страна/язык/валюта/доставка).');
}

module.exports = { setCartParams };
