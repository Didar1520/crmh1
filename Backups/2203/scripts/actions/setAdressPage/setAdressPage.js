/**
 * setAdressPage.js
 * ------------------------------------------------
 * Назначение:
 *  - Установка адреса по умолчанию / добавление адреса, если не найден.
 *  - Перед поиском адреса ждём, чтобы страница полноценно загрузилась (без спиннеров).
 *  - При каждом переходе (кроме страницы корзины) проверяем капчу.
 */

const { safeWaitForLoad } = require('../utils/pageLoadHelper.js');
const addNewAddress = require('./addNewAdress.js');
const config = require('../../config.js');
const { checkAndSolveCaptchaInPlace } = require('../../captcha.js');
const {
  humanMouseMovements,
  clickWhenVisible,
  waitForStateChange,
  logActions,
  sleep
} = require('../../utils');

/**
 * Преобразуем ФИО "Ибраева Шинарай Абдрахмановна" -> "ибраева шинарай"
 */
/**
 * Преобразуем ФИО "Ибраева Шинарай Абдрахмановна" -> "ибраева шинарай"
 */
function processName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 2) {
    return parts.slice(0, 2).join(' ').toLowerCase();
  }
  return fullName.trim().toLowerCase();
}

/** 
 * Ожидание исчезновения спиннера на странице адресной книги.
 */
async function waitForSpinnerOnAddressBook(page, maxWait = 5000) {
  const spinnerSelector = 'svg[data-qa-element="loading-spinner"]';
  const start = Date.now();
  let spinnerAppeared = false;

  try {
    await page.waitForSelector(spinnerSelector, { timeout: 1000 });
    spinnerAppeared = true;
    console.log('[setAdressPage] -> Спиннер появился, ждём его исчезновения...');
  } catch {
    // Спиннер не появился
  }

  if (spinnerAppeared) {
    try {
      await page.waitForSelector(spinnerSelector, { hidden: true, timeout: maxWait - (Date.now() - start) });
      console.log('[setAdressPage] -> Спиннер исчез.');
    } catch {
      console.log('[setAdressPage] -> Спиннер не исчез за 5 сек.');
      return false;
    }
  }
  return true;
}

/**
 * Helper: проверяет и решает капчу, если она появляется на странице.
 * Также убеждается, что URL содержит ожидаемую подстроку (если задана).
 */
async function navigateWithCaptcha(page, expectedUrlSubstring, captchaTimeout = 15000) {
  try {
    await checkAndSolveCaptchaInPlace(page, null, captchaTimeout);
  } catch (err) {
    console.log(`[setAdressPage] -> Ошибка проверки капчи: ${err.message}`);
  }

  if (expectedUrlSubstring && !page.url().includes(expectedUrlSubstring)) {
    throw new Error(
      `[setAdressPage] -> Не удалось перейти на страницу, ` +
      `ожидалось наличие "${expectedUrlSubstring}" в URL. Текущий URL: ${page.url()}`
    );
  }
}

/**
 * Точка входа: setDefaultAddress
 * Теперь функция принимает addressData и использует его поле FullName для поиска адреса.
 * Убраны шаги, где мы заходили на корзину, дашборд и только потом шли в адресную книгу.
 * Теперь переходим сразу в адресную книгу с нужным реферером.
 */
async function setDefaultAddress(page, addressData) {
  if (!addressData || !addressData.FullName) {
    throw new Error('[setAdressPage] -> addressData или поле FullName не переданы.');
  }
  const defaultAdressFull = addressData.FullName.trim();
  const desiredName = processName(defaultAdressFull);
  console.log(`[setAdressPage] -> Искомое имя: "${desiredName}"`);

  // Глобальное переопределение navigator.webdriver (если ещё не задано)
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // Переходим напрямую на адресную книгу с реферером дашборда
  await page.goto('https://checkout12.iherb.com/users/address-book', {
    waitUntil: 'networkidle2',
    timeout: 15000,
    referer: 'https://checkout12.iherb.com/users/dashboard'
  });
  console.log('[setAdressPage] -> Перешли на страницу адресной книги напрямую (через реферер дашборда)');

  // Проверяем капчу
  await navigateWithCaptcha(page, '/users/address-book', 15000);

  // Убеждаемся, что мы действительно на странице адресной книги
  const currentUrl = page.url();
  if (!currentUrl.includes('/users/address-book')) {
    throw new Error('[setAdressPage] -> Не на странице адресной книги.');
  }

  // Ждём исчезновения спиннера, если он появился
  const spinnerOk = await waitForSpinnerOnAddressBook(page, 5000);
  if (!spinnerOk) {
    console.log('[setAdressPage] -> Спиннер завис, перезагружаем страницу адресной книги...');
    await page.reload({ waitUntil: 'networkidle2' });
  }

  // Ожидаем, пока отобразятся адреса или сообщение об отсутствии адресов
  await page.waitForSelector('.address_item, .empty-address-book', { timeout: 15000 });
  console.log('[setAdressPage] -> Адресная книга загружена, начинаем поиск адреса...');

  // Дальнейшая логика поиска адреса (с установкой default или пагинация) остается без изменений
  let addressFound = false;
  let currentPageNumber = 1;
  let totalPages = Infinity;

  while (true) {
    const addresses = await page.$$('.address_item');
    console.log(`[setAdressPage] -> Найдено адресов: ${addresses.length} (page=${currentPageNumber})`);

    for (const addr of addresses) {
      const nameElement = await addr.$('.address_no');
      if (!nameElement) continue;
      const nameText = (await page.evaluate(el => el.textContent.trim(), nameElement)).toLowerCase();
      console.log(`[setAdressPage] -> Имя адреса: "${nameText}"`);

      if (nameText === desiredName) {
        const defaultDiv = await addr.$('.default');
        if (!defaultDiv) {
          const setDefaultBtn = await addr.$('.set_default_btn[data-name="SetAsDefault"]');
          if (setDefaultBtn) {
            await setDefaultBtn.click();
            console.log(`[setAdressPage] -> Сделали адрес "${nameText}" основным.`);
            await page.waitForFunction(
              (addrSel, nm) => {
                const items = document.querySelectorAll(addrSel);
                for (const it of items) {
                  const nEl = it.querySelector('.address_no');
                  if (nEl && nEl.textContent.trim().toLowerCase() === nm) {
                    return !!it.querySelector('.default');
                  }
                }
                return false;
              },
              { timeout: 10000 },
              '.address_item',
              nameText
            );
          }
        } else {
          console.log(`[setAdressPage] -> Адрес "${nameText}" уже основной.`);
        }
        addressFound = true;
        return true;
      }
    }

    const addressItemsPresent = await page.$$('.address_item');
    const emptyStatePresent = await page.$('.empty-address-book');
    if (addressItemsPresent.length === 0 && !emptyStatePresent) {
      throw new Error('[setAdressPage] -> Адресная книга не обнаружена на странице.');
    }

    if (currentPageNumber === 1) {
      const totalEl = await page.$('.pagination-container .total-pages');
      if (totalEl) {
        const tText = await page.evaluate(el => el.textContent.trim(), totalEl);
        totalPages = parseInt(tText, 10) || currentPageNumber;
        console.log(`[setAdressPage] -> totalPages=${totalPages}`);
      }
    }

    if (currentPageNumber >= totalPages) {
      console.log(`[setAdressPage] -> Больше страниц нет, адрес "${desiredName}" не найден.`);
      break;
    }

    const nextPageBtnSel = `button[aria-label="Go to page ${currentPageNumber + 1}"]`;
    const nextPageBtn = await page.$(nextPageBtnSel);
    if (!nextPageBtn) {
      console.log(`[setAdressPage] -> Кнопка для страницы ${currentPageNumber + 1} не найдена, завершаем.`);
      break;
    }
    await nextPageBtn.click();
    await sleep(3000);
    await page.waitForFunction(
      (expectedPage) => {
        const selectedBtn = document.querySelector('button.Mui-selected');
        return selectedBtn && parseInt(selectedBtn.textContent.trim(), 10) === expectedPage;
      },
      { timeout: 10000 },
      currentPageNumber + 1
    );
    currentPageNumber++;
  }

  if (!addressFound) {
    console.log(`[setAdressPage] -> Адрес "${desiredName}" не найден.`);
  }
  return addressFound;
}

/**
 * handleAddressSetPage(page, addressData)
 * - Если setDefaultAddress(...) вернул false, добавляем новый адрес.
 */
async function handleAddressSetPage(page, addressData) {
  try {
    const addressSet = await setDefaultAddress(page, addressData);
    if (!addressSet) {
      console.log('[setAdressPage] -> Адрес не найден => добавляем.');
      await addNewAddress(page, addressData);
    }
  } catch (error) {
    console.error(`[setAdressPage] -> handleAddressSetPage: ${error.message}`);
    throw error;
  }
}

module.exports = handleAddressSetPage;
