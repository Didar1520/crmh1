// scripts/sync/syncData.js

const { syncRewards } = require('./rewards');
const { syncReviews } = require('./reviews'); // Раскомментировали для вызова reviews
const { syncMainInfo } = require('./mainInfo');
const { logActions } = require('../utils');
const { syncOrders } = require('./orders');

/**
 * Универсальная функция для вызова синхронизаций
 */
async function syncData(page, ws, syncData) {
  const result = {
    mainInfo: null,
    rewards: null,
    reviews: null,
    // Добавим сюда же поле orders, если нужно
    orders: null
    // ...orderedProducts, ...
  };

  // Пример: синхронизация основной инфы
  if (syncData.refCode || syncData.cards || syncData.addresses) {
    await logActions('Синхронизация основной информации...', ws, 'in-progress');
    result.mainInfo = await syncMainInfo(page, ws, syncData);
  } else {
    console.log('[syncData] Пропущена синхронизация основной информации.');
  }

  // Синхронизация вознаграждений
  if (syncData.rewards) {
    await logActions('Получаем состояние вознаграждений...', ws, 'in-progress');
    result.rewards = await syncRewards(page, ws, syncData);
  } else {
    console.log('[syncData] Пропущена синхронизация вознаграждений (rewards=false).');
  }

  // Синхронизация отзывов
  if (syncData.reviews) {
    await logActions('Получаем состояние отзывов...', ws, 'in-progress');
    result.reviews = await syncReviews(page, ws, syncData);
  } else {
    console.log('[syncData] Пропущена синхронизация отзывов (reviews=false).');
  }

  // Синхронизация заказов (НОВЫЙ КОД)
  // Если syncData.orders === false, пропускаем
  // Если syncData.orders === { ... }, вызываем syncOrders
  if (syncData.orders) {
    await logActions('Получаем состояние заказов...', ws, 'in-progress');
    try {
      result.orders = await syncOrders(page, ws, syncData);
    } catch (err) {
      console.log('[syncData] Ошибка при syncOrders:', err);
    }
  } else {
    console.log('[syncData] Пропущена синхронизация заказов (orders=false).');
  }

  // ... остальное (orderedProducts) можно добавить по аналогии

  await logActions('Все данные синхронизированы', ws, 'in-progress');
  return result;
}

module.exports = { syncData };
