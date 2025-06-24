/**
 * cartPage.js (контролирующий модуль handleCart)
 * -----------------------------------------------------------------------------
 * Логика:
 *   0) Устанавливает адрес доставки и параметр для таможни (если setAdressPage=true)
 *   1) Переходит на страницу корзины (safeGoto).
 *   2) Закрывает туториал, если есть.
 *   3) (Опц.) removeItemsIfNeeded(...) – очистка
 *   4) (Опц.) addItemsIfNeeded(...) – добавление
 *   5) safeWaitForLoad(...)
 *   6) (Опц.) setCartParams(...)
 *   7) (Опц.) applyCoupon(...)
 *   8) (Опц.) checkSumm(...)
 */

const { safeWaitForLoad, sleep, safeGoto } = require('../utils/pageLoadHelper.js');
const { closeTutorialIfPresent } = require('./cartTutorial');
const { applyCoupon } = require('./applyCoupon.js');
const { setCartParams } = require('./setCartParams.js');
const { removeItemsIfNeeded } = require('./removeItems.js');
const { addItemsIfNeeded } = require('./addItems.js');
const { checkSumm } = require('./checkSumm.js');
const setAdressPage = require('../setAdressPage/setAdressPage.js');
const config = require('../../config.js'); // Файл с настройками, содержит поле defaultAdress
const adressList = require('../../../data/adressBook/adressList.json'); // убедитесь, что файл переименован в .json
const {
  humanMouseMovements,
  clickWhenVisible,
  waitForStateChange,
  logActions
} = require('../../utils');

const CART_URL = 'https://checkout12.iherb.com/cart';

const MODULES = {
  removeItems: true,     // очистка
  addItems: true,        // добавление
  setCartParams: true,   // настройка страны/валюты/доставки
  applyCoupon: true,     // применение промо/реф.кодов
  checkSumm: true        // проверка суммы
};

async function handleCart(page, finalParams) {
  // Шаг 0: Выбор адреса доставки из адресной книги
  console.log(`[cartPage] -> Всего адресов: ${adressList.length}`);
  let index = Number(config.defaultAdress);
  if (isNaN(index) || index < 0 || index >= adressList.length) {
    console.warn(`[cartPage] -> Некорректный индекс адреса в config.js: ${config.defaultAdress}. Используем индекс 0.`);
    index = 0;
  }

  const addressData = adressList[index];
  if (!addressData) {
    console.error('[cartPage] -> addressData is undefined. Проверьте адресную книгу.');
    process.exit(1);
  }

  console.log(`[cartPage] -> Адрес с индексом ${index}:`, addressData);

  // Устанавливаем адрес доставки (если включено)
  if (finalParams.setAdressPage) {
    try {
      console.log('[cartPage] -> Запуск setAdressPage.js с данными адреса...');
      await setAdressPage(page, addressData);
      console.log('[cartPage] -> setAdressPage завершён.');
    } catch (err) {
      console.error(`[cartPage] -> Ошибка при установке адреса: ${err.message}`);
      throw err;
    }
  } else {
    console.log('[cartPage] -> Параметр setAdressPage=false, пропускаем установку адреса...');
  }

  // 1) Переходим на страницу корзины (через safeGoto, без лишних ожиданий)
  console.log(`[cartPage] -> Переход к: ${CART_URL}`);
  await safeGoto(page, CART_URL, {
    waitUntil: 'networkidle2',
    timeout: 15000,   // Можно регулировать
    maxRetries: 1,    // Попробовать ещё раз, если зависло
    extraWait: 0
  });

  // 2) Закрываем туториал, если есть
  console.log('[cartPage] -> Закрываем туториал, если он есть...');
  await closeTutorialIfPresent(page);

  // 3) Очистка (если включено)
  if (MODULES.removeItems) {
    await removeItemsIfNeeded(page);
  }

  // 4) Добавление (если включено)
  if (MODULES.addItems) {
    await addItemsIfNeeded(page, finalParams.cartLink);
  }

  // 5) Ждём safeWaitForLoad без лишнего extraWait
  console.log('[cartPage] -> Ждём safeWaitForLoad (после добавления)...');
  try {
    await safeWaitForLoad(page, 0);
    console.log('[cartPage] -> Страница загружена после добавления.');
  } catch (errWait) {
    console.log('[cartPage] -> Ошибка safeWaitForLoad:', errWait);
  }

  // 6) setCartParams (если нужно и включено)
  if (MODULES.setCartParams) {
    try {
      console.log('[cartPage] -> Вызываем setCartParams...');
      await setCartParams(page);
      console.log('[cartPage] -> setCartParams завершён.');
    } catch (errParams) {
      console.log('[cartPage] -> Ошибка в setCartParams:', errParams);
    }
  }

  // 7) Применяем купоны (если включено)
  if (MODULES.applyCoupon) {
    if (finalParams.promoCode || finalParams.referralCode) {
      console.log('[cartPage] -> Применяем купоны/рефкод...');
      await applyCoupon(page, {
        promoCode: finalParams.promoCode,
        referralCode: finalParams.referralCode
      });
    } else {
      console.log('[cartPage] -> Нет promoCode/referralCode, пропускаем applyCoupon.');
    }
  }

  // Пробуем минимизировать задержку (если нужно, снизить humanMouseMovements?)
  await humanMouseMovements(page, 500); // Уменьшили немного
  // Скролл на небольшую дистанцию
  await page.evaluate(() => window.scrollBy(0, 200));

  // Если нужно, можно убрать эту паузу совсем или сократить
  await sleep(500);

  // 8) Проверяем сумму (если включено)
  let cartResult;
  if (MODULES.checkSumm) {
    const maxSum = finalParams.maxSum || 200;
    console.log(`[cartPage] -> checkSumm() c лимитом=$${maxSum}`);
    cartResult = await checkSumm(page, maxSum);
  }

  // Если сумма ок, идём дальше (preOrderPage)
  if (cartResult) {
    const { preOrderPage } = require('./preOrderPage.js');
    await preOrderPage(page, cartResult);
  }

  console.log('[cartPage] -> handleCart() завершён.');
  return cartResult;
}

module.exports = { handleCart, MODULES };
