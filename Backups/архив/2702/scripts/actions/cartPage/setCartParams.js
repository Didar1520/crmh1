// scripts/actions/testCartParams.js
/**
 * testCartParams.js
 * ------------------------------------------------
 * Шаги:
 *  1) Читает inputConfig.json, берёт первый объект, извлекает Account (профиль).
 *  2) Запускает браузер (без вызова authorize), считая, что сессия сохранена.
 *  3) Открывает https://checkout12.iherb.com/cart.
 *  4) Закрывает туториал (если есть cartTutorial.js).
 *  5) Проверяет (в DOM) страну/язык/валюту.
 *     - Если уже KZ/RU/USD, пропускаем.
 *     - Иначе открываем .iherb-header-ccl, вводим нужные, жмём .save-selection, ждём перезагрузку.
 *  6) Проверяем способ доставки EMEX:
 *     - Если carrier-item.selected уже содержит EMEX => Ок.
 *     - Иначе кликаем a.carrier-item[data-ga-event-label="EMEX  доставка"] или "EMEX Home Delivery".
 *  7) Не закрываем браузер, даём проверить результат вручную.
 */

const { launchBrowserForAccount } = require('../browserManager.js');

// Если есть модуль cartTutorial.js — пробуем подключить:
let closeTutorialIfPresent = null;
try {
  const tut = require('./cartTutorial.js');
  closeTutorialIfPresent = tut.closeTutorialIfPresent;
} catch (err) {
  console.log('[testCartParams] -> Нет cartTutorial.js, продолжим без закрытия туториала.', err);
}

// Загружаем inputConfig.json => берём первый объект
let inputOrders = [];
try {
  inputOrders = require('../inputConfig.json');
  if (!Array.isArray(inputOrders)) inputOrders = [];
} catch (err) {
  console.log('[testCartParams] -> Не удалось загрузить inputConfig.json:', err);
  inputOrders = [];
}

// Простая функция для пауз (вместо page.waitForTimeout)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTestCartParams() {
  console.log('[testCartParams] -> Начинаем тест: проверка страны=KZ, языка=RU, валюты=USD, доставка=EMEX');

  // 1) Проверяем, есть ли данные в inputConfig.json
  if (inputOrders.length === 0) {
    console.log('[testCartParams] -> inputConfig.json пуст, прерываем.');
    return;
  }
  const firstObj = inputOrders[0];
  const accountEmail = firstObj.Account || '';
  if (!accountEmail) {
    console.log('[testCartParams] -> Нет поля Account в первом элементе, прерываем.');
    return;
  }
  console.log(`[testCartParams] -> Используем профиль: ${accountEmail}`);

  // 2) Запуск браузера
  const { browser, page } = await launchBrowserForAccount({ accountEmail });

  try {
    // 3) Открываем корзину
    const cartUrl = 'https://checkout12.iherb.com/cart';
    console.log(`[testCartParams] -> Переходим на страницу: ${cartUrl}`);
    await page.goto(cartUrl, { waitUntil: 'networkidle2' });

    // 4) Закрываем туториал, если есть
    if (closeTutorialIfPresent) {
      await closeTutorialIfPresent(page);
    }

    // 5) Проверяем страну/язык/валюту по DOM
    const [countryCode, languageCode, currencyCode] = await page.evaluate(() => {
      const country = document.querySelector('.country-code-flag')?.textContent?.trim() || '';
      const lang = document.querySelector('.language-select')?.textContent?.trim() || '';
      const curr = document.querySelector('.currency-select')?.textContent?.trim() || '';
      return [country, lang, curr];
    });
    console.log(`[testCartParams] -> Текущие настройки: country=${countryCode}, lang=${languageCode}, currency=${currencyCode}`);

    const neededCountry = 'KZ'; // страна: Казахстан
    const neededLang = 'RU';    // язык: русский (RU)
    const neededCurrency = 'USD';

    const needChange = (countryCode !== neededCountry || languageCode !== neededLang || currencyCode !== neededCurrency);

    if (needChange) {
      console.log('[testCartParams] -> Параметры НЕ совпадают, открываем .iherb-header-ccl для смены.');

      try {
        // Клик по панели .iherb-header-ccl
        await page.waitForSelector('.iherb-header-ccl', { visible: true, timeout: 5000 });
        await page.click('.iherb-header-ccl');
        await sleep(2000);

        // (a) Если страна не KZ
        if (countryCode !== neededCountry) {
          try {
            await page.waitForSelector('.select-country .search-input', { visible: true, timeout: 5000 });
            await page.click('.select-country .search-input');
            await page.type('.select-country .search-input', neededCountry, { delay: 50 });
            await sleep(2000);

            await page.waitForSelector(`div.item[data-val="${neededCountry}"]`, { visible: true, timeout: 5000 });
            await page.click(`div.item[data-val="${neededCountry}"]`);
            console.log(`[testCartParams] -> Выбрали страну ${neededCountry}`);
            await sleep(2000);
          } catch (errC) {
            console.log(`[testCartParams] -> Ошибка при выборе страны=${neededCountry}:`, errC);
          }
        }

        // (b) Если язык не RU
        if (languageCode !== neededLang) {
          try {
            await page.waitForSelector('.select-language .search-input', { visible: true, timeout: 5000 });
            await page.click('.select-language .search-input');
            // Для русского вводим "рус"
            await page.type('.select-language .search-input', 'рус', { delay: 50 });
            await sleep(2000);

            await page.waitForSelector('div.item[data-val="ru-RU"]', { visible: true, timeout: 5000 });
            await page.click('div.item[data-val="ru-RU"]');
            console.log('[testCartParams] -> Выбрали язык ru-RU');
            await sleep(2000);
          } catch (errLang) {
            console.log('[testCartParams] -> Ошибка при выборе языка RU:', errLang);
          }
        }

        // (c) Если валюта не USD
        if (currencyCode !== neededCurrency) {
          try {
            await page.waitForSelector('.select-currency .search-input', { visible: true, timeout: 5000 });
            await page.click('.select-currency .search-input');
            await page.type('.select-currency .search-input', 'USD', { delay: 50 });
            await sleep(2000);

            await page.waitForSelector('div.item[data-val="USD"]', { visible: true, timeout: 5000 });
            await page.click('div.item[data-val="USD"]');
            console.log('[testCartParams] -> Выбрали валюту USD');
            await sleep(2000);
          } catch (errCur) {
            console.log('[testCartParams] -> Ошибка при выборе валюты USD:', errCur);
          }
        }

        // (d) "Сохранить"
        try {
          await page.waitForSelector('.save-selection', { visible: true, timeout: 5000 });
          await page.click('.save-selection');
          console.log('[testCartParams] -> Нажали "Сохранить".');

          // Ждём перезагрузки до 15 секунд
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            .catch(err => console.log('[testCartParams] -> Нет полной навигации после "Сохранить"?', err));
          console.log('[testCartParams] -> Вероятно, страница перезагрузилась.');
        } catch (errSave) {
          console.log('[testCartParams] -> Ошибка при нажатии "Сохранить":', errSave);
        }

      } catch (errCCL) {
        console.log('[testCartParams] -> Не нашли .iherb-header-ccl:', errCCL);
      }
    } else {
      console.log('[testCartParams] -> Параметры уже совпадают (KZ, RU, USD). Ничего не меняем.');
    }

    // 6) Способ доставки "EMEX"
    console.log('[testCartParams] -> Проверяем/устанавливаем доставку EMEX...');
    try {
      // Проверим, уже ли выбран EMEX (например, a.carrier-item.selected, data-ga-event-label содержит 'EMEX')
      const shippingIsEmex = await page.evaluate(() => {
        const selected = document.querySelector('a.carrier-item.selected');
        if (!selected) return false;
        const label = selected.getAttribute('data-ga-event-label') || '';
        return label.includes('EMEX');
      });

      if (shippingIsEmex) {
        console.log('[testCartParams] -> Уже выбран EMEX, ничего не делаем.');
      } else {
        // Пытаемся кликнуть "EMEX  доставка"
        let foundEmex = false;
        try {
          await page.waitForSelector('a.carrier-item[data-ga-event-label="EMEX  доставка"]',
            { visible: true, timeout: 5000 });
          await page.click('a.carrier-item[data-ga-event-label="EMEX  доставка"]');
          console.log('[testCartParams] -> Кликнули "EMEX  доставка".');
          foundEmex = true;
          await sleep(2000);
        } catch (errEmex1) {
          console.log('[testCartParams] -> Не нашли "EMEX  доставка". Попробуем "EMEX Home Delivery".', errEmex1);
        }

        if (!foundEmex) {
          try {
            await page.waitForSelector('a.carrier-item[data-ga-event-label="EMEX Home Delivery"]',
              { visible: true, timeout: 5000 });
            await page.click('a.carrier-item[data-ga-event-label="EMEX Home Delivery"]');
            console.log('[testCartParams] -> Кликнули "EMEX Home Delivery".');
            await sleep(2000);
          } catch (errEmex2) {
            console.log('[testCartParams] -> Не удалось найти EMEX вообще:', errEmex2);
          }
        }
      }
    } catch (errShip) {
      console.log('[testCartParams] -> Ошибка при выборе доставки EMEX:', errShip);
    }

    console.log('[testCartParams] -> Всё готово. Оставляем браузер открытым для проверки вручную.');

  } catch (overallErr) {
    console.log('[testCartParams] -> Общая ошибка во время теста:', overallErr);
  }
  // НЕ закрываем браузер
}

if (require.main === module) {
  runTestCartParams();
}

module.exports = { runTestCartParams };
