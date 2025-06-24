// scripts/sync/syncData.js

const { syncRewards } = require('./rewards');
// Пример: const { syncReviews } = require('./reviews');
const { syncMainInfo } = require('./mainInfo');
const { logActions } = require('../utils');

/**
 * Универсальная функция для вызова синхронизаций
 */
async function syncData(page, ws, syncData) {
  const result = {
    mainInfo: null,
    rewards: null
    // orders, orderedProducts, reviews...
  };

  // Пример: синхронизация главной инфы
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

  // ...остальные модули (orders, reviews)

  await logActions('Все данные синхронизированы', ws, 'in-progress');
  return result;
}

module.exports = { syncData };
