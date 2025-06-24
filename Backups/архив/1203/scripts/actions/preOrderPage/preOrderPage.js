// preOrderPage.js
const { waitForFullPageLoad } = require('./utils');
const { handleCurrencyConfirmation } = require('./currencyConfirmation');
const { fillCustomsInfo } = require('./customsInfo');
const { verifyCardNumber } = require('./cardVerification');
const { validateOrderSum } = require('./validateOrder');
const { placeOrder } = require('./placeOrder');
const { recordOrder } = require('./orderRecord');

async function handlePreOrderPage(page, preOrderParams) {
  console.log('[preOrderPage] -> Начало handlePreOrderPage');

  // 1) Ждем полной загрузки страницы
  await waitForFullPageLoad(page);

  // 2) Если есть поп-ап подтверждения валюты, нажимаем "Продолжить с USD"
  await handleCurrencyConfirmation(page);

  // 3) Заполняем таможенную информацию
  if (!preOrderParams.addressData) {
    throw new Error('[preOrderPage] -> Отсутствуют данные адреса для заполнения таможенной информации');
  }
  await fillCustomsInfo(page, preOrderParams.addressData);

  // 4) Подтверждаем номер карты, если требуется
  const selectedCardLast4 = await verifyCardNumber(page, preOrderParams.fullCards);
  preOrderParams.selectedCardLast4 = selectedCardLast4 || '';

  // 5) Проверяем целостность позиций товаров (сумму заказа)
  await validateOrderSum(page, preOrderParams.cartTotal);

  // 6) Нажимаем на кнопку разместить заказ
  await placeOrder(page);

  // 7) Ждем завершения заказа и записываем данные заказа
  await recordOrder(page, preOrderParams);

  console.log('[preOrderPage] -> handlePreOrderPage завершён.');
}

module.exports = { handlePreOrderPage };
