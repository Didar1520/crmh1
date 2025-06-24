// scripts/sync/reviews.js

const { logActions, waitForStateChange } = require('../utils');

async function syncReviews(page, ws, syncData) {
  let stateOfReviews = null;

  if (syncData.reviews) {
    await logActions('Получаем состояние отзывов...', ws, 'in-progress');

    page.on('response', async response => {
      const url = response.url();

      if (url.includes('/ugc/api/customer/review/history/summary')) {
        try {
          const contentResponse = await response.text();
          const jsonContentResponse = JSON.parse(contentResponse);

          const reviewsData = jsonContentResponse.reduce((acc, item) => {
            if (item.name === 'Not yet reviewed') {
              acc.productsWithoutReviews = item.number;
            }
            if (item.name === 'Previously reviewed') {
              acc.previouslyReviewed = item.number;
            }
            return acc;
          }, {});

          reviewsData.totalProducts = (reviewsData.productsWithoutReviews || 0) + (reviewsData.previouslyReviewed || 0);
          stateOfReviews = reviewsData;

          console.log('Данные отзывов:', stateOfReviews);
        } catch (err) {
          console.log('Ошибка чтения ответа reviews:', err);
        }
      }
    });

    // Переходим на страницу отзывов
    await page.goto('https://kz.iherb.com/ugc/myaccount/review?filter=2', { waitUntil: 'networkidle2' });

    // Ожидаем появления stateOfReviews
    await waitForStateChange(() => stateOfReviews !== null);

    await logActions('Получено состояние отзывов', ws, 'in-progress');
  }

  return syncData.reviews ? stateOfReviews : null;
}

module.exports = { syncReviews };
