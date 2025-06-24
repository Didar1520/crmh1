// scripts/actions/orderManager.js
/**
 * !!!! НИЧЕГО НЕ ТРОГАТЬ !!!!
 * Высший управляющий модуль для процесса оформления заказа.
 * Этот модуль отвечает за:
 *  - Вызов утилит по выбору аккаунта, адреса, промокода и других динамических параметров.
 *  - Ориентирование по этапам заказа.
 *  - Контроль исходной и финальной суммы заказа.
 *  - Перезагрузку страницы при зависании.
 *  - Взаимодействие с администратором программы.
 */

const { selectOptimalAccount } = require('./utils/accountSelector');
const { checkCartProducts } = require('./utils/productUtility');

const addProductsPage = require('./pages/addProductsPage');
const addressBookPage = require('./pages/addressBookPage');
const addAddressPage = require('./pages/addAddressPage');
const cartPage = require('./pages/cartPage');
const preOrderPage = require('./pages/preOrderPage');
const invoicePage = require('./pages/invoicePage');

async function processOrder(page, socket, orderParams) {
  try {
    // 1) Обработка страницы добавления товаров
    console.log('[orderManager] -> Начало процесса добавления товаров.');
    await addProductsPage.handleAddProducts(page, socket, orderParams);

    // Дополнительно: проверка товаров в корзине (утилита)
    const products = await checkCartProducts(page);
    console.log('[orderManager] -> Найденные товары в корзине:', products);

    // 2) Работа с адресной книгой
    console.log('[orderManager] -> Обработка адресной книги.');
    const addressExists = await addressBookPage.checkAddressExists(page, socket, orderParams);
    if (!addressExists) {
      console.log('[orderManager] -> Адрес не найден, добавление нового адреса.');
      await addAddressPage.addNewAddress(page, socket, orderParams);
    }

    // 3) Обработка страницы корзины (применение промокода, контроль суммы и т.д.)
    console.log('[orderManager] -> Обработка корзины.');
    const cartResult = await cartPage.handleCart(page, socket, orderParams);
    if (!cartResult.success) {
      console.log('[orderManager] -> Обнаружена проблема с суммой заказа или иная ошибка.');
      // Здесь можно добавить логику уведомления администратора или отмены заказа
      return false;
    }

    // 4) Предварительная проверка заказа
    console.log('[orderManager] -> Выполнение предварительной проверки заказа.');
    const preOrderOk = await preOrderPage.verifyPreOrder(page, socket, orderParams);
    if (!preOrderOk) {
      console.log('[orderManager] -> Предварительная проверка заказа не пройдена.');
      return false;
    }

    // 5) Подтверждение заказа и получение инвойса
    console.log('[orderManager] -> Подтверждение заказа и получение инвойса.');
    const invoiceData = await invoicePage.processInvoice(page, socket, orderParams);
    console.log('[orderManager] -> Заказ успешно оформлен. Инвойс:', invoiceData);

    // Дополнительно: выбор оптимального аккаунта для заказа (если включено)
    if (orderParams.enableAccountSelection) {
      console.log('[orderManager] -> Выполняется утилита выбора оптимального аккаунта.');
      const optimalAccount = await selectOptimalAccount(orderParams);
      console.log('[orderManager] -> Оптимальный аккаунт:', optimalAccount);
      orderParams.account = optimalAccount;
    }

    return invoiceData;
  } catch (error) {
    console.error('[orderManager] -> Ошибка процесса заказа:', error);
    return false;
  }
}

module.exports = { processOrder };
