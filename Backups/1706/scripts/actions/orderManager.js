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


let totalOrders      = 0;
let completedCnt     = 0;
let bookedCnt        = 0;
let errorCnt         = 0;
let usdCompletedSum  = 0;
let usdBookedSum     = 0;
const clientOrders   = {};   // { client: [numbers] }


const failedOrders = [];   // массив { idx, reason, screenshot }
const shotDir      = 'D:\\Didar1520\\CRM\\logs\\screens';
if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });

const processedOrders = [];   // { idx, client, orderNumber, status }




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
 * Если в DOM есть .username-my-account-container, а API считает, что мы не залогинены,
 * отправляемся на /account/logoff, чтобы сбросить «залипший» сеанс.
 */
async function forceLogoffIfGhost(page) {
  try {
    const ghost = await page.evaluate(() =>
      !!document.querySelector('.username-my-account-container')
    );
    if (ghost) {
      console.log('[auth] → Обнаружен призрачный логин в шапке. Делаем logoff…');
      await page.goto('https://checkout12.iherb.com/account/logoff',
        { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await sleep(1500);   // небольшая пауза
    }
  } catch (_) { /* игнор */ }
}




/**
 * ensureAuthThen(page, expectedEmail, fn)
 * Проверяет авторизацию; если вышли — логинится и потом вызывает fn().
 * fn — асинхронная функция-шаг (handleCart, syncReviews …)
 */
async function ensureAuthThen(page, expectedEmail, fn) {
  const ok = await isUserAuthorized(page, expectedEmail);
  if (!ok) {
      await forceLogoffIfGhost(page);
    console.log('[ensureAuth] → Обнаружен выход из аккаунта. Повторная авторизация…');
    const authOk = await authorize(page, { login: expectedEmail, password: '' }, null);
    if (!authOk) throw new Error('re-login failed');
    console.log('[ensureAuth] → Авторизация восстановлена.');
  }
  return fn();            // выполняем переданную функцию
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
      await reviewManager(page, null);
}
  }
}

// Основная функция
async function processAllOrders() {

    // сбрасываем все данные перед каждой новой сессией
  totalOrders      = 0;
  completedCnt     = 0;
  bookedCnt        = 0;
  errorCnt         = 0;
  usdCompletedSum  = 0;
  usdBookedSum     = 0;

  failedOrders.length    = 0;   // очищаем массивы
  processedOrders.length = 0;
  for (const key in clientOrders) delete clientOrders[key];


  console.log('[orderManager] -> processAllOrders(): Начинаем обрабатывать inputConfig.json');
    let inputOrders = [];
    try {
      const cfgPath = path.join(__dirname, '..', 'inputConfig.json');
      const raw = fs.readFileSync(cfgPath, 'utf8');
    
      console.log('DEBUG ▸ inputConfig путь:', cfgPath);
      console.log('DEBUG ▸ первые 200 символов файла:\n', raw.slice(0, 200));
    
      inputOrders = JSON.parse(raw);          // ← может бросить ошибку
      totalOrders = inputOrders.length;
    
      if (!Array.isArray(inputOrders)) inputOrders = [];
    } catch (err) {
      console.log('DEBUG ▸ ошибка чтения/парсинга inputConfig:', err.message);
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
    // Проверяем авторизацию
const alreadyAuth = await isUserAuthorized(currentPage, nextAccount);
if (!alreadyAuth) {
  // Если API считает, что мы вышли, а кнопки «Войти» нет — сбрасываем «залипший» сеанс
  await forceLogoffIfGhost(currentPage);
  // Перезагружаем главную, чтобы кнопка «Войти» точно появилась
  await currentPage.goto('https://kz.iherb.com', { waitUntil: 'networkidle2', timeout: 30000 });

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
        
        console.log(`[orderManager] -> Запускаем handleCart() для шага #${i + 1}…`);
        let res;
        try {
          res = await ensureAuthThen(currentPage, nextAccount, () =>
        handleCart(currentPage, finalParams));

        } catch (errCart) {
          errorCnt++;
          console.log(`[orderManager] -> Order #${i + 1} ERROR ▸ ${errCart.message}`);
          bus.emit('error', { idx: i, message: errCart.message });
          continue;
        }
        
      if (!res || !res.success) {
  errorCnt++;

  // --------‑‑ делаем скриншот текущей страницы ------------
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19);
  const shotPath = `${shotDir}\\fail_step${i+1}_${stamp}.png`;
  try {
    await currentPage.screenshot({ path: shotPath, fullPage: true });
  } catch (_) { /* если не удалось — ладно */ }
  // --------------------------------------------------------

  const why = res?.error || (res ? 'unknown' : errCart?.message || 'js error');
  failedOrders.push({ idx: i + 1, reason: why, screenshot: shotPath });

  processedOrders.push({
  idx:    i + 1,
  client: finalParams.client || '—',
  orderNumber: 'ошибка',
  status: 'ошибка'
});

  console.log(`[orderManager] -> Order #${i + 1} ERROR ▸ ${why}`);
  bus.emit('error', { idx: i, message: why });
  continue;
}

        
        const rec = res.record;
        if (res.type === 'booked') {
          bookedCnt++;
          usdBookedSum += rec.price.usd;
        } else {
          completedCnt++;
          usdCompletedSum += rec.price.usd;
        }
        
        const cl = rec.client || '—';
        clientOrders[cl] ??= [];
        clientOrders[cl].push(rec.orderNumber);
        
        processedOrders.push({
  idx:      i + 1,
  client:   cl,
  orderNumber: rec.orderNumber,
  status:   res.type            // 'completed' | 'booked'
});

        console.log(`[orderManager] -> Order #${i + 1} ${res.type.toUpperCase()} ▸ ${rec.orderNumber} (${cl})`);
        
        await ensureAuthThen(currentPage, nextAccount,
       () => handleSyncFlags(item, currentPage));

        } else {
        await ensureAuthThen(currentPage, nextAccount,
       () => handleSyncFlags(item, currentPage));

      }

    console.log(`[orderManager] -> Элемент #${i} обработан.`);
    bus.emit('step', { idx: i, status: 'done' });
  }




  // ===== Итоговый отчёт =====
  const totalUsd = usdCompletedSum + usdBookedSum;

  let report = `Отчёт ${fmtDate()}\n` +
               `Обработано шагов: ${totalOrders}\n` +
               `Успешных заказов: ${completedCnt}\n` +
               `Заказов забронировано: ${bookedCnt}\n` +
               `Заказов с ошибками: ${errorCnt}\n` +
               `Сумма заказанных корзин: ${usdCompletedSum.toFixed(2)} USD\n` +
               `Сумма заказов в брони: ${usdBookedSum.toFixed(2)} USD\n` +
               `Общая сумма: ${totalUsd.toFixed(2)} USD\n\n` +
               `Номера заказов и статус:\n`;

  // подробный список всех попыток
  processedOrders.forEach(p => {
    report += `  Шаг ${p.idx} ▸ ${p.orderNumber} (${p.client}) — ${p.status}\n`;
  });

  if (failedOrders.length) {
    report += '\nОшибки:\n';
    failedOrders.forEach(f => {
      report += `  Шаг ${f.idx}: ${f.reason}\n           скрин → ${f.screenshot}\n`;
    });
  }

  console.log('\n' + report);


const logsDir = 'D:\\Didar1520\\CRM\\logs';
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const repFile = `${logsDir}\\report_${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.txt`;

console.log(`[orderManager] -> Итоговый отчёт сохранён в ${repFile}`);
// ==========================


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

function fmtDate() {
  return new Date().toLocaleString('ru-RU', { hour12: false });
}


module.exports = { processAllOrders };
