// preOrderPage.js

const { safeWaitForLoad, sleep } = require('../utils/pageLoadHelper.js');
const { checkAndSolveCaptchaInPlace } = require('../../captcha.js');
const { fillCustomsInfo } = require('./customsInfo.js');
const { cardVerification } = require('./cardVerification.js');
const { checkCartSumm } = require('./checkCartSumm.js');
const { finalReceipt } = require('./finalReceipt.js');
const { addressManager } = require('../utils/addressManager.js');
const adressList = require('../../../data/adressBook/adressList.json');
const { waitOnTransaction } = require('../utils/transactionWaiter.js');



/* ------------------------------------------------------------------
   Закрываем оверлей «Поменять валюту» (#continue-ccl-button)
   ------------------------------------------------------------------ */
async function dismissCurrencyOverlay(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const btn = await page
      .waitForSelector('button#continue-ccl-button', { timeout: 4000 })
      .catch(() => null);

    if (!btn) {
      console.log('[overlay] → Кнопка не появилась (попытка ' + attempt + ')');
    } else {
      console.log('[overlay] → Нажимаем кнопку (попытка ' + attempt + ')');
      await btn.click();
      // ждём исчезновения либо затемнения
      const gone = await page
        .waitForSelector('button#continue-ccl-button', { hidden: true, timeout: 4000 })
        .then(() => true)
        .catch(() => false);

      if (gone) {
        console.log('[overlay] → Overlay cleared.');
        return;
      }
    }

    // если всё ещё висит — пробуем Esc
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
  }

  console.log('[overlay] → Overlay не исчез, но продолжаем работу.');
}


async function preOrderPage(page, cartResult = {}, orderMeta = {}, skipAddressCheck = false) {
  // Решаем капчу (если она присутствует)
  cartResult = { ...cartResult, ...orderMeta };
  try {
    const hasCaptcha = await page.$('#px-captcha');
 if (hasCaptcha) {
   await checkAndSolveCaptchaInPlace(page);   // ждём ровно до решения
 }
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
  await dismissCurrencyOverlay(page);




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
        await page.goto('https://checkout12.iherb.com/scd', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await safeWaitForLoad(page);
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

const result = await finalReceipt(page, { ...receiptData });
console.log('[preOrderPage] -> Завершено, success =', result.success);
return result;   // возвращаем объект { success, type, record … }
}

module.exports = { preOrderPage };
