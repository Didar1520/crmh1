/**
 * orderManager.js
 * -----------------------------------------------------------------------------
 * Обновлённая логика:
 *  1) Если меняется аккаунт, закрываем предыдущий browser, создаём новый, проверяем авторизацию.
 *  2) Если есть cartLink, сначала addressManager + handleCart (процесс заказа). При успехе запускаем sync-функции.
 *  3) Если cartLink нет, сразу запускаем sync-функции.
 *  4) Sync-флаги выполняются строго в порядке, указанном в объекте inputConfig.json.
 *  5) Убраны старые заглушки и старый архаичный "item.sync".
 */

const fs = require('fs');
const path = require('path');
const bus = require('../core/eventBus');
const { waitIfPaused, shouldAbort } = require('../core/controlFlags');

const config = require('../config.js');
const { authorize } = require('../auth.js');
const { launchBrowserForAccount } = require('../browserManager.js');
const { handleCart } = require('./cartPage/cartPage.js');

// Модули синхронизаций:
const { syncOrders } = require('../sync/orders.js');
const { syncReviews } = require('../sync/reviews.js');
const { syncRewards } = require('../sync/rewards.js');
const { syncOrderedProducts } = require('../sync/orderedProducts.js');
const { reviewManager } = require('./utils/reviewManager.js');



// Задержка вместо page.waitForTimeout
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
    client: !isEmpty(item.client) ? item.client : config.client,
    orderID: !isEmpty(item.orderID) ? item.orderID : null
  };
}

/**
 * Проверяет текущего пользователя через запрос /catalog/currentUser.
 * Возвращает true, если email совпадает с expectedEmail.
 */
async function isUserAuthorized(page, expectedEmail) {
  try {
    // Заходим на главную страницу (kz.iherb.com), чтобы куки подтянулись
    await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2', timeout: 60000 });

    // Запрашиваем /catalog/currentUser
    const userData = await page.evaluate(async () => {
      try {
        const resp = await fetch('https://catalog.app.iherb.com/catalog/currentUser', {
          method: 'GET',
          credentials: 'include'
        });
        if (!resp.ok) return null;
        return resp.json(); // { email: "...", ... }
      } catch (err) {
        bus.emit('error', { idx: i, message: err.message });
        return null;
      }
    });
    if (!userData || !userData.email) {
      console.log('[orderManager] -> currentUser.email не найден => не авторизован');
      return false;
    }

    const currentEmail = userData.email.trim().toLowerCase();
    const neededEmail = expectedEmail.trim().toLowerCase();
    console.log(`[orderManager] -> currentUser email = ${currentEmail}, нужно: ${neededEmail}`);
    return currentEmail === neededEmail;

  } catch (error) {
    console.log('[orderManager] -> Ошибка при проверке /catalog/currentUser:', error);
    return false;
  }
}

/**
 * Выполняет sync-флаги из item в порядке следования свойств.
 * Для syncOrders, syncReviews, syncRewards, syncOrderedProducts передаём (page, ws, {})
 * Для reviewManager() ничего не передаём.
 */
async function handleSyncFlags(item, page) {
  const ws = null; // пока передаём null вместо реального WebSocket

  const keysInOrder = Object.keys(item); // Сохраняет порядок свойств
  for (const key of keysInOrder) {
    if (key === 'syncOrders' && item[key] === true) {
      console.log('[orderManager] -> Запуск syncOrders...');
      await syncOrders(page, ws, {});
    }
    else if (key === 'syncReviews' && item[key] === true) {
      console.log('[orderManager] -> Запуск syncReviews...');
      await syncReviews(page, ws, {});
    }
    else if (key === 'syncRewards' && item[key] === true) {
      console.log('[orderManager] -> Запуск syncRewards...');
      await syncRewards(page, ws, {});
    }
    else if (key === 'syncOrderedProducts' && item[key] === true) {
      console.log('[orderManager] -> Запуск syncOrderedProducts...');
      await syncOrderedProducts(page, ws, {});
    }
    else if (key === 'reviewManager' && item[key] === true) {
      console.log('[orderManager] -> Запуск reviewManager...');
      reviewManager();
    }
  }
}

// Основная функция
async function processAllOrders() {
  console.log('[orderManager] -> processAllOrders(): Начинаем обрабатывать inputConfig.json');
    let inputOrders = [];
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'inputConfig.json'),
      'utf8'
    );
    inputOrders = JSON.parse(raw);
    if (!Array.isArray(inputOrders)) inputOrders = [];
  } catch {
    inputOrders = [];
  }
  if (inputOrders.length === 0) {
    console.log('[orderManager] -> Нет данных в inputConfig.json, выходим.');
    return { status: false, message: 'inputConfig.json is empty' };
  }

  let currentBrowser = null;
  let currentPage = null;
  let currentAccount = '';


  bus.emit('log', '[orderManager] -> старт обработки inputConfig');

  for (let i = 0; i < inputOrders.length; i++) {

           await waitIfPaused();          // если в UI нажали "Pause" – здесь скрипт замирает
           if (shouldAbort) {             // если нажали "Stop"
             bus.emit('error', { idx: i, message: 'Остановлено пользователем' });
             throw new Error('Aborted by user');
           }
           const item = inputOrders[i];   // ← новая строка
           // --- шлём событие «шаг начат» ---
           bus.emit('step', { idx: i, status: 'start', account: item.Account });

    // Сливаем поля
    const finalParams = mergeParams(item);
    const nextAccount = finalParams.account || '';

    // Если аккаунт сменился => закрываем предыдущий браузер, открываем новый
    if (nextAccount.toLowerCase() !== currentAccount.toLowerCase()) {
      if (currentBrowser) {
        console.log(`[orderManager] -> Аккаунт сменился (${currentAccount} -> ${nextAccount}), закрываем старый браузер.`);
        await currentBrowser.close().catch(() => {});
        currentBrowser = null;
        currentPage = null;
      }

      console.log(`[orderManager] -> Открываем браузер для аккаунта: ${nextAccount}`);
      const { browser, page } = await launchBrowserForAccount({ accountEmail: nextAccount });
      currentBrowser = browser;
      currentPage = page;
      currentAccount = nextAccount;

      // Проверяем авторизацию
      const alreadyAuth = await isUserAuthorized(currentPage, nextAccount);
      if (!alreadyAuth) {
        console.log(`[orderManager] -> Не авторизован, вызываем authorize для ${nextAccount}.`);
        const authOk = await authorize(currentPage, { login: nextAccount, password: '' }, null);
        if (!authOk) {
          console.log(`[orderManager] -> Авторизация не удалась для ${nextAccount}, пропускаем шаги.`);
          continue;
        }
        console.log(`[orderManager] -> Авторизация ОК для ${nextAccount}`);
      } else {
        console.log('[orderManager] -> Уже авторизован, пропускаем authorize().');
      }
    } else {
      console.log(`[orderManager] -> Аккаунт тот же (${nextAccount}), переиспользуем браузер.`);
    }

    // Если есть CartLink => запускаем handleCart, а потом синхронизацию

      if (!isEmpty(finalParams.cartLink)) {
        console.log('[orderManager] -> Запускаем handleCart()…');
        let success = false;
        try {
          success = await handleCart(currentPage, finalParams);
        } catch (errCart) {
          console.log('[orderManager] -> Ошибка в handleCart:', errCart);
        }
        if (!success) {
          console.log('[orderManager] -> handleCart неуспешен, пропускаем синхронизацию.');
          bus.emit('error', { idx: i, message: 'handleCart failed' });
          continue;
        }
        await handleSyncFlags(item, currentPage);   // ← только если success
      } else {
        await handleSyncFlags(item, currentPage);
      }

    console.log(`[orderManager] -> Элемент #${i} обработан.`);
    bus.emit('step', { idx: i, status: 'done' });
  }

  // После всех итераций закрываем браузер
  if (currentBrowser) {
    console.log('[orderManager] -> Закрываем браузер после обработки всех элементов.');
    // await currentBrowser.close().catch(() => {});
  }

  console.log('[orderManager] -> processAllOrders() завершён.');
  return { status: true, message: 'All orders processed' };
}

// Если запускаем напрямую
if (require.main === module) {
  processAllOrders();
}

module.exports = { processAllOrders };
