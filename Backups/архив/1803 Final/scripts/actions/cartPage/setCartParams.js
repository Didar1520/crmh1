/**
 * setCartParams.js
 * ------------------------------------------------
 * Предназначение:
 *  - На уже открытой странице https://checkout12.iherb.com/cart (Puppeteer page)
 *    установить страну, язык, валюту и способ доставки.
 *  - Никаких переходов (goto), открытия браузера и лишних шагов не делает.
 *  - Не читает внешние конфиги (inputConfig.json и т.п.).
 *
 * ВАЖНО: Если меняется страна, тогда мы форсированно меняем и язык, и валюту.
 *        (Считается, что при смене страны нужно «перезадать» всё.)
 *
 * Как вызывать (пример):
 *   const { setCartParams } = require('./setCartParams.js');
 *   await setCartParams(page, { country: 'KZ', lang: 'RU', currency: 'USD', shipping: 'EMEX' });
 *
 * Требования:
 *  - Перед вызовом страница (page) должна быть уже открыта, авторизована (если нужно),
 *    и находиться на корзине iHerb (checkout12.iherb.com/cart).
 *  - Убедитесь, что элементы .iherb-header-ccl, carrier-item и т.д. доступны на странице.
 */

// Вспомогательная функция для "поспать" (аналог page.waitForTimeout, но без его использования).
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * setCartParams(page, options)
 * ------------------------------------------------
 * На уже открытой странице корзины меняет страну/язык/валюту и способ доставки.
 * Использует значения из options или берёт умолчания:
 *  - country='KZ', lang='RU', currency='USD', shipping='EMEX'.
 * Если надо менять страну, делаем это вместе с языком и валютой (форсированно).
 */
async function setCartParams(page, options = {}) {
  const {
    country  = 'KZ',   // По умолчанию "Казахстан"
    lang     = 'RU',   // По умолчанию "Русский"
    currency = 'USD',  // По умолчанию "Доллар США"
    shipping = 'EMEX', // По умолчанию "EMEX"
  } = options;

  console.log(`[setCartParams] -> Начинаем настройку корзины: страна=${country}, язык=${lang}, валюта=${currency}, доставка=${shipping}`);

  // 1) Считываем текущие значения (страна, язык, валюта) через DOM
  const [currentCountry, currentLang, currentCurrency] = await page.evaluate(() => {
    const countryEl  = document.querySelector('.country-code-flag');
    const langEl     = document.querySelector('.language-select');
    const currEl     = document.querySelector('.currency-select');

    const countryVal  = countryEl?.textContent?.trim() || '';
    const langVal     = langEl?.textContent?.trim()    || '';
    const currVal     = currEl?.textContent?.trim()    || '';

    return [countryVal, langVal, currVal];
  });

  console.log(`[setCartParams] -> Текущие настройки: country=${currentCountry}, lang=${currentLang}, currency=${currentCurrency}`);

  // Проверим, нужно ли открывать панель .iherb-header-ccl
  // Случаи:
  //  1) Если страна != нужной: мы всё равно будем менять страну, язык, валюту (форс).
  //  2) Иначе, если язык != нужного или валюта != нужной — точечно меняем.
  //
  // Итак, надо ли вообще что-то менять из (страна/язык/валюта)?
  const needChangeCountry  = (currentCountry !== country);
  const needChangeLang     = !needChangeCountry && (currentLang !== lang);       // язык меняем точечно, только если страна уже совпадает
  const needChangeCurrency = !needChangeCountry && (currentCurrency !== currency); // валюта меняется точечно, только если страна уже совпадает

  // Итоговое "надо ли открывать панель":
  const needOpenCCL = needChangeCountry || needChangeLang || needChangeCurrency;

  if (needOpenCCL) {
    try {
      console.log('[setCartParams] -> Требуется открыть .iherb-header-ccl и изменить настройки.');
      // Открываем панель
      await page.waitForSelector('.iherb-header-ccl', { visible: true, timeout: 5000 });
      await page.click('.iherb-header-ccl');
      await sleep(2000);

      // 2a) Если надо менять страну (тогда и язык, и валюта — форс)
      if (needChangeCountry) {
        await changeCountry(page, country);
        await changeLanguage(page, lang);
        await changeCurrency(page, currency);
      } else {
        // 2b) Иначе меняем язык и/или валюту точечно (если требуется)
        if (needChangeLang) {
          await changeLanguage(page, lang);
        }
        if (needChangeCurrency) {
          await changeCurrency(page, currency);
        }
      }

      // (d) Нажимаем "Сохранить" и ждём перезагрузки
      try {
        await page.waitForSelector('.save-selection', { visible: true, timeout: 5000 });
        await page.click('.save-selection');
        console.log('[setCartParams] -> Нажали "Сохранить".');

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
          .catch(err => console.log('[setCartParams] -> Навигация после сохранения не завершилась полностью:', err));

        console.log('[setCartParams] -> Страница перезагрузилась (вероятно).');
      } catch (errSave) {
        console.log('[setCartParams] -> Ошибка при нажатии "Сохранить":', errSave);
      }

    } catch (errCCL) {
      console.log('[setCartParams] -> Не нашли или не смогли открыть .iherb-header-ccl:', errCCL);
    }
  } else {
    console.log('[setCartParams] -> Страна, язык и валюта уже совпадают с нужными. Изменения не требуются.');
  }

  // 3) Проверяем/устанавливаем способ доставки
  console.log(`[setCartParams] -> Проверяем/устанавливаем доставку "${shipping}"...`);
  try {
    const isAlreadySelected = await page.evaluate((neededShipping) => {
      const selectedItem = document.querySelector('a.carrier-item.selected');
      if (!selectedItem) return false;
      const label = selectedItem.getAttribute('data-ga-event-label') || '';
      return label.includes(neededShipping);
    }, shipping);

    if (isAlreadySelected) {
      console.log(`[setCartParams] -> Доставка "${shipping}" уже выбрана, ничего не делаем.`);
    } else {
      // Пытаемся найти и кликнуть нужный вариант
      let foundShipping = false;
      try {
        await page.waitForSelector(`a.carrier-item[data-ga-event-label="${shipping}  доставка"]`,
          { visible: true, timeout: 5000 });
        await page.click(`a.carrier-item[data-ga-event-label="${shipping}  доставка"]`);
        console.log(`[setCartParams] -> Кликнули "${shipping}  доставка".`);
        foundShipping = true;
        await sleep(2000);
      } catch (errShip1) {
        console.log(`[setCartParams] -> Не нашли "${shipping}  доставка". Попробуем другой вариант...`, errShip1);
      }

      // Если не нашли, пробуем "Home Delivery"
      if (!foundShipping) {
        try {
          await page.waitForSelector(`a.carrier-item[data-ga-event-label="${shipping} Home Delivery"]`,
            { visible: true, timeout: 5000 });
          await page.click(`a.carrier-item[data-ga-event-label="${shipping} Home Delivery"]`);
          console.log(`[setCartParams] -> Кликнули "${shipping} Home Delivery".`);
          await sleep(2000);
        } catch (errShip2) {
          console.log(`[setCartParams] -> Не удалось найти доставку "${shipping}" вообще:`, errShip2);
        }
      }
    }
  } catch (errShip) {
    console.log(`[setCartParams] -> Ошибка при выборе доставки "${shipping}":`, errShip);
  }

  console.log('[setCartParams] -> Завершили настройку корзины (страна/язык/валюта/доставка).');
}

/**
 * Меняем страну (по строке countryCode, например "KZ").
 * Перед вызовом предполагается, что панель .iherb-header-ccl уже открыта.
 */
async function changeCountry(page, countryCode) {
  try {
    console.log(`[setCartParams] -> Меняем страну на "${countryCode}"...`);
    await page.waitForSelector('.select-country .search-input', { visible: true, timeout: 5000 });
    await page.click('.select-country .search-input');
    await clearAndType(page, '.select-country .search-input', countryCode);

    await page.waitForSelector(`div.item[data-val="${countryCode}"]`, { visible: true, timeout: 5000 });
    await page.click(`div.item[data-val="${countryCode}"]`);
    console.log(`[setCartParams] -> Страна выбрана: ${countryCode}`);
    await sleep(1500);
  } catch (err) {
    console.log(`[setCartParams] -> Ошибка при выборе страны=${countryCode}:`, err);
  }
}

/**
 * Меняем язык (по строке langCode, например "RU").
 * Если нужно "ru-RU", мы можем определить это внутри или передать сразу.
 */
async function changeLanguage(page, langCode) {
  try {
    console.log(`[setCartParams] -> Меняем язык на "${langCode}"...`);
    await page.waitForSelector('.select-language .search-input', { visible: true, timeout: 5000 });
    await page.click('.select-language .search-input');

    // Для русского обычно печатаем "рус", чтобы появилось "ru-RU" (зависит от сайта).
    const inputLang = (langCode.toLowerCase() === 'ru') ? 'рус' : langCode;
    await clearAndType(page, '.select-language .search-input', inputLang);

    // В селекторах iHerb обычно "ru-RU", "en-US" и т.д.
    const dataValLang = (langCode.toLowerCase() === 'ru') ? 'ru-RU' : langCode;
    await page.waitForSelector(`div.item[data-val="${dataValLang}"]`, { visible: true, timeout: 5000 });
    await page.click(`div.item[data-val="${dataValLang}"]`);
    console.log(`[setCartParams] -> Язык выбран: ${dataValLang}`);
    await sleep(1500);
  } catch (err) {
    console.log(`[setCartParams] -> Ошибка при выборе языка=${langCode}:`, err);
  }
}

/**
 * Меняем валюту (по строке currencyCode, например "USD").
 */
async function changeCurrency(page, currencyCode) {
  try {
    console.log(`[setCartParams] -> Меняем валюту на "${currencyCode}"...`);
    await page.waitForSelector('.select-currency .search-input', { visible: true, timeout: 5000 });
    await page.click('.select-currency .search-input');
    await clearAndType(page, '.select-currency .search-input', currencyCode);

    await page.waitForSelector(`div.item[data-val="${currencyCode}"]`, { visible: true, timeout: 5000 });
    await page.click(`div.item[data-val="${currencyCode}"]`);
    console.log(`[setCartParams] -> Валюта выбрана: ${currencyCode}`);
    await sleep(1500);
  } catch (err) {
    console.log(`[setCartParams] -> Ошибка при выборе валюты=${currencyCode}:`, err);
  }
}

/**
 * Утилита для очистки поля ввода и печати нового текста.
 */
async function clearAndType(page, selector, text) {
  await page.focus(selector);
  // Переместить курсор в начало
  await page.keyboard.press('Home');
  // Зажать Shift, выделить до конца
  await page.keyboard.down('Shift');
  await page.keyboard.press('End');
  await page.keyboard.up('Shift');
  // Удалить выделенное
  await page.keyboard.press('Backspace');
  // Напечатать нужный текст
  await page.type(selector, text, { delay: 50 });
  await sleep(500);
}

module.exports = { setCartParams };
