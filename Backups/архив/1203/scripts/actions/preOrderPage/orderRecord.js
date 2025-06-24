// orderRecord.js
const fs = require('fs');
const path = require('path');

async function recordOrder(page, preOrderParams) {
  console.log('[preOrderPage] -> Запись данных заказа...');

  // Ждем, пока URL изменится на страницу инвойса (содержащую "order-receipt")
  await page.waitForFunction(() => window.location.href.includes('order-receipt'), { timeout: 30000 });
  const currentUrl = page.url();
  const urlObj = new URL(currentUrl);
  const orderNumber = urlObj.searchParams.get('on');

  if (!orderNumber) {
    throw new Error('[preOrderPage] -> Не удалось извлечь номер заказа из URL.');
  }
  console.log(`[preOrderPage] -> Номер заказа: ${orderNumber}`);

  // Получаем данные заказа через API (выполняем fetch из браузерного контекста)
  const orderDetails = await page.evaluate(async (orderNumber) => {
    const response = await fetch(`https://checkout12.iherb.com/api/checkout/order?OrderNumber=${orderNumber}`);
    if (!response.ok) throw new Error('API запроса данных заказа завершился ошибкой.');
    return await response.json();
  }, orderNumber);

  const orderData = {
    orderNumber: orderDetails.orderNumber || orderNumber,
    formattedPaidRewardTotal: orderDetails.formattedPaidRewardTotal || '',
    orderTotal: orderDetails.orderTotal || '',
    fullName: (orderDetails.shippingAddress && orderDetails.shippingAddress.fullName) || '',
    emailAddress: orderDetails.emailAddress || '',
    date: new Date().toISOString()
  };

  const ordersFilePath = path.join(__dirname, '../../../data/OrdersData/ordersData.json');

  let ordersJson = { orders: [] };
  try {
    const rawData = fs.readFileSync(ordersFilePath, 'utf-8');
    ordersJson = JSON.parse(rawData);
  } catch (e) {
    console.log('[orderRecord] -> Не удалось прочитать ordersData.json, будет создан новый файл.');
  }

  ordersJson.orders.push(orderData);
  fs.writeFileSync(ordersFilePath, JSON.stringify(ordersJson, null, 2), 'utf-8');
  console.log('[orderRecord] -> Данные заказа записаны в ordersData.json');
}

module.exports = { recordOrder };
