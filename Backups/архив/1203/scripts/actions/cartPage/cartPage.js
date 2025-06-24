/**
 * cartPage.js (контролирующий модуль handleCart)
 * -----------------------------------------------------------------------------
 * Логика:
 *   1) Переходит на страницу корзины.
 *   2) Закрывает туториал, если есть.
 *   3) (Опц.) removeItemsIfNeeded(...) – очистка
 *   4) (Опц.) addItemsIfNeeded(...) – добавление
 *   5) safeWaitForLoad(...)
 *   6) (Опц.) setCartParams(...)
 *   7) (Опц.) applyCoupon(...)
 *   8) (Опц.) checkSumm(...)
 */

const { closeTutorialIfPresent } = require('./cartTutorial');
const { applyCoupon } = require('./applyCoupon.js');
const { safeWaitForLoad } = require('../utils/pageLoadHelper.js');
const { setCartParams } = require('./setCartParams.js');
const { removeItemsIfNeeded } = require('./removeItems.js');
const { addItemsIfNeeded } = require('./addItems.js');
const { checkSumm } = require('./checkSumm.js');

const CART_URL = 'https://checkout12.iherb.com/cart';

/**
 * Настройки модулей: on/off (true/false)
 * Можно переключать в любой момент.
 */
const MODULES = {
  removeItems: false,     // очистка
  addItems: false,        // добавление
  setCartParams: true,   // настройка страны/валюты/доставки
  applyCoupon: true,     // применение промо/реф.кодов
  checkSumm: true        // проверка суммы
};

async function handleCart(page, finalParams) {
  console.log('[cartPage] -> Начало handleCart()');

  // 1) Переходим на страницу корзины
  console.log(`[cartPage] -> Переход к: ${CART_URL}`);
  await page.goto(CART_URL, { waitUntil: 'networkidle2' });

  // 2) Закрываем туториал, если есть
  await closeTutorialIfPresent(page);

  // 3) Очистка (если включено)
  if (MODULES.removeItems) {
    await removeItemsIfNeeded(page);
  }

  // 4) Добавление (если включено)
  if (MODULES.addItems) {
    await addItemsIfNeeded(page, finalParams.cartLink);
  }

  // 5) Ждём safeWaitForLoad
  console.log('[cartPage] -> Ждём safeWaitForLoad...');
  try {
    await safeWaitForLoad(page, 2000);
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

  // 8) Проверяем сумму (если включено)
  let cartResult;
  if (MODULES.checkSumm) {
    const maxSum = finalParams.maxSum || 200;
    console.log(`[cartPage] -> checkSumm() c лимитом=$${maxSum}`);
    cartResult = await checkSumm(page, maxSum);
  }

  console.log('[cartPage] -> handleCart() завершён.');
  return cartResult;
}

module.exports = { handleCart, MODULES };
