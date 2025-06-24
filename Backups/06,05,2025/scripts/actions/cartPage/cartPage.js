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
const {
  humanMouseMovements,
  clickWhenVisible,
  waitForStateChange,
  logActions
} = require('../../utils');
const { addressManager } = require('../utils/addressManager.js');
const { preOrderPage } = require('./preOrderPage.js');   // <‑‑‑ добавлен импорт

const CART_URL = 'https://checkout12.iherb.com/cart';
const MODULES = {
  removeItems: true,     // очистка
  addItems: true,        // добавление
  setCartParams: true,   // настройка параметров корзины
  applyCoupon: true,     // применение купонов/реферальных кодов
  checkSumm: true        // проверка общей суммы
};

async function handleCart(page, finalParams) {
  
  // Шаг 0: Выбор адреса доставки из адресной книги
  // Перед загрузкой config.js очищаем кеш, чтобы подхватить новые значения
 
  const config = require('../../config.js');
  const adressList = require('../../../data/adressBook/adressList.json');



  console.log(`[cartPage] -> Всего адресов: ${adressList.length}`);
  let index = Number(config.defaultAdress);
  if (isNaN(index) || index < 0 || index >= adressList.length) {
    console.warn(`[cartPage] -> Некорректный индекс адреса в config.js: ${config.defaultAdress}. Используем индекс 0.`);
    index = 0;
  }







  // Шаг 1: Переходим на страницу корзины
  console.log(`[cartPage] -> Переход к: ${CART_URL}`);
  await safeGoto(page, CART_URL, {
    waitUntil: 'networkidle2',
    timeout: 15000,   // максимальное время ожидания
    maxRetries: 1,    // число повторных попыток
    extraWait: 0      // дополнительное ожидание после загрузки
  });
  await safeWaitForLoad(page, 0);

  // Шаг 2: Закрываем туториал, если есть
  console.log('[cartPage] -> Закрываем туториал, если он есть...');
  await closeTutorialIfPresent(page);

  // Шаг 3: Очистка
  if (MODULES.removeItems) {
    await removeItemsIfNeeded(page);
  }

  // Шаг 4: Добавление товаров
  if (MODULES.addItems) {
    await addItemsIfNeeded(page, finalParams.cartLink);
  }

  // Шаг 5: Ожидание загрузки после изменений
  console.log('[cartPage] -> Ждём safeWaitForLoad (после добавления)...');
  try {
    await safeWaitForLoad(page, 0);
    console.log('[cartPage] -> Страница загружена после добавления.');
  } catch (errWait) {
    console.log('[cartPage] -> Ошибка safeWaitForLoad:', errWait);
  }

  // Шаг 6: Настройка параметров корзины
  if (MODULES.setCartParams) {
    try {
      console.log('[cartPage] -> Вызываем setCartParams...');
      await setCartParams(page);
      console.log('[cartPage] -> setCartParams завершён.');
    } catch (errParams) {
      console.log('[cartPage] -> Ошибка в setCartParams:', errParams);
    }
  }

  // Шаг 7: Применение купонов и реферальных кодов
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

  // Минимизируем задержку: плавные движения мыши и небольшой скролл
  await humanMouseMovements(page, 500);
  await page.evaluate(() => window.scrollBy(0, 200));
  await sleep(500);

  // Шаг 8: Проверка общей суммы заказа
  let cartResult = {};
  if (MODULES.checkSumm) {
    const maxSum = finalParams.maxSum || 200;
    cartResult = (await checkSumm(page, maxSum)) || {};
  }

  // Передача метаданных для следующего шага
  const orderMeta = {
    client: finalParams.client,
    clientId: finalParams.clientId,
    cartLink: finalParams.cartLink,
    orderID: finalParams.orderID
  };
  const success = await preOrderPage(page, cartResult, orderMeta);
  return success;  
}

module.exports = { handleCart, MODULES };
