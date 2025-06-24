// placeOrder.js
async function placeOrder(page) {
    console.log('[preOrderPage] -> Нажимаем на кнопку "Разместить заказ".');
    await page.waitForSelector('button#place-order-button', { visible: true });
    await page.click('button#place-order-button');
    console.log('[preOrderPage] -> Кнопка "Разместить заказ" нажата.');
    await page.waitForTimeout(3000);
  }
  
  module.exports = { placeOrder };
  