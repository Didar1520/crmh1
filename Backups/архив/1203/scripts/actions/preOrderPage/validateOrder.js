// validateOrder.js
async function validateOrderSum(page, expectedTotal) {
    console.log('[preOrderPage] -> Проверка целостности позиций товаров (суммы заказа)...');
    
    await page.waitForSelector('div.LineItem-sc-wlrx-1.bzMOFj', { visible: true });
    const totalText = await page.$eval('div.LineItem-sc-wlrx-1.bzMOFj', el => el.textContent.trim());
    const totalPrice = parseFloat(totalText.replace(/[^0-9.]/g, '')) || 0;
  
    await page.waitForSelector('div.LineItem-sc-wlrx-1.bpbjEF', { visible: true });
    const rewardsText = await page.$eval('div.LineItem-sc-wlrx-1.bpbjEF', el => el.textContent.trim());
    const rewards = Math.abs(parseFloat(rewardsText.replace(/[^0-9.]/g, ''))) || 0;
  
    const computedTotal = totalPrice + rewards;
    console.log(`[preOrderPage] -> Вычисленная сумма: ${computedTotal}, Ожидаемая: ${expectedTotal}`);
  
    if (Math.abs(computedTotal - expectedTotal) > 0.01) {
      throw new Error(`[preOrderPage] -> Сумма заказа (${computedTotal}) не соответствует сумме корзины (${expectedTotal})`);
    }
    console.log('[preOrderPage] -> Суммы совпадают.');
  }
  
  module.exports = { validateOrderSum };
  