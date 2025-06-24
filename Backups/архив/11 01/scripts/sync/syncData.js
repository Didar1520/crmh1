// scripts/sync/syncData.js

const { syncRewards } = require('./rewards');
// Примерно так же будут подключаться ваши модули:
// const { syncReviews } = require('./reviews');
// const { syncOrders } = require('./orders');
// const { syncOrderedProducts } = require('./orderedProducts');
const { syncMainInfo } = require('./mainInfo');
const { logActions } = require('../utils');

/**
 * Универсальная функция для вызова синхронизаций,
 * в зависимости от флагов в syncData (rewards, reviews, orderedProducts, и т.д.).
 */
async function syncData(page, ws, syncData) {
  const result = {
    mainInfo: null,
    rewards: null,
    orders: null,
    orderedProducts: null,
    reviews: null,
    // ...и т.д. если есть ещё
  };

  // Пример: синхронизация главной инфы (например, refCode, cards, addresses)
  if (syncData.refCode || syncData.cards || syncData.addresses) {
    await logActions('Синхронизация основной информации...', ws, 'in-progress');
    result.mainInfo = await syncMainInfo(page, ws, syncData);
  } else {
    // Не выводим громкие логи, если отключено:
    console.log('[syncData] Пропущена синхронизация основной информации (refCode/cards/addresses).');
  }

  // Синхронизация вознаграждений
  if (syncData.rewards) {
    await logActions('Получаем состояние вознаграждений...', ws, 'in-progress');
    result.rewards = await syncRewards(page, ws, syncData);
  } else {
    console.log('[syncData] Пропущена синхронизация вознаграждений (rewards=false).');
  }

  // Пример: если есть модуль syncOrders
  if (syncData.orders) {
    await logActions('Синхронизация заказов...', ws, 'in-progress');
    // result.orders = await syncOrders(page, ws, syncData);
  } else {
    console.log('[syncData] Пропущена синхронизация заказов (orders=false).');
  }

  // Пример: syncOrderedProducts
  if (syncData.orderedProducts) {
    await logActions('Получаем список заказанных товаров...', ws, 'in-progress');
    // result.orderedProducts = await syncOrderedProducts(page, ws, syncData);
  } else {
    console.log('[syncData] Пропущена синхронизация списка заказанных товаров (orderedProducts=false).');
  }

  // Пример: syncReviews
  if (syncData.reviews) {
    await logActions('Получаем отзывы...', ws, 'in-progress');
    // result.reviews = await syncReviews(page, ws, syncData);
  } else {
    console.log('[syncData] Пропущена синхронизация отзывов (reviews=false).');
  }

  await logActions('Все данные синхронизированы', ws, 'in-progress');
  return result;
}

module.exports = { syncData };
