// scripts/sync/orders.js

const { logActions } = require('../utils');

async function syncOrders(page, ws, syncData) {
  let stateOfOrders = null;

  // Здесь будет логика получения заказов (orders), когда будут инструкции.
  // Пока оставим заглушку.

  if (syncData.orders) {
    await logActions('Получаем историю заказов...', ws, 'in-progress');
    // Заглушка:
    // stateOfOrders = [{ orderId: '123456', status: 'completed' }];
    await logActions('История заказов получена', ws, 'in-progress');
  }

  return syncData.orders ? stateOfOrders : null;
}

module.exports = { syncOrders };
