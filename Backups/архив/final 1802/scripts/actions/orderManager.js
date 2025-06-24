// scripts/actions/orderManager.js
/**
 * orderManager.js (полная версия, исправленная).
 * ---------------------------------------------
 * 1) Читает inputConfig.json (если есть).
 * 2) В цикле идёт по каждому элементу:
 *    - Если аккаунт меняется, закрываем старый браузер, открываем новый.
 *    - Авторизуемся (auth.js).
 *    - Если CartLink => вызываем handleCart(...) (очистка + добавление товаров).
 *    - Если sync => делим по запятой, вызываем syncOrders, syncReviews, syncMainInfo.
 * 3) По завершении всех элементов закрываем браузер.
 */

const fs = require('fs');
const path = require('path');

// Подключаем config.js, auth.js, browserManager.js, cartPage.js
const config = require('../config.js');
const { authorize } = require('../auth.js');
const { launchBrowserForAccount } = require('../browserManager.js');
const { handleCart } = require('./cartPage.js');

// Подгружаем inputConfig.json
let inputOrders = [];
try {
  inputOrders = require('../inputConfig.json');
  if (!Array.isArray(inputOrders)) {
    inputOrders = [];
  }
} catch (err) {
  console.log('[orderManager] -> Не удалось загрузить inputConfig.json, работаем без него.');
  inputOrders = [];
}

// Проверка на "пустое" значение
function isEmpty(val) {
  if (!val) return true;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    return lower === '' || lower === 'none';
  }
  return false;
}

// Сливаем поля из item с config.js
function mergeParams(item) {
  return {
    account: !isEmpty(item.Account) ? item.Account : config.account,
    promoCode: !isEmpty(item.Promocode) ? item.Promocode : config.promoCode,
    referralCode: !isEmpty(item.rederalLink) ? item.rederalLink : config.referralCode,
    cartLink: !isEmpty(item.CartLink) ? item.CartLink : config.cartUrl,
    client: !isEmpty(item.ClientName) ? item.ClientName : config.client
  };
}

// Заглушки для синхронизации
function syncOrders(page) {
  console.log('[syncOrders] -> Синхронизуем заказы (заглушка)');
}
function syncReviews(page) {
  console.log('[syncReviews] -> Синхронизуем отзывы (заглушка)');
}
function syncMainInfo(page) {
  console.log('[syncMainInfo] -> Синхронизуем основную информацию (заглушка)');
}

// Заглушка для "placeOrder" (если нужно дополнительно)
async function placeOrderMock(page, finalParams) {
  console.log(`[placeOrderMock] -> Оформляем заказ (заглушка) для аккаунта: ${finalParams.account}`);
  console.log('[placeOrderMock] -> Параметры заказа:', finalParams);
  // Сюда можно вставить логику post-check
}

// Основная функция
async function processAllOrders() {
  console.log('[orderManager] -> processAllOrders(): Начинаем обрабатывать inputConfig.json');
  if (inputOrders.length === 0) {
    console.log('[orderManager] -> Нет данных в inputConfig.json, выходим.');
    return { status: false, message: 'inputConfig.json is empty' };
  }

  let currentBrowser = null;
  let currentPage = null;
  let currentAccount = '';

  for (let i = 0; i < inputOrders.length; i++) {
    const item = inputOrders[i];
    console.log(`\n[orderManager] -> Обрабатываем элемент #${i}:`, item);

    // Сливаем поля
    const finalParams = mergeParams(item);
    const nextAccount = finalParams.account || '';

    // Если аккаунт меняется => закрываем старый, открываем новый браузер
    if (nextAccount.toLowerCase() !== currentAccount.toLowerCase()) {
      if (currentBrowser) {
        console.log(`[orderManager] -> Аккаунт сменился (${currentAccount} -> ${nextAccount}), закрываем старый браузер.`);
        await currentBrowser.close();
        currentBrowser = null;
        currentPage = null;
      }

      console.log(`[orderManager] -> Открываем браузер для аккаунта: ${nextAccount}`);
      const { browser, page } = await launchBrowserForAccount({ accountEmail: nextAccount });
      currentBrowser = browser;
      currentPage = page;
      currentAccount = nextAccount;

      // Авторизация
      console.log(`[orderManager] -> Авторизуемся под "${nextAccount}" (пароль="")`);
      const authOk = await authorize(currentPage, { login: nextAccount, password: '' }, null);
      if (!authOk) {
        console.log(`[orderManager] -> Авторизация не удалась для ${nextAccount}, пропускаем шаги.`);
        continue;
      }
      console.log(`[orderManager] -> Авторизация ОК для ${nextAccount}`);
    } else {
      // Тот же аккаунт => переиспользуем
      console.log(`[orderManager] -> Аккаунт тот же (${nextAccount}), переиспользуем браузер.`);
    }

    // Если CartLink => вызываем handleCart
    if (!isEmpty(finalParams.cartLink)) {
      console.log('[orderManager] -> Найден CartLink => вызываем handleCart()');
      await handleCart(currentPage, finalParams);

      // При желании сразу after cartPage:
      // await placeOrderMock(currentPage, finalParams);
    }

    // Если sync => разбираем
    if (!isEmpty(item.sync)) {
      console.log(`[orderManager] -> Нужно сделать синхронизацию: "${item.sync}"`);
      const syncList = item.sync.split(',').map(s => s.trim().toLowerCase());

      for (const syncItem of syncList) {
        if (syncItem === 'orders') {
          syncOrders(currentPage);
        } else if (syncItem === 'reviews') {
          syncReviews(currentPage);
        } else if (syncItem === 'maininfo') {
          syncMainInfo(currentPage);
        } else {
          console.log(`[orderManager] -> Неизвестный тип синхронизации: ${syncItem}`);
        }
      }
      console.log('[orderManager] -> Синхронизация (заглушка) завершена.');
    }

    console.log(`[orderManager] -> Элемент #${i} обработан.`);
  }

  // Закончили все итерации => закрываем браузер
  if (currentBrowser) {
    console.log('[orderManager] -> Закрываем браузер после обработки всех элементов.');
    await currentBrowser.close();
  }

  console.log('[orderManager] -> processAllOrders() завершён.');
  return { status: true, message: 'All orders processed' };
}

// Если напрямую запустить (node orderManager.js), тестируем
if (require.main === module) {
  processAllOrders();
}

module.exports = { processAllOrders };
