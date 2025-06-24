// preOrderPage.js

const { safeWaitForLoad, sleep } = require('../utils/pageLoadHelper.js');
const { checkAndSolveCaptchaInPlace } = require('../../captcha.js');
const { fillCustomsInfo } = require('./customsInfo.js');
const { cardVerification } = require('./cardVerification.js');
const { checkCartSumm } = require('./checkCartSumm.js');
const { finalReceipt } = require('./finalReceipt.js');
const { addressManager } = require('../utils/addressManager.js');
const adressList = require('../../../data/adressBook/adressList.json');
const setAdressPage = require('../setAdressPage/setAdressPage.js');

async function preOrderPage(page, cartResult = {}, orderMeta = {}, skipAddressCheck = false) {
  // Решаем капчу (если она присутствует)
  cartResult = { ...cartResult, ...orderMeta };
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
        await page.waitForSelector('button#continue-ccl-button', { hidden: true, timeout: 2000 });
      } catch (_) {
        console.log('[preOrderPage] -> Поп-ап не пропал за 5 сек, продолжаем.');
      }
    } else {
      console.log('[preOrderPage] -> Поп-ап подтверждения валюты не найден.');
    }
  } catch (errPopup) {
    console.log('[preOrderPage] -> Ошибка при проверке/нажатии на поп-ап:', errPopup);
  }



    // ————————————————————————————————————————————————————
    // Определяем, какой адрес сейчас установлен на странице
    await page.waitForSelector('.DeliveryAddress__FirstName-sc-vtw4ic-3.ktFtbM');
    const currentFullName = await page.$eval(
      '.DeliveryAddress__FirstName-sc-vtw4ic-3.ktFtbM',
      el => el.textContent.trim()
    );
    console.log(`[preOrderPage] -> Текущий адрес со страницы: "${currentFullName}"`);


    // ————————————————————————————————————————————————————
    // Проверяем лимит и при необходимости выбираем новый адрес
    if (!skipAddressCheck) {
      const { changed, newIndex } = await addressManager(currentFullName);

      if (changed) {
        console.log(`[preOrderPage] -> addressManager: индекс ${newIndex} выбран для смены`);
        await setAdressPage(page, adressList[newIndex]);

        console.log('[preOrderPage] -> Новый адрес установлен, возвращаемся к checkout...');
        await page.goto('https://checkout12.iherb.com/scd', { waitUntil: 'networkidle2' });
        await safeWaitForLoad(page, 0);
        console.log('[preOrderPage] -> Страница checkout перезагружена, запускаем процесс заново без повторной смены адреса.');

        // Рекурсивно перезапускаем preOrderPage, но больше не трогаем адрес
        return preOrderPage(page, cartResult, orderMeta, true);
      }
    }
    // ————————————————————————————————————————————————————




  // Вызов fillCustomsInfo (если всегда нужно?)
  console.log('[preOrderPage] -> Запуск fillCustomsInfo...');
  await fillCustomsInfo(page);

  // Проверка номера карты
  console.log('[preOrderPage] -> Запуск cardVerification...');
  await cardVerification(page);

  // Проверка суммы перед размещением заказа
  // ----------  проверяем сумму перед заказом  ----------
console.log('[preOrderPage] -> Запуск checkCartSumm...');
const orderData = (await checkCartSumm(page, cartResult)) || {};
console.log('[preOrderPage] -> checkCartSumm завершился, orderData =', orderData);

// ----------  объединяем всё, что нужно записать  ----------
const receiptData = {
  ...cartResult,   // динамика корзины (может быть пустой {})
  ...orderData     // то, что вернул checkCartSumm
  // orderMeta уже «влит» в cartResult выше
};

await sleep(500);

// ----------  финальная запись  ----------
const success = await finalReceipt(page, {
  ...cartResult
});

console.log('[preOrderPage] -> Завершено, success =', success);
return !!success;          // <‑‑‑‑‑‑‑‑‑‑ возвращаем bool
}
  console.log('[preOrderPage] -> Завершено, браузер оставлен открытым для проверки.');


module.exports = { preOrderPage };
