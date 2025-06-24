// scripts/sync/orders.js

const fs = require('fs');
const path = require('path');
const { waitForStateChange, logActions, sleep } = require('../utils');
const { checkAndSolveCaptchaInPlace } = require('../captcha');

/**
 * Синхронизация заказов (orders).
 * 
 * Берём настройки из config.syncData.orders:
 *   {
 *     searchOrderNumber: "532761927", // (string) искать конкретный заказ
 *     limit: 5                       // (number) взять последние X заказов
 *   }
 * 
 * Сохраняем в файл:
 *   C:\Users\Didar1520\Docks\CRM\data\AccData\Accounts\<email>.json
 * 
 * В поле "orders" будет массив объектов с данными о заказах.
 */

async function syncOrders(page, ws, syncData) {
  let currentUserEmail = null;

  // Логируем начало
  await logActions('Синхронизация заказов...', ws, 'in-progress');

  // 1) Определяем текущий email по эндпоинту currentUser
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('catalog.app.iherb.com/catalog/currentUser')) return;

    // Читаем только если статус 200 и JSON
    if (response.status() !== 200) return;
    const ct = response.headers()['content-type'] || '';
    if (!ct.includes('application/json')) return;

    try {
      const body = await response.text();
      if (body) {
        const json = JSON.parse(body);
        currentUserEmail = json.email || null;
      }
    } catch (err) {
      console.log('[syncOrders] Ошибка при чтении currentUser:', err);
    }
  });

  // 2) Идём на страницу заказов
  await page.goto('https://secure.iherb.com/myaccount/orders', {
    waitUntil: 'networkidle2'
  });

  // 2.1) Проверяем капчу (если появится Press & Hold)
  await checkAndSolveCaptchaInPlace(page, ws, 15000);

  // Извлекаем параметры из syncData.orders
  const ordersParams = syncData?.orders || {};
  const searchNumber = ordersParams.searchOrderNumber || null; // например '532761927'
  let limitCount = ordersParams.limit || null;                // например 5

  // 3) Если указан searchOrderNumber — ищем конкретный заказ
  if (searchNumber) {
    console.log(`[syncOrders] Ищем заказ #${searchNumber} через поисковую строку...`);
    // Вводим номер в поле
    await page.evaluate((orderNo) => {
      const input = document.querySelector('#orderHistorySearchInputRD');
      if (input) {
        input.value = '';
        input.value = orderNo;
      }
    }, searchNumber);

    // Клик по кнопке поиска
    await page.click('.search-submit-btn.js-search-submit');
    await sleep(2000); // ждём обновления списка

    // Ещё раз проверяем капчу (может всплыть снова)
    await checkAndSolveCaptchaInPlace(page, ws, 5000);

    // Проверяем, нет ли пустого результата
    const nothingFound = await page.evaluate(() => {
      const emptyDiv = document.querySelector('.empty-state.order-history');
      return !!emptyDiv;
    });
    if (nothingFound) {
      console.log(`[syncOrders] Заказ #${searchNumber} не найден (пустая выдача).`);
      return null;
    }
  } else if (limitCount && Number.isInteger(limitCount)) {
    // 4) Если нет конкретного номера, но есть limit
    console.log(`[syncOrders] Надо собрать последние ${limitCount} заказ(ов). Прокручиваем страницу...`);

    // Скроллим, пока не соберём нужное кол-во заказов
    let loadedCount = 0;
    let prevCount = -1;

    while (loadedCount < limitCount) {
      // Сколько заказов уже отображается?
      const articles = await page.$$('article.row-buffer-lg.order-history-root');
      loadedCount = articles.length;

      if (loadedCount === prevCount) {
        // Нет прогресса, выходим
        break;
      }
      prevCount = loadedCount;

      if (loadedCount >= limitCount) {
        break;
      }

      // Скроллим вниз
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 2);
      });
      await sleep(1500);

      // Ждём, пока пропадёт spinner (svg.svg-icon.spinner-container)
      let spinnerVisible = true;
      for (let attempt = 0; attempt < 5; attempt++) {
        spinnerVisible = await page.evaluate(() => {
          const spin = document.querySelector('svg.svg-icon.spinner-container');
          if (!spin) return false;
          return spin.style.display !== 'none';
        });
        if (!spinnerVisible) break;
        await sleep(1000);
      }
      if (spinnerVisible) {
        console.log('[syncOrders] Спиннер не пропал после 5 попыток. Останавливаем.');
        break;
      }
    }
  } else {
    // 5) Иначе просто берём то, что есть на экране (без скролла, без поиска)
    console.log('[syncOrders] Ни searchOrderNumber, ни limit не указаны, просто парсим видимые заказы.');
  }

  // 6) Собираем заказы со страницы
  const ordersData = await page.evaluate(() => {
    const arr = [];
    const articles = document.querySelectorAll('article.row-buffer-lg.order-history-root');
    articles.forEach((art) => {
      const orderNumber = art.getAttribute('data-order-number') || '';

      // Дата (UTC/Locale)
      const utcInput = art.querySelector('input.orderUTCDate');
      const dateUTC = utcInput ? utcInput.value : '';
      const localeDateSpan = art.querySelector('.orderLocaleDate');
      const dateLocale = localeDateSpan ? localeDateSpan.textContent.trim() : '';

      // Сумма (пример)
      let orderSum = '';
      const sumSpan = art.querySelector(
        '.order-details-header .details-content .order-detail:nth-of-type(3) span:nth-of-type(2)'
      );
      if (sumSpan) orderSum = sumSpan.textContent.trim();

      // Статусы
      let mainStatus = '';
      let secondStatus = '';
      const mainStatusEl = art.querySelector('.order-status-box .order-status-label span');
      if (mainStatusEl) {
        mainStatus = mainStatusEl.textContent.trim();
      }
      const secondStatusEl = art.querySelector('.order-status-box .shipment-message span');
      if (secondStatusEl) {
        secondStatus = secondStatusEl.textContent.trim();
      }

      // Трек
      let trackNumber = '';
      const trackLink = art.querySelector('a[href*="carrierTracking"]');
      if (trackLink) {
        const hrefVal = trackLink.getAttribute('href') || '';
        const match = hrefVal.match(/trackingNumber=([^&]+)/);
        if (match && match[1]) {
          trackNumber = match[1];
        }
      }

      // Список товаров
      const products = [];
      const productEls = art.querySelectorAll('.products .product');
      productEls.forEach((prod) => {
        const nameLink = prod.querySelector('.display-name');
        const productName = nameLink ? nameLink.textContent.trim() : '';
        const productHref = nameLink ? nameLink.getAttribute('href') : '';

        let qty = '';
        const qtyEl = prod.querySelector('.display-quantity .price-number');
        if (qtyEl) qty = qtyEl.textContent.trim();

        let partNumber = '';
        let productId = '';
        const addCartBtn = prod.querySelector('.order-detail-add-to-cart');
        if (addCartBtn) {
          partNumber = addCartBtn.getAttribute('data-part-number') || '';
          productId = addCartBtn.getAttribute('data-pid') || '';
        }

        products.push({
          productName,
          productHref,
          quantity: qty,
          partNumber,
          productId
        });
      });

      // Проверка, можно ли отменить (нет .cannot-cancel-text => значит, возможно, отмена)
      let canCancel = false;
      if (!art.querySelector('.cannot-cancel-text')) {
        const cancelBtn = art.querySelector('.cancel-shipped-order-modal-yes');
        if (cancelBtn) canCancel = true;
      }

      arr.push({
        orderNumber,
        dateUTC,
        dateLocale,
        orderSum,
        mainStatus,
        secondStatus,
        trackNumber,
        canCancel,
        products
      });
    });
    return arr;
  });

  // 6.1) Если был указан конкретный searchOrderNumber — фильтруем
  let finalOrders = ordersData;
  if (searchNumber) {
    finalOrders = ordersData.filter((o) => o.orderNumber === searchNumber);
  }

  // 6.2) Если есть limit (и не было searchNumber) — обрезаем
  if (!searchNumber && limitCount && Number.isInteger(limitCount)) {
    finalOrders = finalOrders.slice(0, limitCount);
  }

  // 7) Ждём currentUserEmail (макс 10 сек)
  try {
    await waitForStateChange(() => currentUserEmail !== null, 1000, 10000);
  } catch (err) {
    console.log('[syncOrders] Не дождались currentUserEmail, пропускаем сохранение');
    return finalOrders;
  }
  if (!currentUserEmail) {
    console.log('[syncOrders] currentUserEmail всё ещё null, пропускаем запись');
    return finalOrders;
  }

  // 8) Путь к файлу "<email>.json"
  const ordersDir = path.join(__dirname, '../../data/AccData/Accounts');
  if (!fs.existsSync(ordersDir)) {
    fs.mkdirSync(ordersDir, { recursive: true });
  }
  const userFilePath = path.join(ordersDir, `${currentUserEmail}.json`);

  // Считываем, что там было
  let oldData = {};
  if (fs.existsSync(userFilePath)) {
    try {
      const raw = fs.readFileSync(userFilePath, 'utf8');
      oldData = JSON.parse(raw);
    } catch (errRead) {
      console.log('[syncOrders] Ошибка чтения файла, создаём заново:', errRead);
      oldData = {};
    }
  }

  // Заполняем поле orders
  oldData.orders = finalOrders;

  // Пишем в файл
  try {
    fs.writeFileSync(userFilePath, JSON.stringify(oldData, null, 2), 'utf8');
    console.log(`[syncOrders] Заказы (count=${finalOrders.length}) сохранены в ${userFilePath}`);
    console.log('[syncOrders] ->', finalOrders);
  } catch (errSave) {
    console.log('[syncOrders] Ошибка записи в файл:', errSave);
  }

  return finalOrders;
}

module.exports = { syncOrders };
