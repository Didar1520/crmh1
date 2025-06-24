// preOrderPage.js

const { safeWaitForLoad } = require('../utils/pageLoadHelper.js');
const { checkAndSolveCaptchaInPlace } = require('../../captcha.js');
const { fillCustomsInfo } = require('./customsInfo.js');
const { cardVerification } = require('./cardVerification.js');
const { checkCartSumm } = require('./checkCartSumm.js');
const { finalReceipt } = require('./finalReceipt.js');
async function preOrderPage(page, cartResult) {


  // Решаем капчу (если она присутствует)
  try {
    await checkAndSolveCaptchaInPlace(page, null, 15000);
    console.log('[preOrderPage] -> Капча решена.');
  } catch (err) {
    console.log('[preOrderPage] -> Ошибка при решении капчи:', err);
  }

  // Ждем загрузку страницы с помощью safeWaitForLoad
  console.log('[preOrderPage] -> Ждем загрузку страницы с помощью safeWaitForLoad...');
  console.log(`[preOrderPage] -> Общая сумма корзины из checkSumm: $${cartResult.cartTotal}`);
  try {
    await safeWaitForLoad(page, 5000); // увеличиваем таймаут, если страница грузится дольше
    console.log('[preOrderPage] -> Страница успешно загрузилась.');
  } catch (errWait) {
    console.log('[preOrderPage] -> Ошибка safeWaitForLoad:', errWait);
  }

  // Проверяем, появился ли поп-ап подтверждения валюты, и если да, нажимаем "Продолжить с USD"
  try {
    const continueButton = await page.$('button#continue-ccl-button');
    if (continueButton) {
      console.log('[preOrderPage] -> Найден поп-ап подтверждения валюты, нажимаем "Продолжить с USD".');
      await page.click('button#continue-ccl-button');

      await sleep(3000);
    } else {
      console.log('[preOrderPage] -> Поп-ап подтверждения валюты не найден.');
    }
  } catch (errPopup) {
    console.log('[preOrderPage] -> Ошибка при проверке/нажатии на поп-ап:', errPopup);
  }
 

  // Ждем пару секунд с помощью функции sleep
  await sleep(3000);
  await fillCustomsInfo(page);
 

  // 2) Запускаем проверку номера карты
  await cardVerification(page);

  const orderData = await checkCartSumm(page, cartResult);
  console.log('[preOrderPage] -> checkCartSumm завершился, orderData=', orderData);
  
  // Если нужно, подождать чуть-чуть
  await sleep(1500
    
  );
  
  // Теперь вызываем финальную обработку
  await finalReceipt(page, orderData);
  
  console.log('[preOrderPage] -> Завершено, браузер оставлен открытым для проверки.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { preOrderPage };
