// scripts/actions/preOrderPage/preOrderPage.js
/**
 * Модуль preOrderPage для страницы https://checkout12.iherb.com/scd
 * -----------------------------------------------------------------------------
 * Шаги:
 * 1) Ждём полную загрузку
 * 2) Если поп-ап "Подтверждение валюты" => "Продолжить с USD"
 * 3) Заполняем таможенную инфо
 * 4) Повторно вводим карту, если нужно
 * 5) Сравниваем сумму (cartTotal + rewardsUsed)
 * 6) "Разместить заказ" => ждём инвойс, читаем /api/checkout/order => ordersData.json
 */

const fs = require('fs');
const path = require('path');
const { safeWaitForLoad, sleep } = require('../utils/pageLoadHelper.js'); // подстройте путь

/**
 * Тогглы (если нужно отключать шаги):
 */
const STEPS = {
  handleCurrencyPopup: true,
  fillCustomsInfo: true,
  reEnterCard: true,
  compareSums: true,
  placeOrder: true
};

async function handlePreOrderPage(page, preOrderParams) {
  console.log('[preOrderPage] -> Старт handlePreOrderPage');

  // 1) Ждём
  await waitForFullLoad(page);

  // 2) Поп-ап
  if (STEPS.handleCurrencyPopup) {
    await handleCurrencyPopup(page);
  }

  // 3) Таможенная информация
  if (STEPS.fillCustomsInfo) {
    // Но сначала нужно найти addressData. (см. ниже "getAdressDataByName")
    // Если preOrderParams.addressData уже задан, используем его.
    let addressData = preOrderParams.addressData;
    if (!addressData) {
      // ищем по defaultAdress?
      console.log('[preOrderPage] -> Нет addressData, попробуем загрузить из adressList');
      addressData = await getAdressDataByName(preOrderParams.defaultAdressName || '');
    }
    await fillCustomsInfo(page, addressData);
  }

  // 4) Повторный ввод карты
  if (STEPS.reEnterCard) {
    await reEnterCardIfNeeded(page, preOrderParams);
  }

  // 5) Сравниваем сумму
  if (STEPS.compareSums) {
    await compareSumsOnPreOrder(page, preOrderParams);
  }

  // 6) "Разместить заказ" => запись JSON
  if (STEPS.placeOrder) {
    await placeFinalOrder(page, preOrderParams);
  }

  console.log('[preOrderPage] -> Завершён handlePreOrderPage.');
}

/**
 * waitForFullLoad(page)
 * -----------------------------------------------------------------------------
 * Ждём networkidle + исчезновение большого спиннера, потом sleep(1s).
 */
async function waitForFullLoad(page, maxWait = 30000) {
  console.log('[preOrderPage] -> Ждём полную загрузку (networkidle+спиннер)...');
  try {
    // puppeteer >= 19.x:
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: maxWait });
  } catch (err) {
    console.log('[preOrderPage] -> waitForNetworkIdle:', err);
  }

  // примерный селектор спиннера
  const spinnerSel = 'div.ConnectedLoading__SpinnerWrapper-sc-1245kmi-0';
  try {
    await page.waitForSelector(spinnerSel, { timeout: 1000 });
    console.log('[preOrderPage] -> Спиннер появился, ждём скрытия...');
    await page.waitForSelector(spinnerSel, { hidden: true, timeout: maxWait });
  } catch {
    // ок, не появился
  }
  await sleep(1000);
}

/**
 * handleCurrencyPopup(page)
 * -----------------------------------------------------------------------------
 * Проверяем поп-ап "Подтверждение валюты", если есть => "Продолжить с USD".
 */
async function handleCurrencyPopup(page) {
  console.log('[preOrderPage] -> Проверяем поп-ап "Валюта"...');
  const btnSel = 'button#continue-ccl-button';
  try {
    await page.waitForSelector(btnSel, { timeout: 1500 });
    console.log('[preOrderPage] -> Поп-ап найден, жмём "Продолжить с USD"');
    await page.click(btnSel);
    await sleep(1000);
  } catch {
    console.log('[preOrderPage] -> Поп-ап не появился, ок.');
  }
}

/**
 * Заполняем таможню
 */
async function fillCustomsInfo(page, addressData) {
  if (!addressData) {
    console.log('[preOrderPage] -> fillCustomsInfo: addressData пуст, пропускаем...');
    return;
  }
  console.log('[preOrderPage] -> Заполняем таможню...');

  const toggleSel = '#customs-panel-toggle-button';
  try {
    await page.waitForSelector(toggleSel, { visible: true, timeout: 5000 });
    await page.click(toggleSel);
    await sleep(1000);
  } catch (err) {
    console.log('[preOrderPage] -> Не нашли "Изменить" (таможня):', err);
  }

  // Инпуты
  const passSel = 'input[name="identificationNumber"]';
  const fNameSel = 'input[id="firstName"]';
  const mNameSel = 'input[name="midName"]';
  const lNameSel = 'input[name="lastName"]';
  const phoneSel = 'input#mobileNumber';

  try {
    await page.waitForSelector(passSel, { visible: true, timeout: 5000 });
    await page.type(passSel, String(addressData.Pasport || ''), { delay: 50 });
    await page.type(fNameSel, addressData.Name || '', { delay: 50 });
    await page.type(mNameSel, addressData.MiddleName || '', { delay: 50 });
    await page.type(lNameSel, addressData.Surname || '', { delay: 50 });
    await page.type(phoneSel, `+${String(addressData.Number || '')}`, { delay: 50 });
  } catch (err) {
    console.log('[preOrderPage] -> Ошибка при вводе тамож. полей:', err);
  }

  // Кнопка "Продолжить"
  const contSel = 'button.MuiButton-disableElevation:nth-child(2)';
  try {
    await page.waitForSelector(contSel, { visible: true, timeout: 5000 });
    await page.click(contSel);
    console.log('[preOrderPage] -> Нажали "Продолжить" (таможня).');
  } catch (err) {
    console.log('[preOrderPage] -> Ошибка "Продолжить" (таможня):', err);
  }

  await waitForFullLoad(page);
}

/**
 * reEnterCardIfNeeded(page, preOrderParams)
 */
async function reEnterCardIfNeeded(page, { selectedCardLast4, fullCards }) {
  console.log('[preOrderPage] -> Проверка, не просит ли повторно ввести карту...');
  const panelErrorSel = 'div[data-testid="panel-error"].panel-error';
  let reEnter = false;
  try {
    await page.waitForSelector(panelErrorSel, { timeout: 1500 });
    reEnter = true;
    console.log('[preOrderPage] -> Сайт просит повторно ввести номер карты.');
  } catch {
    console.log('[preOrderPage] -> Повторный ввод карты не требуется.');
  }
  if (!reEnter) return;

  // Ищем подходящую карту
  if (!selectedCardLast4 || !Array.isArray(fullCards)) {
    console.log('[preOrderPage] -> Нет данных о карте (last4/fullCards).');
    return;
  }
  const fullCard = fullCards.find(c => c.endsWith(selectedCardLast4));
  if (!fullCard) {
    console.log(`[preOrderPage] -> Не нашли полную карту, оканчивающуюся на ${selectedCardLast4}`);
    return;
  }
  console.log('[preOrderPage] -> Вводим карту:', fullCard);

  const cardNumberSel = 'input#encryptedCardNumber';
  try {
    await page.waitForSelector(cardNumberSel, { visible: true, timeout: 5000 });
    // Очищаем поле
    await page.click(cardNumberSel, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    // Вводим
    for (const digit of fullCard) {
      await page.type(cardNumberSel, digit, { delay: 50 });
    }
    console.log('[preOrderPage] -> Ввели номер карты:', fullCard);
  } catch (err) {
    console.log('[preOrderPage] -> Ошибка ввода карты:', err);
  }

  const contSel = 'button#credit-card-continue-button';
  try {
    await page.waitForSelector(contSel, { visible: true, timeout: 5000 });
    await page.click(contSel);
    console.log('[preOrderPage] -> Нажали "Продолжить" (карта).');
  } catch (err) {
    console.log('[preOrderPage] -> Ошибка "Продолжить" (карта):', err);
  }
  await waitForFullLoad(page);
}

/**
 * compareSumsOnPreOrder(page, { cartTotal, rewardsUsed })
 * -----------------------------------------------------------------------------
 * Ищем .LineItem-sc-wlrx-1.bzMOFj => $155.71
 * Ищем .LineItem-sc-wlrx-1.bpbjEF => -$35.00
 * Сравниваем
 */
async function compareSumsOnPreOrder(page, { cartTotal = 0, rewardsUsed = 0 }) {
  console.log('[preOrderPage] -> Сравниваем суммы. cartTotal=', cartTotal, 'rewardsUsed=', rewardsUsed);

  let preOrderPrice = 0;
  let preOrderRew = 0;

  try {
    const textPrice = await page.$eval('.LineItem-sc-wlrx-1.bzMOFj', el => el.textContent.trim());
    preOrderPrice = parseFloat(textPrice.replace(/[^0-9.]/g, '')) || 0;
  } catch {
    console.log('[preOrderPage] -> Не нашли основную сумму .bzMOFj');
  }
  try {
    const textRew = await page.$eval('.LineItem-sc-wlrx-1.bpbjEF', el => el.textContent.trim());
    preOrderRew = Math.abs(parseFloat(textRew.replace(/[^0-9.]/g, '')) || 0);
  } catch {
    console.log('[preOrderPage] -> Не нашли вознаграждения .bpbjEF');
  }

  const sumPreOrder = preOrderPrice + preOrderRew;
  const sumCart = cartTotal + rewardsUsed;

  if (Math.abs(sumPreOrder - sumCart) > 0.5) {
    console.log(`[preOrderPage] -> Суммы различаются! preOrder=${sumPreOrder}, cart=${sumCart}`);
    // throw new Error(...)
  } else {
    console.log(`[preOrderPage] -> Сумма совпадает: preOrder=${sumPreOrder}, cart=${sumCart}`);
  }
}

/**
 * placeFinalOrder(page, preOrderParams)
 * -----------------------------------------------------------------------------
 * Нажимаем "Разместить заказ" => ждём страницу + /api/checkout/order => запись JSON
 */
async function placeFinalOrder(page, preOrderParams) {
  console.log('[preOrderPage] -> Нажимаем "Разместить заказ"...');
  const placeSel = 'button#place-order-button';
  try {
    await page.waitForSelector(placeSel, { visible: true, timeout: 15000 });
    await page.click(placeSel);
    console.log('[preOrderPage] -> Клик "Разместить заказ".');
  } catch (err) {
    console.log('[preOrderPage] -> Ошибка "Разместить заказ":', err);
    return;
  }

  // Ждём навигации
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
  } catch (errNav) {
    console.log('[preOrderPage] -> Ошибка ожидания инвойса:', errNav);
  }
  console.log('[preOrderPage] -> Предположительно на странице инвойса. URL=', page.url());

  let orderNumber = '';
  {
    const match = page.url().match(/[?&]on=(\d+)/);
    if (match) orderNumber = match[1];
  }
  if (!orderNumber) {
    console.log('[preOrderPage] -> Не нашли orderNumber в URL, попытаемся через API...');
  }

  if (orderNumber) {
    const orderApiUrl = `https://checkout12.iherb.com/api/checkout/order?OrderNumber=${orderNumber}`;
    let orderResp;
    try {
      orderResp = await page.evaluate(async (url) => {
        const r = await fetch(url, { method: 'GET', credentials: 'include' });
        if (!r.ok) return null;
        return r.json();
      }, orderApiUrl);
    } catch (errApi) {
      console.log('[preOrderPage] -> Ошибка запроса /api/checkout/order:', errApi);
    }

    if (orderResp) {
      console.log('[preOrderPage] -> Получили orderResp:', orderResp);
      await writeOrderData(orderResp, preOrderParams);
    }
  }
}

/**
 * Записываем итог в ordersData.json
 */
async function writeOrderData(orderResp, preOrderParams) {
  // Путь к ordersData.json
  const ordersPath = path.join(__dirname, '../../../..', 'data', 'OrdersData', 'ordersData.json');
  // Подправьте кол-во ../, чтобы выйти из preOrderPage -> actions -> scripts -> data -> OrdersData

  let raw = '{}';
  try {
    raw = fs.readFileSync(ordersPath, 'utf-8');
  } catch {}
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }
  if (!data.orders) data.orders = [];

  const newOrder = {
    orderNumber: orderResp.orderNumber || '',
    date: new Date().toISOString(),
    orderTotal: orderResp.orderTotal || '',
    usedRewardsCredit: orderResp.usedRewardsCredit || '',
    shippingAddress: orderResp.shippingAddress?.fullName || '',
    emailAddress: orderResp.emailAddress || '',
    iherbStatus: 'выполняется обработка',

    // из preOrderParams:
    orderAccount: preOrderParams.accountEmail || '',
    promoCodeUsed: preOrderParams.promoCode || '',
    referralCodeUsed: preOrderParams.referralCode || '',
    cardUsed: preOrderParams.selectedCardLast4 || ''
  };

  data.orders.push(newOrder);

  fs.writeFileSync(ordersPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[preOrderPage] -> Заказ #${newOrder.orderNumber} записан в ordersData.json`);
}

/**
 * Загрузка adressList.JSON и поиск нужного объекта по двум словам (Фамилия Имя).
 * Чтобы "Саудагерова Айзат" находил "Саудагерова Айзат Толешовна".
 */
async function getAdressDataByName(twoWords) {
  const aListPath = path.join(__dirname, '../../../..', 'data', 'adressBook', 'adressList.JSON');
  let raw = '[]';
  try {
    raw = fs.readFileSync(aListPath, 'utf-8');
  } catch (err) {
    console.log('[preOrderPage] -> Не смогли прочитать adressList.JSON:', err);
  }
  let list = [];
  try {
    list = JSON.parse(raw);
  } catch {
    list = [];
  }
  if (!twoWords.trim()) {
    console.log('[preOrderPage] -> twoWords пуст, возвращаем null');
    return null;
  }

  // "Саудагерова Айзат" -> ищем "FullName": "Саудагерова Айзат Толешовна"
  const [f1, f2] = twoWords.trim().split(/\s+/, 2);
  if (!f2) {
    console.log('[preOrderPage] -> Нужно минимум 2 слова, но нашли 1:', twoWords);
    return null;
  }
  // Проверяем FullName, ищем, чтобы он содержал эти два слова
  const matched = list.find((item) => {
    if (!item.FullName) return false;
    const lowerFull = item.FullName.toLowerCase();
    return lowerFull.includes(f1.toLowerCase()) && lowerFull.includes(f2.toLowerCase());
  });

  if (matched) {
    console.log('[preOrderPage] -> Найден объект в adressList:', matched);
    return matched;
  } else {
    console.log(`[preOrderPage] -> Не нашли совпадение для: "${twoWords}"`);
    return null;
  }
}

module.exports = {
  handlePreOrderPage,
  STEPS
};
