// scripts/sync/orderedProducts.js

const { logActions } = require('../utils');

async function syncOrderedProducts(page, ws, syncData) {
  let stateOfOrderedProducts = null;

  // Здесь будет логика получения списка заказанных товаров, когда будут инструкции.
  // Пока заглушка.

  if (syncData.orderedProducts) {
    await logActions('Получаем список заказанных товаров...', ws, 'in-progress');
    // Заглушка:
    // stateOfOrderedProducts = [{ productId: 'ABC123', title: 'Example Product' }];
    await logActions('Список заказанных товаров получен', ws, 'in-progress');
  }

  return syncData.orderedProducts ? stateOfOrderedProducts : null;
}

module.exports = { syncOrderedProducts };
