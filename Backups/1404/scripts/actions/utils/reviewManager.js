// reviewManager.js

const fs = require('fs');
const path = require('path');

// Утилиты (пути подправьте, если у вас другая структура):
const { checkAndSolveCaptchaInPlace } = require('../../captcha');
const { safeWaitForLoad } = require('../utils/pageLoadHelper');

// ----------------------------------------------------------------
// Настройки (управляем скоростью печати и таймингами):
// ----------------------------------------------------------------
const SETTINGS = {
  typingDelay: { min: 30, max: 80 },          // задержка при печати символов
  betweenCardsDelay: { min: 1000, max: 2000 },  // задержка между карточками
  afterSendDelay: { min: 2000, max: 3000 },      // задержка после отправки отзыва
  loadMoreDelay: { min: 3000, max: 5000 },       // задержка ожидания подгрузки новых карточек
  spinnerWaitTimeout: 15000,                   // макс. время ожидания исчезновения спиннера, мс
  reviewApiTimeout: 15000                      // время ожидания успешного ответа от API отправки отзыва
};

// Случайная пауза
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Случайный int в диапазоне [min, max]
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Возвращает случайный элемент из массива
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Читаем JSON-файл с массивом строк (например, titles.json или reviews.json).
 * Предполагается, что файлы лежат в папке "data", расположенной рядом с этим файлом.
 */
function readArrayFromJson(filename) {
  try {
    const filePath = path.join(__dirname, 'data', filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr;
    }
    console.log(`[reviewManager] Файл "${filename}" не является массивом, возвращаем пустой массив.`);
    return [];
  } catch (error) {
    console.log(`[reviewManager] Ошибка чтения файла "${filename}":`, error);
    return [];
  }
}

/**
 * Очищает поле (input/textarea) и вводит новый текст с имитацией печати.
 * Возвращает true, если итоговое значение совпало с заданным текстом, иначе false.
 */
async function clearAndType(page, elementHandle, text) {
  await elementHandle.click({ clickCount: 3 });
  await elementHandle.press('Backspace');
  const length = text.length;
  for (let i = 0; i < length; i++) {
    const char = text.charAt(i);
    const delay = getRandomInt(SETTINGS.typingDelay.min, SETTINGS.typingDelay.max);
    await elementHandle.type(char, { delay });
  }
  const typedValue = await page.evaluate(el => el.value, elementHandle);
  return (typedValue === text);
}

/**
 * Основная функция для автоматизации заполнения отзывов.
 * @param {object} page - Puppeteer Page
 * @param {object|null} ws - объект для логирования/капчи или null
 */
async function reviewManager(page, ws) {
  console.log('[reviewManager] -> Начало reviewManager...');

  // Загружаем массив заголовков и отзывов
  const titles = readArrayFromJson('titles.json');
  const reviews = readArrayFromJson('reviews.json');

  // 1) Переходим на страницу отзывов
  const targetUrl = 'https://kz.iherb.com/ugc/myaccount/review?filter=2';
  console.log(`[reviewManager] -> Переход по URL: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // 2) Сначала решаем капчу (если есть)
  await checkAndSolveCaptchaInPlace(page, ws, 20000);

  // 3) Ждём полной загрузки страницы
  await safeWaitForLoad(page, 10000);

  let totalProcessed = 0;
  let totalFailed = 0;
  let captchaEncountered = false;

  // Селектор спиннера (согласно вашему HTML)
  const SPINNER_SELECTOR = 'div.MuiBox-root.css-vpm3mf svg.css-hqngwm';

  while (true) {
    // Обновляем список карточек
    const cards = await page.$$('.MuiBox-root.css-it1mab');
    if (cards.length === 0) {
      console.log('[reviewManager] -> Карточек не найдено, выходим из цикла.');
      break;
    }

    for (let i = 0; i < cards.length; i++) {
      console.log(`[reviewManager] -> Обработка карточки #${i}`);

      // Прокручиваем карточку в видимую область
      await page.evaluate(el => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, cards[i]);

      await sleep(getRandomInt(SETTINGS.betweenCardsDelay.min, SETTINGS.betweenCardsDelay.max));

      // Кликаем по карточке для её раскрытия
      await cards[i].click();
      await sleep(getRandomInt(SETTINGS.betweenCardsDelay.min, SETTINGS.betweenCardsDelay.max));

      // Получаем раскрытую карточку (последний элемент с селектором)
      const expandedCards = await page.$$('.MuiBox-root.css-7b4gkj');
      if (expandedCards.length === 0) {
        console.log(`[reviewManager] -> Не нашли раскрытую карточку после клика (#${i}).`);
        totalFailed++;
        continue;
      }
      const currentExpandedCard = expandedCards[expandedCards.length - 1];

      // Выбираем рейтинг (4 или 5)
      const ratingValue = getRandomInt(4, 5);
      const ratingLabels = await currentExpandedCard.$$('#ratingValue label');
      if (ratingLabels.length < ratingValue) {
        console.log(`[reviewManager] -> Недостаточно звёзд для рейтинга = ${ratingValue} (#${i}).`);
        totalFailed++;
        continue;
      }
      await ratingLabels[ratingValue - 1].click();
      console.log(`[reviewManager] -> Поставлен рейтинг: ${ratingValue}`);

      // Проверяем галочки «Принять правила»
      // Для guideline1 проверяем ещё раз непосредственно перед отправкой
      for (const dataTestId of ['write-review-agree-guideline1', 'write-review-agree-guideline2']) {
        const checkboxSelector = `[data-testid="${dataTestId}"] > .PrivateSwitchBase-input`;
        const checkbox = await currentExpandedCard.$(checkboxSelector);
        if (checkbox) {
          const isChecked = await page.evaluate(el => el.checked, checkbox);
          if (!isChecked) {
            await checkbox.click();
            console.log(`[reviewManager] -> Установлена галочка для ${dataTestId}.`);
            // Дополнительная проверка для guideline1 перед отправкой
            if (dataTestId === 'write-review-agree-guideline1') {
              const nowChecked = await page.evaluate(el => el.checked, checkbox);
              if (!nowChecked) {
                console.log('[reviewManager] -> Не удалось установить галочку для guideline1, пропускаем отзыв.');
                totalFailed++;
                continue;
              }
            }
          }
        } else {
          console.log(`[reviewManager] -> Элемент чекбокса ${dataTestId} не найден (#${i}).`);
        }
      }

      // Заполняем заголовок
      const titleSelector = 'input#reviewTitle, input[data-testid="write-review-title"]';
      const titleHandle = await currentExpandedCard.$(titleSelector);
      if (!titleHandle) {
        console.log(`[reviewManager] -> Поле заголовка не найдено (#${i}).`);
        totalFailed++;
        continue;
      }
      const randomTitle = getRandomElement(titles) || 'Отличный продукт';
      let typedOK = await clearAndType(page, titleHandle, randomTitle);
      if (!typedOK) {
        console.log('[reviewManager] -> Заголовок не совпал при первом вводе, пробуем ещё раз...');
        typedOK = await clearAndType(page, titleHandle, randomTitle);
        if (!typedOK) {
          console.log('[reviewManager] -> Не удалось ввести нужный заголовок, пропускаем отзыв.');
          totalFailed++;
          continue;
        }
      }
      console.log(`[reviewManager] -> Заголовок введён: "${randomTitle}"`);

      // Заполняем текст отзыва
      const reviewSelector = 'textarea#reviewText, textarea[data-testid="write-review-text"]';
      const reviewHandle = await currentExpandedCard.$(reviewSelector);
      if (!reviewHandle) {
        console.log(`[reviewManager] -> Поле отзыва не найдено (#${i}).`);
        totalFailed++;
        continue;
      }
      const randomReview = getRandomElement(reviews) || 'Продукт понравился.';
      typedOK = await clearAndType(page, reviewHandle, randomReview);
      if (!typedOK) {
        console.log('[reviewManager] -> Текст отзыва не совпал при первом вводе, пробуем ещё раз...');
        typedOK = await clearAndType(page, reviewHandle, randomReview);
        if (!typedOK) {
          console.log('[reviewManager] -> Не удалось ввести нужный текст отзыва, пропускаем.');
          totalFailed++;
          continue;
        }
      }
      console.log(`[reviewManager] -> Отзыв введён (начало: "${randomReview.slice(0, 50)}...")`);

      await sleep(getRandomInt(SETTINGS.betweenCardsDelay.min, SETTINGS.betweenCardsDelay.max));

      // Перед кликом на кнопку «Отправить» дополнительно проверяем, что галочка guideline1 установлена
      const guidelineCheckboxSelector = '[data-testid="write-review-agree-guideline1"] > .PrivateSwitchBase-input';
      const guidelineCheckbox = await currentExpandedCard.$(guidelineCheckboxSelector);
      if (guidelineCheckbox) {
        const isChecked = await page.evaluate(el => el.checked, guidelineCheckbox);
        if (!isChecked) {
          await guidelineCheckbox.click();
          const nowChecked = await page.evaluate(el => el.checked, guidelineCheckbox);
          if (!nowChecked) {
            console.log('[reviewManager] -> Не удалось установить галочку для guideline1 перед отправкой, пропускаем отзыв.');
            totalFailed++;
            continue;
          }
          console.log('[reviewManager] -> Галочка для guideline1 установлена перед отправкой.');
        }
      }

      // Ищем кнопку «Отправить»
      let submitButton = await currentExpandedCard.$('button[data-testid="submit-review"]');
      if (!submitButton) {
        const allSubmitButtons = await page.$$('button[data-testid="submit-review"]');
        for (const btn of allSubmitButtons) {
          const parent = await btn.evaluate(node => node.closest('.MuiBox-root.css-7b4gkj'));
          if (parent) {
            // Если parent соответствует currentExpandedCard, используем эту кнопку
            if (await parent.evaluate((n, target) => n.isEqualNode(target), currentExpandedCard)) {
              submitButton = btn;
              break;
            }
          }
        }
      }

      if (!submitButton) {
        console.log(`[reviewManager] -> Кнопка "Отправить" не найдена (#${i}).`);
        totalFailed++;
        continue;
      }

      // Кликаем кнопку «Отправить»
      await submitButton.click();
      console.log(`[reviewManager] -> Нажата кнопка "Отправить" (#${i}), ожидаем ответ API и исчезновение спиннера...`);

      // Ждём успешный API-ответ от отправки отзыва
      try {
        await page.waitForResponse(
          response => response.url() === 'https://kz.iherb.com/ugc/api/customer/review/v2' && response.status() === 201,
          { timeout: SETTINGS.reviewApiTimeout }
        );
        console.log('[reviewManager] -> Получен API-ответ со статусом 201 (отзыв успешно отправлен).');
      } catch (apiError) {
        console.log('[reviewManager] -> Не удалось получить успешный API-ответ, отзыв может не отправиться.');
        totalFailed++;
        continue;
      }

      // Ждём, пока исчезнет спиннер (если он появился)
      try {
        await page.waitForSelector(SPINNER_SELECTOR, { hidden: true, timeout: SETTINGS.spinnerWaitTimeout });
        console.log('[reviewManager] -> Спиннер исчез, отзыв отправлен корректно.');
      } catch (spinnerError) {
        console.log('[reviewManager] -> Спиннер не исчез в заданное время, возможно, отправка не завершилась.');
        totalFailed++;
        continue;
      }

      totalProcessed++;
      await sleep(getRandomInt(SETTINGS.afterSendDelay.min, SETTINGS.afterSendDelay.max));

      // Проверяем наличие капчи после отправки
      const captchaElem = await page.$('.captcha-class-selector');
      if (captchaElem) {
        console.log('[reviewManager] -> Обнаружена капча после отправки отзыва, прекращаем обработку.');
        captchaEncountered = true;
        break;
      }
    } // конец цикла for (cards)

    if (captchaEncountered) break;

    // Ищем кнопку «Загрузить ещё»
    const loadMoreButton = await page.$('div.MuiBox-root.css-xi606m > div[role="button"]');
    if (loadMoreButton) {
      const buttonText = await loadMoreButton.evaluate(el => el.textContent);
      if (buttonText && buttonText.includes('Загрузить еще')) {
        await page.evaluate(el => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, loadMoreButton);
        await loadMoreButton.click();
        console.log('[reviewManager] -> Нажата кнопка "Загрузить еще", ожидаем загрузку новых карточек.');
        await sleep(getRandomInt(SETTINGS.loadMoreDelay.min, SETTINGS.loadMoreDelay.max));
        continue;
      }
    }

    console.log('[reviewManager] -> Кнопка "Загрузить еще" не найдена или карточки закончились.');
    break;
  } // конец цикла while

  console.log('[reviewManager] -> Завершено.');
  console.log(`[reviewManager] -> Всего успешно отправлено отзывов: ${totalProcessed}`);
  console.log(`[reviewManager] -> Ошибок/пропусков: ${totalFailed}`);
  if (captchaEncountered) {
    console.log('[reviewManager] -> В процессе возникла капча, работа прервана.');
  }
}

module.exports = { reviewManager };
