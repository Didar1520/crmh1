// scripts/actions/orderManager/syncRunner.js
const { syncOrders }          = require('../../sync/orders.js');
const { syncReviews }         = require('../../sync/reviews.js');
const { syncRewards }         = require('../../sync/rewards.js');
const { syncOrderedProducts } = require('../../sync/orderedProducts.js');
const { captureOrders }       = require('../../sync/captureOrders.js');
const { reviewManager }       = require('../utils/reviewManager.js');
const logger                  = require('./logger.js');

// карта «имя флага → функция синхронизации»
const syncMap = {
  syncOrders,
  syncReviews,
  syncRewards,
  syncOrderedProducts,
  captureOrders,
  reviewManager,
};

/**
 * Выполняет sync-флаги из объекта item.
 * Возвращает { reviewsDone, rewardsDone } — нужны для записи дат синхронизаций.
 */
module.exports = async function runSyncFlags(item, page, ws = null) {
  // флаги «успешно выполнено»
  let reviewsDone = false;
  let rewardsDone = false;

  for (const [key, enabled] of Object.entries(item)) {
    if (!enabled) continue;               // пропускаем отключённые
    const fn = syncMap[key];
    if (!fn) continue;                    // неизвестный флаг — игнор

    logger.info(`[syncRunner] -> Запуск ${key}…`);
    if (key === 'captureOrders') {
      const res = await fn(page, enabled);
      logger.info(`[captureOrders] -> done ${res.done.length} skipped ${res.skipped.length} errors ${res.errors.length}`);
    } else {
      await fn(page, ws, typeof enabled === 'object' ? enabled : {});
    }

    if (key === 'syncReviews') reviewsDone = true;
    if (key === 'syncRewards') rewardsDone = true;
  }

  return { reviewsDone, rewardsDone };
};
