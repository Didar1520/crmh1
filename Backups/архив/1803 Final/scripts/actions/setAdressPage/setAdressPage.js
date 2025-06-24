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
function processName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 2) {
    return parts.slice(0, 2).join(' ').toLowerCase();
  }
  return fullName.trim().toLowerCase();
}

/** 
 * Ожидание исчезновения спиннера на странице адресной книги.
 * Замените селектор spinnerSelector на реальный, если потребуется.
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
 * Helper: проверяет капчу после перехода, если страница не является корзиной.
 * Также убеждается, что URL содержит ожидаемую подстроку (если задана).
 */
async function navigateWithCaptcha(page, expectedUrlSubstring, captchaTimeout = 15000) {
  const cartUrl = 'https://checkout12.iherb.com/cart';
  if (!page.url().includes(cartUrl)) {
    try {
      await checkAndSolveCaptchaInPlace(page, null, captchaTimeout);
    } catch (err) {
      console.log(`[setAdressPage] -> Ошибка проверки капчи: ${err.message}`);
    }
  }
  if (expectedUrlSubstring && !page.url().includes(expectedUrlSubstring)) {
    throw new Error(`[setAdressPage] -> Не удалось перейти на страницу, ожидалось наличие "${expectedUrlSubstring}" в URL. Текущий URL: ${page.url()}`);
  }
}

/**
 * Точка входа: setDefaultAddress
 * Теперь функция принимает addressData и использует его поле FullName для поиска адреса.
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

  // 1) Переход на страницу корзины (без проверки капчи)
  const cartUrl = 'https://checkout12.iherb.com/cart';
  await page.goto(cartUrl, { waitUntil: 'networkidle2', timeout: 15000 });
  console.log('[setAdressPage] -> Перешли на страницу корзины');

  // 2) Имитация человеческого поведения: движения мышью, скролл, задержка
  await humanMouseMovements(page, 1500);
  await page.evaluate(() => window.scrollBy(0, 200));
  await sleep(1000);

  // 3) Клик по ссылке "Мой аккаунт" на странице корзины
  await page.waitForSelector('a.my-account-label', { timeout: 15000 });
  console.log('[setAdressPage] -> Кнопка "Мой аккаунт" найдена');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    page.click('a.my-account-label')
  ]);
  console.log('[setAdressPage] -> Перешли на страницу dashboard');
  // 4) Проверка капчи после перехода на dashboard
  await navigateWithCaptcha(page, '/users/dashboard', 15000);
  await safeWaitForLoad(page, 5000);

  // 5) Клик по ссылке "Адресная книга"
  await page.waitForSelector('a.addressbook', { timeout: 15000 });
  console.log('[setAdressPage] -> Кнопка "Адресная книга" найдена');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    page.click('a.addressbook')
  ]);
  console.log('[setAdressPage] -> Перешли на страницу address-book');
  // 6) Проверка капчи после перехода на адресную книгу
  await navigateWithCaptcha(page, '/users/address-book', 15000);
  const currentUrl = page.url();
  if (!currentUrl.includes('/users/address-book')) {
    throw new Error('[setAdressPage] -> Не на странице адресной книги.');
  }
  const spinnerOk = await waitForSpinnerOnAddressBook(page, 5000);
  if (!spinnerOk) {
    console.log('[setAdressPage] -> Спиннер завис, перезагружаем страницу адресной книги...');
    await page.reload({ waitUntil: 'networkidle2' });
  }
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
