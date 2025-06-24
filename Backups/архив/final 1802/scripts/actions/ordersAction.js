// scripts/actions/ordersAction.js

const defaultConfig = require('./ordersConfig');
const userInputConfig = require('./ordersInputConfig');
const { logActions, sleep } = require('../utils');

/**
 * Если нужно — принимаем параметры (data.params) для переопределения,
 * но пока что просто работаем с ordersConfig / ordersInputConfig.
 */
function mergeOrderParams() {
  const finalParams = {};

  // Пример списка ключей
  const keys = [
    'account',
    'promoCode',
    'referralCode',
    'cartUrl',
    'client',
    'currency',
    // ...
  ];

  keys.forEach((key) => {
    const userVal = userInputConfig[key];
    if (!userVal || userVal === 'default') {
      finalParams[key] = defaultConfig[key];
    } else {
      finalParams[key] = userVal;
    }
  });

  return finalParams;
}

/**
 * Черновой вариант оформления заказа.
 * Пока что просто открывает cartUrl и выводит в консоль.
 */
async function startOrderProcess(page, ws, finalParams) {
  console.log('[ordersAction] -> Итоговые параметры:');
  console.log(finalParams);

  // Открываем корзину
  const cartLink = finalParams.cartUrl || 'https://www.iherb.com/cart';
  await page.goto(cartLink, { waitUntil: 'networkidle2' });
  await logActions(`Открыта корзина: ${cartLink}`, ws, 'in-progress');

  // TODO: Заполнить форму, применить промокод, оплатить, и т.д.
  await sleep(2000);
}

module.exports = {
  mergeOrderParams,
  startOrderProcess
};
