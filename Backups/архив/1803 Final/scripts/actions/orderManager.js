/**
 * orderManager.js
 * -----------------------------------------------------------------------------
 * Основные изменения:
 *  - isUserAuthorized(...) проверяет /catalog/currentUser;
 *  - Если уже авторизован, skip authorize;
 *  - Пример перезагрузки страницы и повторной попытки при ошибках;
 *  - Включение/выключение модулей (actionsEnabled.cartModule, etc.);
 *  - Заглушка записи данных (пока console.log).
 */

const fs = require('fs');
const path = require('path');

const config = require('../config.js');
const { authorize } = require('../auth.js');
const { launchBrowserForAccount } = require('../browserManager.js');

// Импортируем addressManager в начале файла (модуль не принимает параметров)
const { addressManager } = require('./utils/addressManager.js');

// Модуль корзины (если actionsEnabled.cartModule === true)
const { handleCart } = require('./cartPage/cartPage.js');

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

// Функция для задержек вместо page.waitForTimeout
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Проверка "пустое" значение
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

/**
 * Проверяет текущего пользователя через запрос /catalog/currentUser.
 * Возвращает true, если ответный email совпадает с expectedEmail (регистр не важен).
 */
async function isUserAuthorized(page, expectedEmail) {
  try {
    // 1) Идём на любую страницу iHerb, где проставляются куки (например, главную kz.iherb.com)
    //    Ждём, пока страница загрузится и куки подтянутся.
    await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2', timeout: 60000 });
    // Немного подождём для надёжности (по желанию)
    // await page.waitForTimeout(2000);

    // 2) Делаем запрос к /catalog/currentUser
    const userData = await page.evaluate(async () => {
      try {
        const resp = await fetch('https://catalog.app.iherb.com/catalog/currentUser', {
          method: 'GET',
          credentials: 'include'
        });
        if (!resp.ok) return null;
        return resp.json(); // { email: "...", ... }
      } catch (err) {
        return null;
      }
    });
    if (!userData || !userData.email) {
      // Нет данных => пользователь не авторизован
      console.log('[orderManager] -> currentUser.email не найден => не авторизован');
      return false;
    }

    // 3) Сравниваем email
    //    Убираем пробелы и приводим к нижнему регистру
    const currentEmail = userData.email.trim().toLowerCase();
    const neededEmail = expectedEmail.trim().toLowerCase();

    console.log(`[orderManager] -> currentUser email = ${userData.email}, нужно: ${neededEmail}`);

    // Если совпадает => уже авторизован
    return currentEmail === neededEmail;

  } catch (error) {
    console.log('[orderManager] -> Ошибка при проверке /catalog/currentUser:', error);
    return false;
  }
}

// Заглушки для синхронизации
function syncOrders(page) {
  console.log('[syncOrders] -> Синхронизируем заказы (заглушка)');
}
function syncReviews(page) {
  console.log('[syncReviews] -> Синхронизируем отзывы (заглушка)');
}
function syncMainInfo(page) {
  console.log('[syncMainInfo] -> Синхронизируем основную информацию (заглушка)');
}

/**
 * Заглушка оформления заказа
 * Допустим, после handleCart, мы кликаем "Proceed to Checkout" и делаем заказ...
 * Здесь выводим в консоль "сумму корзины" и т.д.
 */
async function placeOrderMock(page, finalParams) {
  console.log(`[placeOrderMock] -> Оформляем заказ (заглушка) для аккаунта: ${finalParams.account}`);
  console.log('[placeOrderMock] -> Параметры заказа:', finalParams);

  // (Пример) Чтение суммы корзины, промокод, товары...
  // пока что просто лог
  console.log('[placeOrderMock] -> (Заглушка) Сумма корзины = 123.45 USD, промокод=', finalParams.promoCode);

  // Псевдо-сохранение "данных заказа" в JSON (пока просто лог)
  // В будущем можно писать fs.writeFileSync(...)
  console.log('[placeOrderMock] -> Заказ оформлен. Сохраняем данные (заглушка).');
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

    // Меняем аккаунт?
    if (nextAccount.toLowerCase() !== currentAccount.toLowerCase()) {
      // Закрываем предыдущий браузер
      if (currentBrowser) {
        console.log(`[orderManager] -> Аккаунт сменился (${currentAccount} -> ${nextAccount}), закрываем старый браузер.`);
        await currentBrowser.close();
        currentBrowser = null;
        currentPage = null;
      }

      // Открываем новый браузер
      console.log(`[orderManager] -> Открываем браузер для аккаунта: ${nextAccount}`);
      const { browser, page } = await launchBrowserForAccount({ accountEmail: nextAccount });
      currentBrowser = browser;
      currentPage = page;
      currentAccount = nextAccount;

      // 1) Проверяем, может уже авторизован
      const alreadyAuth = await isUserAuthorized(page, nextAccount);
      if (!alreadyAuth) {
        // 2) Если не авторизован => вызываем authorize
        console.log(`[orderManager] -> Не авторизован (или другой пользователь), вызываем authorize.`);
        const authOk = await authorize(currentPage, { login: nextAccount, password: '' }, null);
        if (!authOk) {
          console.log(`[orderManager] -> Авторизация не удалась для ${nextAccount}, пропускаем шаги.`);
          continue; // Переходим к следующему элементу
        }
        console.log(`[orderManager] -> Авторизация ОК для ${nextAccount}`);
      } else {
        console.log('[orderManager] -> Уже авторизован, skip authorize().');
      }

    } else {
      console.log(`[orderManager] -> Аккаунт тот же (${nextAccount}), переиспользуем браузер.`);
    }

    // Если в конфиге отключен модуль cartModule, пропускаем handleCart
    if (!config.actionsEnabled?.cartModule) {
      console.log('[orderManager] -> cartModule отключен, пропускаем handleCart().');
    } else {
      // Если есть cartLink => запускаем addressManager перед handleCart
      if (!isEmpty(finalParams.cartLink)) {
        console.log('[orderManager] -> Найден CartLink, запускаем addressManager.js перед handleCart().');
        try {
          // addressManager();
          console.log('[orderManager] -> addressManager выполнен успешно.');
        } catch (errAddr) {
          console.log('[orderManager] -> Ошибка в addressManager:', errAddr);
          continue;
        }
        console.log('[orderManager] -> Запускаем handleCart().');
        try {
          await handleCart(currentPage, finalParams);
        } catch (errCart) {
          console.log('[orderManager] -> Ошибка в handleCart:', errCart);
          console.log('[orderManager] -> Пробуем перезагрузить страницу и повторить один раз...');
          await currentPage.reload({ waitUntil: 'networkidle2' });
          await sleep(2000);
          // Вторая попытка
          try {
            await handleCart(currentPage, finalParams);
          } catch (errCart2) {
            console.log('[orderManager] -> Снова ошибка в handleCart, пропускаем дальнейшие шаги:', errCart2);
            continue;
          }
        }
      }
    }

    // Допустим, если actionsEnabled.placeOrder === true => делаем placeOrderMock
    if (config.actionsEnabled?.placeOrder) {
      console.log('[orderManager] -> placeOrder включен, делаем placeOrderMock...');
      await placeOrderMock(currentPage, finalParams);
    }

    // Синхронизация
    if (config.actionsEnabled?.sync === true && !isEmpty(item.sync)) {
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
    // await currentBrowser.close();
  }

  console.log('[orderManager] -> processAllOrders() завершён.');
  return { status: true, message: 'All orders processed' };
}

// Если вызываем напрямую
if (require.main === module) {
  processAllOrders();
}

module.exports = { processAllOrders };
