// finalReceipt.js

const fs = require('fs');
const path = require('path');
const { safeWaitForLoad } = require('../utils/pageLoadHelper.js');
const { checkAndSolveCaptchaInPlace } = require('../../captcha.js');

/**
 * finalReceipt(page, orderData)
 * ----------------------------------------------------------------------------
 * 1) Ждём загрузку финальной страницы.
 * 2) Проверяем капчу (если есть).
 * 3) Используем orderData, чтобы записать итог в ordersData.json.
 *    - date в формате DD-MM-YYYY / HH:MM:SS (UTC+6)
 *    - orderAccount из emailAddress
 *    - price = orderTotal + usedRewardsCredit (убирая минус)
 *    - cardUsed = cardDigit
 */
async function finalReceipt(page, orderData) {
  console.log('[finalReceipt] -> Начинаем обработку финальной страницы...');

  // 1) Ждём загрузки
  try {
    console.log('[finalReceipt] -> Ждём safeWaitForLoad...');
    await safeWaitForLoad(page, 3000);
    console.log('[finalReceipt] -> Страница загружена.');
  } catch (errLoad) {
    console.log('[finalReceipt] -> Ошибка при safeWaitForLoad:', errLoad);
  }

  // 2) Проверяем/решаем капчу
  try {
    await checkAndSolveCaptchaInPlace(page, null, 10000);
    console.log('[finalReceipt] -> Капча решена (или не появилась).');
  } catch (capErr) {
    console.log('[finalReceipt] -> Ошибка решения капчи:', capErr);
  }

  // 3) Используем orderData
  if (!orderData) {
    console.log('[finalReceipt] -> Нет orderData (возможно, запрос не пришёл?), завершаем.');
    return;
  }
  if (!orderData.orderNumber || !orderData.orderTotal) {
    console.log('[finalReceipt] -> orderData неполный (нет orderNumber или orderTotal), завершаем.');
    return;
  }

  const {
    orderNumber,
    orderTotal,           // например "$0.00"
    emailAddress,         // например "test@mail.com"
    formattedPaidRewardTotal, // например "-$13.67"
    shippingAddress,      // { fullName: ... }
    cardDigit,            // например "1234"
    usedRewardsCredit     // например "-$13.67" (если есть, иначе можно брать formattedPaidRewardTotal)
  } = orderData;

  // 3.1) Формируем дату с UTC+6 в нужном формате "DD-MM-YYYY / HH:MM:SS"
  const dateNow = new Date();
  // смещаем на +6 часов от UTC
  const localTimeOffsetMs = 6 * 60 * 60 * 1000;
  const dateShifted = new Date(dateNow.getTime() + localTimeOffsetMs);

  const day = String(dateShifted.getUTCDate()).padStart(2, '0');
  const month = String(dateShifted.getUTCMonth() + 1).padStart(2, '0');
  const year = dateShifted.getUTCFullYear();

  const hours = String(dateShifted.getUTCHours()).padStart(2, '0');
  const minutes = String(dateShifted.getUTCMinutes()).padStart(2, '0');
  const seconds = String(dateShifted.getUTCSeconds()).padStart(2, '0');

  const formattedDate = `${day}-${month}-${year} / ${hours}:${minutes}:${seconds}`; 
  // Пример: "14-03-2025 / 21:23:42"

  // 3.2) Рассчитываем price = orderTotal + usedRewardsCredit (убираем минус)
  const orderTotalNum = parseFloat(orderTotal.replace(/[^\d.-]/g, '')) || 0;
  // берём usedRewardsCredit или formattedPaidRewardTotal (судя по JSON, часто это одно и то же)
  const rewardsStr = usedRewardsCredit || formattedPaidRewardTotal || '0';
  let rewardsNum = parseFloat(rewardsStr.replace(/[^\d.-]/g, '')) || 0;
  rewardsNum = Math.abs(rewardsNum); // убираем минус
  const finalPriceUsd = orderTotalNum + rewardsNum;

  // 3.3) Готовим запись
  const recordToAdd = {
    orderNumber: orderNumber,
    date: formattedDate,
    orderAccount: emailAddress || '',
    deliveryAddress: shippingAddress?.fullName || '',
    iherbStatus: 'выполняется обработка',
    rewardsUsed: formattedPaidRewardTotal || '',
    cardUsed: cardDigit || '',
    price: {
      usd: finalPriceUsd,
      rub: 0,
      commission: 0
    }
  };

  // 4) Записываем в ordersData.json
  const ordersDataPath = 'D:\\Didar1520\\CRM\\data\\OrdersData\\ordersData.json';
  try {
    let fileContent = '{}';
    if (fs.existsSync(ordersDataPath)) {
      fileContent = fs.readFileSync(ordersDataPath, 'utf8');
    }

    let ordersObj;
    try {
      ordersObj = JSON.parse(fileContent);
    } catch (jsonErr) {
      ordersObj = { orders: [] };
    }
    if (!ordersObj.orders) {
      ordersObj.orders = [];
    }

    ordersObj.orders.push(recordToAdd);
    fs.writeFileSync(ordersDataPath, JSON.stringify(ordersObj, null, 2), 'utf8');

    console.log('[finalReceipt] -> Данные успешно добавлены в ordersData.json');
    console.log('[finalReceipt] ->', recordToAdd);
  } catch (fileErr) {
    console.log('[finalReceipt] -> Ошибка записи в ordersData.json:', fileErr);
  }

  console.log('[finalReceipt] -> Завершено.');
}

module.exports = { finalReceipt };
