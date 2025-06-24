// scripts/sync/syncData.js

const { syncMainInfo } = require('./mainInfo');
const { syncRewards } = require('./rewards');
const { syncOrders } = require('./orders');
const { syncOrderedProducts } = require('./orderedProducts');
const { syncReviews } = require('./reviews');
const { logActions } = require('../utils');
const { sleep } = require('../utils');

async function syncData(page, ws, syncData) {
  await logActions('Синхронизация основной информации...', ws, 'in-progress');
  const mainInfo = await syncMainInfo(page, ws, syncData);
  await sleep(500);

  await logActions('Получаем состояние наград...', ws, 'in-progress');
  const rewards = await syncRewards(page, ws, syncData);
  await sleep(500);

  if (syncData.orders) {
    await logActions('Получаем историю заказов...', ws, 'in-progress');
    const orders = await syncOrders(page, ws, syncData);
    await sleep(500);
    
    if (syncData.orderedProducts) {
      await logActions('Получаем список заказанных товаров...', ws, 'in-progress');
      const orderedProducts = await syncOrderedProducts(page, ws, syncData);
      await sleep(500);
      
      if (syncData.reviews) {
        await logActions('Получаем отзывы...', ws, 'in-progress');
        const reviews = await syncReviews(page, ws, syncData);
        await sleep(500);
        
        await logActions('Все данные синхронизированы', ws, 'in-progress');
        return {
          mainInfo: mainInfo,
          rewards: rewards,
          orders: orders,
          orderedProducts: orderedProducts,
          reviews: reviews
        };
      } else {
        await logActions('Все данные синхронизированы', ws, 'in-progress');
        return {
          mainInfo: mainInfo,
          rewards: rewards,
          orders: orders,
          orderedProducts: orderedProducts,
          reviews: null
        };
      }
    } else {
      if (syncData.reviews) {
        await logActions('Получаем отзывы...', ws, 'in-progress');
        const reviews = await syncReviews(page, ws, syncData);
        await sleep(500);
        
        await logActions('Все данные синхронизированы', ws, 'in-progress');
        return {
          mainInfo: mainInfo,
          rewards: rewards,
          orders: orders,
          orderedProducts: null,
          reviews: reviews
        };
      } else {
        await logActions('Все данные синхронизированы', ws, 'in-progress');
        return {
          mainInfo: mainInfo,
          rewards: rewards,
          orders: orders,
          orderedProducts: null,
          reviews: null
        };
      }
    }
  } else {
    if (syncData.orderedProducts) {
      await logActions('Получаем список заказанных товаров...', ws, 'in-progress');
      const orderedProducts = await syncOrderedProducts(page, ws, syncData);
      await sleep(500);
      
      if (syncData.reviews) {
        await logActions('Получаем отзывы...', ws, 'in-progress');
        const reviews = await syncReviews(page, ws, syncData);
        await sleep(500);
        
        await logActions('Все данные синхронизированы', ws, 'in-progress');
        return {
          mainInfo: mainInfo,
          rewards: rewards,
          orders: null,
          orderedProducts: orderedProducts,
          reviews: reviews
        };
      } else {
        await logActions('Все данные синхронизированы', ws, 'in-progress');
        return {
          mainInfo: mainInfo,
          rewards: rewards,
          orders: null,
          orderedProducts: orderedProducts,
          reviews: null
        };
      }
    } else {
      if (syncData.reviews) {
        await logActions('Получаем отзывы...', ws, 'in-progress');
        const reviews = await syncReviews(page, ws, syncData);
        await sleep(500);
        
        await logActions('Все данные синхронизированы', ws, 'in-progress');
        return {
          mainInfo: mainInfo,
          rewards: rewards,
          orders: null,
          orderedProducts: null,
          reviews: reviews
        };
      } else {
        await logActions('Все данные синхронизированы', ws, 'in-progress');
        return {
          mainInfo: mainInfo,
          rewards: rewards,
          orders: null,
          orderedProducts: null,
          reviews: null
        };
      }
    }
  }
}

module.exports = { syncData };
