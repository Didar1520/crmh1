/**
 * searchOrder.js
 * -----------------------------------------------------------------------------
 * Ищет заказы по номерам в аккаунтах, указанных в accData.json.
 * 1) Берёт массив номеров (жёстко прописан в коде).
 * 2) Читает accData.json -> accounts[]. Для каждого аккаунта:
 *    - Открывает/запускает профиль (launchBrowserForAccount).
 *    - Проверяет авторизацию через isUserAuthorized().
 *      - Если не авторизован, вызывает authorize().
 *    - Идёт на https://secure.iherb.com/myaccount/orders
 *    - Ищет каждый заказ (если уже не найден ранее).
 *    - Если все заказы найдены, досрочно завершается.
 * 3) Пишет результат в foundOrders.json и выводит в консоль.
 */

const fs = require('fs');
const path = require('path');

const { launchBrowserForAccount } = require('../../browserManager.js');
const { authorize } = require('../../auth.js'); // реальный модуль авторизации

/** Путь к accData.json (список аккаунтов) */
const accDataPath = path.join(__dirname, '../../../data/AccData/accData.json');
/** Путь, куда записываем результат */
const foundOrdersPath = path.join(__dirname, './foundOrders.json');

/** Жёстко прописанный массив номеров заказов */
const ORDERS_TO_FIND = [
  '533095857',
  '533079357',
  '533229993',
  '533230901',
  '533231326'
];

/** Простая задержка (вместо page.waitForTimeout) */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Проверяем, авторизован ли email через /catalog/currentUser
 */
async function isUserAuthorized(page, expectedEmail) {
  try {
    await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2', timeout: 60000 });

    const userData = await page.evaluate(async () => {
      try {
        const resp = await fetch('https://catalog.app.iherb.com/catalog/currentUser', {
          method: 'GET',
          credentials: 'include'
        });
        if (!resp.ok) return null;
        return await resp.json();
      } catch {
        return null;
      }
    });

    if (!userData || !userData.email) {
      console.log('[searchOrder] -> currentUser.email не найден => не авторизован');
      return false;
    }
    const currentEmail = userData.email.trim().toLowerCase();
    const neededEmail = expectedEmail.trim().toLowerCase();
    console.log(`[searchOrder] -> currentUser = ${currentEmail}, нужно: ${neededEmail}`);
    return (currentEmail === neededEmail);

  } catch (error) {
    console.log('[searchOrder] -> Ошибка в isUserAuthorized:', error);
    return false;
  }
}

/**
 * Ищем один заказ (orderNumber) на странице /myaccount/orders
 * Возвращает true, если нашли, иначе false.
 */
async function searchSingleOrder(page, orderNumber) {
  console.log(`[searchOrder] -> Ищем заказ: ${orderNumber}`);

  const SEARCH_INPUT_SELECTOR = 'input.form-control.search-input-rd';
  const EMPTY_STATE_SELECTOR = 'div.empty-state.order-history';
  const ORDER_HEADER_SELECTOR = 'section.col-xs-24.order-header-section';

  // 1) Ждём поле ввода
  await page.waitForSelector(SEARCH_INPUT_SELECTOR, { visible: true, timeout: 10000 });

  // 2) Очищаем поле (тройной клик + Backspace)
  await page.click(SEARCH_INPUT_SELECTOR, { clickCount: 3 });
  await page.keyboard.press('Backspace');

  // 3) Вводим номер
  await page.type(SEARCH_INPUT_SELECTOR, orderNumber, { delay: 50 });
  // 4) Enter
  await page.keyboard.press('Enter');

  // 5) Ждём 2 секунды
  await sleep(2000);

  // 6) Проверяем empty-state
  const emptyStateExists = await page.$(EMPTY_STATE_SELECTOR);
  if (emptyStateExists) {
    console.log(`[searchOrder] -> Заказ ${orderNumber}: НЕ найден (empty-state).`);
    return false;
  }

  // 7) Проверяем, есть ли хотя бы одна секция .order-header-section
  const orderSection = await page.$(ORDER_HEADER_SELECTOR);
  if (orderSection) {
    console.log(`[searchOrder] -> Заказ ${orderNumber}: НАЙДЕН!`);
    return true;
  }

  console.log(`[searchOrder] -> Заказ ${orderNumber}: нет нужных элементов, считаем не найден.`);
  return false;
}

/**
 * Основная функция: searchAllOrders
 */
async function searchAllOrders() {
  console.log('[searchOrder] -> Начинаем searchAllOrders()...');

  // Если ORDERS_TO_FIND пуст:
  if (ORDERS_TO_FIND.length === 0) {
    console.log('[searchOrder] -> Массив ORDERS_TO_FIND пуст, выходим.');
    return;
  }
  console.log(`[searchOrder] -> Ищем заказы: [${ORDERS_TO_FIND.join(', ')}]`);

  // Загружаем accData.json
  let accountsList = [];
  try {
    const accData = require(accDataPath);
    if (accData && Array.isArray(accData.accounts)) {
      accountsList = accData.accounts; // [{email, pass}, ...]
    } else {
      console.log('[searchOrder] -> В accData.json нет массива accounts, выходим.');
      return;
    }
  } catch (errAcc) {
    console.log('[searchOrder] -> Ошибка при чтении accData.json:', errAcc);
    return;
  }

  console.log(`[searchOrder] -> Всего аккаунтов для проверки: ${accountsList.length}`);

  const foundOrders = []; // [{ orderNumber, account }]
  const totalNeed = ORDERS_TO_FIND.length;

  // Цикл по аккаунтам
  for (let i = 0; i < accountsList.length; i++) {
    const { email, pass } = accountsList[i];
    console.log(`\n[searchOrder] -> Аккаунт #${i+1}: ${email}`);

    let browser = null;
    let page = null;

    try {
      // Запуск профиля
      const { browser: br, page: pg } = await launchBrowserForAccount({ accountEmail: email });
      browser = br;
      page = pg;

      // Проверяем авторизацию
      const alreadyAuth = await isUserAuthorized(page, email);
      if (!alreadyAuth) {
        console.log(`[searchOrder] -> Аккаунт ${email} не авторизован. Вызываем authorize...`);
        const authOk = await authorize(page, { login: email, password: pass }, null);
        if (!authOk) {
          console.log(`[searchOrder] -> Авторизация не удалась для ${email}, пропускаем этот аккаунт.`);
          continue;
        }
      } else {
        console.log(`[searchOrder] -> Аккаунт ${email} уже авторизован, продолжаем.`);
      }

      // Переходим на страницу заказов
      const ordersUrl = 'https://secure.iherb.com/myaccount/orders';
      console.log(`[searchOrder] -> Переходим на: ${ordersUrl}`);
      await page.goto(ordersUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log('[searchOrder] -> Страница заказов загружена. Ищем...');

      // Ищем каждый заказ
      for (let j = 0; j < ORDERS_TO_FIND.length; j++) {
        const orderNum = ORDERS_TO_FIND[j];
        // Проверяем, не нашли ли уже этот заказ
        const alreadyFound = foundOrders.some(o => o.orderNumber === orderNum);
        if (alreadyFound) continue;

        const isFound = await searchSingleOrder(page, orderNum);
        if (isFound) {
          foundOrders.push({ orderNumber: orderNum, account: email });
          if (foundOrders.length === totalNeed) {
            // Все заказы найдены
            console.log('[searchOrder] -> Все заказы найдены, завершаем досрочно.');
            break;
          }
        }
      }

      if (foundOrders.length === totalNeed) {
        await browser.close();
        break; // выходим из цикла аккаунтов
      }
    } catch (err) {
      console.log(`[searchOrder] -> Ошибка при работе с аккаунтом ${email}:`, err);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Определяем, какие не найдены
  const notFoundOrders = ORDERS_TO_FIND.filter(num => {
    return !foundOrders.some(o => o.orderNumber === num);
  });

  // Записываем результат
  const resultObj = {
    found: foundOrders,
    notFound: notFoundOrders
  };

  try {
    fs.writeFileSync(foundOrdersPath, JSON.stringify(resultObj, null, 2), 'utf-8');
    console.log(`[searchOrder] -> Результат записан в ${foundOrdersPath}`);
  } catch (errWrite) {
    console.log('[searchOrder] -> Не смогли записать foundOrders.json:', errWrite);
  }

  // Выводим в консоль
  console.log('[searchOrder] -> Итог поиска:');
  console.log('Найдено:', foundOrders);
  if (notFoundOrders.length > 0) {
    console.log('Не найдены:', notFoundOrders);
  } else {
    console.log('Все заказы найдены!');
  }

  console.log('[searchOrder] -> Завершено.');
}

// Если нужно запускать напрямую: node searchOrder.js
if (require.main === module) {
  searchAllOrders();
}

module.exports = { searchAllOrders };
