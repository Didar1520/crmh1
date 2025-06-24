// scripts/sync/reviews.js

const { logActions, waitForStateChange } = require('../utils');
const { getAccData, saveAccData } = require('../dataManager');
const { checkAndSolveCaptchaInPlace } = require('../captcha');

async function syncReviews(page, ws, syncData) {
  let reviewsData = null;
  let currentUserEmail = null;

  await logActions('Получаем состояние отзывов...', ws, 'in-progress');

  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    if (status !== 200) return; // пропускаем всё, что не 200

    // Проверим контент-тип (на всякий случай)
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return; // пропускаем не-JSON
    }

    // 1) currentUser
    if (url.includes('catalog.app.iherb.com/catalog/currentUser')) {
      let textBody = '';
      try {
        textBody = await response.text();
      } catch (errRead) {
        console.log('[syncReviews] Ошибка чтения currentUser:', errRead);
        return;
      }
      if (!textBody) {
        console.log('[syncReviews] currentUser вернул пустое тело, пропускаем');
        return;
      }
      try {
        const json = JSON.parse(textBody);
        currentUserEmail = json.email || null;
      } catch (errParse) {
        console.log('[syncReviews] Ошибка парсинга currentUser:', errParse);
      }
    }

    // 2) СТАРЫЙ вариант: /product/reviews/state
    if (url.includes('/product/reviews/state')) {
      let textBody = '';
      try {
        textBody = await response.text();
      } catch (errRead2) {
        console.log('[syncReviews] Ошибка чтения ответа reviews:', errRead2);
        return;
      }
      if (!textBody) {
        console.log('[syncReviews] /product/reviews/state пустой ответ, пропускаем');
        return;
      }
      try {
        const jsonContentResponse = JSON.parse(textBody);
        reviewsData = {
          productsWithoutReviews: jsonContentResponse.productsWithoutReviews,
          previouslyReviewed: jsonContentResponse.previouslyReviewed,
          totalProducts: jsonContentResponse.totalProducts
        };
        console.log('[syncReviews] Получены данные отзывов (старый эндпоинт):', reviewsData);
      } catch (errParse2) {
        console.log('[syncReviews] Ошибка чтения ответа reviews:', errParse2);
      }
    }

    // 3) НОВЫЙ вариант (то, что вы прислали): /ugc/api/customer/review/history/summary?languageCode=ru-RU
    if (url.includes('/ugc/api/customer/review/history/summary')) {
      let textBody = '';
      try {
        textBody = await response.text();
      } catch (errRead3) {
        console.log('[syncReviews] Ошибка чтения summary:', errRead3);
        return;
      }
      if (!textBody) {
        console.log('[syncReviews] summary вернул пустое тело, пропускаем');
        return;
      }

      try {
        const arr = JSON.parse(textBody);
        if (Array.isArray(arr)) {
          // Ищем объекты: { id:2, number:..., name:... }, { id:3, number:..., name:... }
          const itemId2 = arr.find((item) => item.id === 2);
          const itemId3 = arr.find((item) => item.id === 3);
          
          const notYetReviewedCount = itemId2 ? itemId2.number : 0;
          const previouslyReviewedCount = itemId3 ? itemId3.number : 0;
          const total = notYetReviewedCount + previouslyReviewedCount;

          reviewsData = {
            productsWithoutReviews: notYetReviewedCount,
            previouslyReviewed: previouslyReviewedCount,
            totalProducts: total
          };
          console.log('[syncReviews] Получены данные отзывов (summary):', reviewsData);
        } else {
          console.log('[syncReviews] summary не вернул массив, пропускаем');
        }
      } catch (errParse3) {
        console.log('[syncReviews] Ошибка парсинга summary:', errParse3);
      }
    }
  });

  // Заходим на страницу отзывов (пример)
  await page.goto('https://kz.iherb.com/ugc/myaccount/review?filter=2', {
    waitUntil: 'networkidle2'
  });

  // Точечно проверяем капчу
  await checkAndSolveCaptchaInPlace(page, ws, 10000);

  // Ждём, пока reviewsData != null (или ловим timeout)
  try {
    await waitForStateChange(() => reviewsData !== null, 2000, 30000);
  } catch (timeoutErr) {
    console.log('[syncReviews] Timeout при ожидании reviewsData. Ставим reviewsData = {} и идём дальше.');
    reviewsData = {};
  }

  await logActions('Получено состояние отзывов', ws, 'in-progress');

  // Записываем в accData.json, привязав к email
  if (!currentUserEmail) {
    console.log('[syncReviews] Не удалось определить email => запись в JSON пропущена');
  } else {
    try {
      const accData = await getAccData();
      if (!accData || !accData.accounts) {
        console.log('[syncReviews] accData.json пустой или невалидный');
      } else {
        const userIndex = accData.accounts.findIndex(
          (acc) => acc.email.toLowerCase() === currentUserEmail.toLowerCase()
        );

        if (userIndex === -1) {
          console.log(`[syncReviews] Аккаунт "${currentUserEmail}" не найден в accData.json, пропускаем`);
        } else {
          const user = accData.accounts[userIndex];
          if (!user.reviews) user.reviews = {};

          // Перезапишем поля
          user.reviews.productsWithoutReviews = reviewsData.productsWithoutReviews || 0;
          user.reviews.productsWithReviews = reviewsData.previouslyReviewed || 0;
          user.reviews.totalProducts = reviewsData.totalProducts || 0;

          await saveAccData(accData);

          console.log(`[syncReviews] Данные отзывов для "${currentUserEmail}" сохранены в accData.json`);
          // ДОБАВЛЕННЫЙ ЛОГ:
          console.log('[syncReviews] -> reviewsData:', reviewsData);
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
