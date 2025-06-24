// currencyConfirmation.js
async function handleCurrencyConfirmation(page) {
    try {
      console.log('[preOrderPage] -> Проверяем наличие поп-апа подтверждения валюты...');
      await page.waitForSelector('button#continue-ccl-button', { visible: true, timeout: 5000 });
      console.log('[preOrderPage] -> Поп-ап найден, нажимаем "Продолжить с USD".');
      await page.click('button#continue-ccl-button');
    } catch (e) {
      console.log('[preOrderPage] -> Поп-ап подтверждения валюты не обнаружен, продолжаем.');
    }
  }
  
  module.exports = { handleCurrencyConfirmation };
  