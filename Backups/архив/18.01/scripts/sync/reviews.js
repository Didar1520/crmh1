// scripts/sync/reviews.js

const { logActions, waitForStateChange } = require('../utils');
const { getAccData, saveAccData } = require('../dataManager');
const { checkAndSolveCaptchaInPlace } = require('../captcha');

async function syncReviews(page, ws, syncData) {
  let reviewsData = null;
  let currentUserEmail = null;

  await logActions('Получаем состояние отзывов...', ws, 'in-progress');

  // Отслеживаем ответ, где можно узнать email (если нужно)
  page.on('response', async (response) => {
    const url = response.url();

    // catalog/app.iherb.com/catalog/currentUser
    if (url.includes('catalog.app.iherb.com/catalog/currentUser')) {
      try {
        const content = await response.text();
        const json = JSON.parse(content);
        currentUserEmail = json.email || null;
      } catch (err) {
        console.log('[syncReviews] Ошибка чтения currentUser:', err);
      }
    }

    // Допустим, у вас есть некий эндпоинт /product/reviews/state ...
    // или iHerb как-то иначе отдает инфу
    if (url.includes('/product/reviews/state')) {
      try {
        const contentResponse = await response.text();
        const jsonContentResponse = JSON.parse(contentResponse);
        // например, там есть поля previouslyReviewed и totalProducts
        reviewsData = {
          productsWithoutReviews: jsonContentResponse.productsWithoutReviews,
          previouslyReviewed: jsonContentResponse.previouslyReviewed,
          totalProducts: jsonContentResponse.totalProducts
        };
        console.log('[syncReviews] Получены данные отзывов:', reviewsData);
      } catch (err) {
        console.log('[syncReviews] Ошибка чтения ответа reviews:', err);
      }
    }
  });

  // Заходим на страницу отзывов (пример)
  await page.goto('https://secure.iherb.com/account/reviews', { waitUntil: 'networkidle2' });

  // Точечно проверяем капчу
  await checkAndSolveCaptchaInPlace(page, ws, 10000);

  // Ждём, пока reviewsData != null (или ждём N секунд, если сайт не даёт гарантии)
  await waitForStateChange(() => reviewsData !== null);
  await logActions('Получено состояние отзывов', ws, 'in-progress');

  // Записываем в accData.json, привязав к email
  if (!currentUserEmail) {
    console.log('[syncReviews] Не удалось определить email => запись в JSON пропущена');
  } else {
    try {
      const accData = await getAccData();
      if (!accData || !accData.accounts) {
        console.log('[syncReviews] accData.json пуст или невалиден');
      } else {
        const userIndex = accData.accounts.findIndex(
          (a) => a.email.toLowerCase() === currentUserEmail.toLowerCase()
        );
        if (userIndex === -1) {
          console.log(`[syncReviews] Аккаунт с email="${currentUserEmail}" не найден в accData.json`);
        } else {
          const user = accData.accounts[userIndex];
          if (!user.reviews) {
            user.reviews = {};
          }
          // Перезапишем поля
          user.reviews.productsWithoutReviews = reviewsData.productsWithoutReviews;
          user.reviews.productsWithReviews = reviewsData.previouslyReviewed;
          user.reviews.totalProducts = reviewsData.totalProducts;

          await saveAccData(accData);
          console.log(`[syncReviews] Данные отзывов для "${currentUserEmail}" сохранены в accData.json`);
        }
      }
    } catch (err) {
      console.log('[syncReviews] Ошибка при сохранении reviews в JSON:', err);
    }
  }

  // Возвращаем итог
  return reviewsData;
}

module.exports = { syncReviews };
