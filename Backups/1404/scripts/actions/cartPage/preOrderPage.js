// preOrderPage.js

const { safeWaitForLoad, sleep } = require('../utils/pageLoadHelper.js');
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

  // Ждём загрузку страницы (если нужно) без лишней задержки
  console.log('[preOrderPage] -> Ждем загрузку страницы с помощью safeWaitForLoad...');
  console.log(`[preOrderPage] -> Общая сумма корзины из checkSumm: $${cartResult.cartTotal}`);
  try {
    await safeWaitForLoad(page, 0);
    console.log('[preOrderPage] -> Страница успешно загрузилась.');
  } catch (errWait) {
    console.log('[preOrderPage] -> Ошибка safeWaitForLoad:', errWait);
  }

  // Проверяем, появился ли поп-ап подтверждения валюты
  try {
    console.log('[preOrderPage] -> Перед проверкой поп-апа...');
    const continueButton = await page.$('button#continue-ccl-button');
    console.log('[preOrderPage] -> После page.$() — элемент continueButton =', !!continueButton);
    if (continueButton) {
      console.log('[preOrderPage] -> Найден поп-ап подтверждения валюты, нажимаем "Продолжить с USD".');
      await continueButton.click();

      // Вместо жёсткого sleep(3000) ждём исчезновения этого поп-апа:
      try {
        await page.waitForSelector('button#continue-ccl-button', { hidden: true, timeout: 5000 });
      } catch (_) {
        console.log('[preOrderPage] -> Поп-ап не пропал за 5 сек, продолжаем.');
      }
    } else {
      console.log('[preOrderPage] -> Поп-ап подтверждения валюты не найден.');
    }
  } catch (errPopup) {
    console.log('[preOrderPage] -> Ошибка при проверке/нажатии на поп-ап:', errPopup);
  }

  // Вызов fillCustomsInfo (если всегда нужно?)
  console.log('[preOrderPage] -> Запуск fillCustomsInfo...');
  await fillCustomsInfo(page);

  // Проверка номера карты
  console.log('[preOrderPage] -> Запуск cardVerification...');
  await cardVerification(page);

  // Проверка суммы перед размещением заказа
  console.log('[preOrderPage] -> Запуск checkCartSumm...');
  const orderData = await checkCartSumm(page, cartResult);

  orderData.client = cartResult.client;
  orderData.orderID = cartResult.orderID;
  orderData.cartLink = cartResult.cartLink;

  console.log('[preOrderPage] -> checkCartSumm завершился, orderData=', orderData);

  // Если нужно, краткая пауза
  await sleep(500);

  // Завершающий шаг
  console.log('[preOrderPage] -> Запуск finalReceipt...');
  await finalReceipt(page, orderData);

  console.log('[preOrderPage] -> Завершено, браузер оставлен открытым для проверки.');
}

module.exports = { preOrderPage };
