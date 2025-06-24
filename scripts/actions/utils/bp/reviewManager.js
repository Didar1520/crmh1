// reviewManager.js

const fs = require('fs');
const path = require('path');
const { safeClickWithRetry } = require('../utils/safeClick');
// Утилиты (пути подправьте, если у вас другая структура):
const { checkAndSolveCaptchaInPlace } = require('../../captcha');
const { safeWaitForLoad } = require('../utils/pageLoadHelper');

const REVIEWS_URL = 'https://kz.iherb.com/ugc/myaccount/review?filter=2';
let cardSeq = 1; // глобальный счётчик карточек 1,2,3…


// ----------------------------------------------------------------
// Настройки (управляем скоростью печати и таймингами):
// ----------------------------------------------------------------
const SETTINGS = {
  typingDelay: { min: 0, max: 0 },          // задержка при печати символов
  betweenCardsDelay: { min: 100, max: 200 },  // задержка между карточками
  afterSendDelay: { min: 100, max: 250 },      // задержка после отправки отзыва
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



// ----------------------------------------------------------------
// solvePxCaptcha – ждёт боковую px-captcha и решает её
// возвращает true, если капча была и решена; false – если капчи нет
// ----------------------------------------------------------------
async function solvePxCaptcha(page, ws) {
  const wrapperSel = '#catalog-px-captcha-wrapper';
  const exists = await page.$(wrapperSel);
  if (!exists) return false;                   // капчи нет

  console.log('[reviewManager] -> Обнаружена px-captcha, пробуем решить…');

  // временно увеличиваем таймауты
  const oldNavTimeout = page.getDefaultNavigationTimeout();
  page.setDefaultNavigationTimeout(120000);    // 2 мин на решение

  try {
    await checkAndSolveCaptchaInPlace(page, ws, 120000); // ваш solver
    console.log('[reviewManager] -> px-captcha решена.');
    return true;
  } catch (err) {
    console.log('[reviewManager] -> Не удалось решить px-captcha:', err.message);
    throw err;                                 // пусть обрабатывается выше
  } finally {
    page.setDefaultNavigationTimeout(oldNavTimeout);
    // вернули отображение контента – прокручиваем к началу, чтобы элементы были видимы
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));

  }
}

// ----------------------------------------------------------------
// isPxCaptchaActive – мгновенная проверка «жив ли» сайд-бар px-captcha
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// isPxCaptchaActive – true, когда боковая px-captcha действительно
//       видима и содержит challenge-iframe.
// ----------------------------------------------------------------
async function isPxCaptchaActive(page) {
  return page.evaluate(() => {
    // сам обёрточный div
    const wrap = document.querySelector('#catalog-px-captcha-wrapper');
    if (!wrap) return false;                             // узел вовсе отсутствует

    // если узел скрыт display:none / visibility:hidden – это не активная капча
    const style     = window.getComputedStyle(wrap);
    const visible   = style.display !== 'none' &&
                      style.visibility !== 'hidden';

    // если у узла нулевой размер – тоже не то
    const rect      = wrap.getBoundingClientRect();
    const hasArea   = rect.width > 0 && rect.height > 0;

    // настоящая px-captcha всегда содержит iframe с самим заданием
    const hasIframe = !!wrap.querySelector('iframe');

    return visible && hasArea && hasIframe;
  });
}




// ----------------------------------------------------------------
// Закрываем pop-up «Прочитав, я принимаю правила…», если он видим.
// ----------------------------------------------------------------
async function handleGuidelinePopup(page) {
  // ждём до 3 с видимую галочку pop-up’а
  const checkbox = await page.$('span[data-testid="review-guideline-checkbox"]', { visible: true }).catch(() => null);
  if (!checkbox) return false;                           // pop-up нет – выходим

  await checkbox.click();                                // ставим галочку

  // ждём, пока кнопка станет активной (disabled пропадёт)
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button[data-testid="review-guideline-agree-btn"]');
      return btn && !btn.disabled;
    },
    { timeout: 5000 }
  );
  await page.click('button[data-testid="review-guideline-agree-btn"]'); // нажимаем «Я принимаю»

  // ждём закрытия pop-up’а
  await page.waitForSelector('button[data-testid="review-guideline-agree-btn"]', { hidden: true, timeout: 10000 });
  return true;                                           // pop-up был и мы его закрыли
}


// ----------------------------------------------------------------
// tryLoadMore – надёжно кликает «Загрузить ещё» и ждёт новые карточки
// Возвращает true, если карточки появились, иначе false
// ----------------------------------------------------------------
async function tryLoadMore(page, prevCount) {
  // кнопка «Загрузить ещё»
  const loadSel = 'div.MuiBox-root.css-xi606m > div[role="button"]';
  await page.waitForSelector(loadSel, { visible: true, timeout: 5000 }).catch(() => null);
  const btn = await page.$(loadSel);
  if (!btn) return false;

  // скроллим к кнопке, кликаем
  await page.evaluate(el => el.scrollIntoView({ block: 'center' }), btn);
  await btn.click({ delay: 80 });

  // ждём либо новые карточки, либо навигацию на товарную страницу
  const loaded = await Promise.race([
    page.waitForFunction(cnt =>
      document.querySelectorAll('.MuiBox-root.css-it1mab').length > cnt,
      { timeout: 12000 }, prevCount).then(() => 'cards').catch(() => null),
    page.waitForNavigation({ waitUntil: 'load', timeout: 12000 }).then(() => 'nav').catch(() => null)
  ]);

  // если ушли на товар – вернёмся
  if (loaded === 'nav' && !page.url().startsWith(REVIEWS_URL)) {
    console.log('[reviewManager] -> Ушли на товар после "Загрузить ещё". Возвращаемся.');
    await page.goto(REVIEWS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await safeWaitForLoad(page, 10000);
    return true;          // страница перезагружена – цикл продолжится
  }

  // прокручиваем вверх — новые карточки начинаются сверху списка
  if (loaded === 'cards') {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(600);
    return true;
  }

  return false;           // ни карты, ни навигации – считаем ошибка
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
  // очищаем поле
  await elementHandle.click({ clickCount: 3 });
  await elementHandle.press('Backspace');



  // если нужна одна-единственная буква — просто «нажимаем» её
  if (text.length === 1) {
    await elementHandle.type(text, { delay: 0 });
    const value = await page.evaluate(el => el.value, elementHandle);
    return value === text;
  }

  // 1) моментально вставляем весь текст, КРОМЕ последнего символа
  const bulk = text.slice(0, -1);
  const last = text.slice(-1);

  await page.evaluate(
    (el, value) => {
      el.value = value;
      // генерируем стандартные события, чтобы фронт-энд «поверил»
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    elementHandle,
    bulk
  );

  // 2) «пишем» последнюю букву обычным способом — это имитирует живой ввод
  await elementHandle.type(last, { delay: 0 });

  // 3) убеждаемся, что получилось именно то, что нужно
  const typedValue = await page.evaluate(el => el.value, elementHandle);
  return typedValue === text;

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
// если внезапно ушли на страницу товара – вернёмся
if (!page.url().startsWith(REVIEWS_URL)) {
  console.log('[reviewManager] -> Обнаружили уход со страницы отзывов, возвращаемся.');
  await page.goto(REVIEWS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await safeWaitForLoad(page, 10000);
}


  



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
      let localRetry = 0;
      
      try {
      console.log(`[reviewManager] -> Обработка карточки N${cardSeq}`);
      // если предыдущий шаг только что решил px-captcha, старые elementHandle
      // уже «оторваны» от нового DOM.  Перечитаем карточки ещё раз.
      if (await isPxCaptchaActive(page) === false && cardSeq > 1) {
        // пересобираем список карточек и актуализируем текущий Card-Handle
        await sleep(200);                                       // даём DOM дорисоваться
        const fresh = await page.$$('.MuiBox-root.css-it1mab');
        if (fresh.length !== cards.length) cards.length = 0;    // заставим while перечитать
      }


      // Прокручиваем карточку в видимую область
      await page.evaluate(el => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, cards[i]);

      await sleep(getRandomInt(SETTINGS.betweenCardsDelay.min, SETTINGS.betweenCardsDelay.max));

      // Кликаем по карточке для её раскрытия
     // сначала пробуем кликнуть именно по первой звезде, чтобы не уйти по ссылке
const starLabel = await cards[i].$('span[id^="rating"] label');
if (starLabel) {
  await starLabel.click({ delay: 50 });
} else {
  await cards[i].click({ delay: 50 }); // fallback – старый способ
}

      await sleep(getRandomInt(SETTINGS.betweenCardsDelay.min, SETTINGS.betweenCardsDelay.max));

// если после клика произошла навигация на товар – вернёмся
if (!page.url().startsWith(REVIEWS_URL)) {
  console.log('[reviewManager] -> Попали на карточку товара. Возвращаемся!');
  await page.goto(REVIEWS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await safeWaitForLoad(page, 10000);
  continue; // берём ту же позицию i ещё раз
}



      // Получаем раскрытую карточку (последний элемент с селектором)
      const expandedCards = await page.$$('.MuiBox-root.css-7b4gkj');
   if (expandedCards.length === 0) {
  console.log(`[reviewManager] -> Не нашли раскрытую карточку после клика (#${i}). Предполагаем, что мешает pop-up.`);
  const closed = await handleGuidelinePopup(page);  // пытаемся закрыть окно
  if (closed) {
    console.log('[reviewManager] -> Pop-up закрыт, повторяем клик по карточке.');
    await cards[i].click();
    await sleep(800);                               // даём раскрыться
    const retryCards = await page.$$('.MuiBox-root.css-7b4gkj');
    if (retryCards.length === 0) {
      console.log('[reviewManager] -> Повтор тоже не дал результат, пропускаем карточку.');
      totalFailed++;
localRetry++;
if (localRetry < 2) { i--; }   // повторно берём ту же карточку не более 2 раз
continue;
    }
    expandedCards.push(...retryCards);              // карточка всё-таки раскрылась
  } else {
    totalFailed++;
    continue;
  }
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
      await handleGuidelinePopup(page);
     
// ждём 1,5 секунды, чтобы pop-up успел появиться
await sleep(1500);

// принимаем окно «Прочитав, я принимаю…», если оно показалось
const popupCheckboxSelector = 'span[data-testid="review-guideline-checkbox"]';
const popupAcceptBtnSelector = 'button[data-testid="review-guideline-agree-btn"]';

const popupCheckbox = await page.$(popupCheckboxSelector);
if (popupCheckbox) {
  // кликаем галочку
  await popupCheckbox.click();

  // ждём, пока кнопка «Я принимаю» станет активной (disabled исчезнет)
  await page.waitForFunction(
    (sel) => {
      const btn = document.querySelector(sel);
      return btn && !btn.disabled;
    },
    {},
    popupAcceptBtnSelector
  );

  // нажимаем «Я принимаю»
  await page.click(popupAcceptBtnSelector);

  // ждём закрытия окна (кнопка исчезнет из DOM)
  await page.waitForSelector(popupAcceptBtnSelector, { hidden: true, timeout: 10000 });
}





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

      // ждём появления И активации кнопки «Отправить» внутри текущей карточки
      await page.waitForFunction(
        card => {
          const btn = card.querySelector('button[data-testid="submit-review"]');
          return btn && !btn.disabled;          // видим кнопку и она не disabled
        },
        { timeout: 5000 },
        currentExpandedCard
      );


      // await sleep(getRandomInt(SETTINGS.betweenCardsDelay.min, SETTINGS.betweenCardsDelay.max));

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

await safeClickWithRetry(page, {
  selector: 'button[data-testid="submit-review"]',
  label: `кнопка "Отправить" (#${i})`,
  maxAttempts: 3
});
await page.waitForSelector('div[role="alert"]', { visible: true, timeout: 7000 })
        .catch(() => {});          // баннер может и не появиться

const okBanner = await page.$('div[role="alert"]');
if (okBanner) {
  console.log('[reviewManager] -> Отзыв подтверждён баннером, всё ок.');
} else {
  console.log('[reviewManager] -> Баннер не появился — проверяем px-captcha.');
  if (await isPxCaptchaActive(page)) {
    await solvePxCaptcha(page, ws);
    i--;                // повторяем эту же карточку
    continue;           // к следующей итерации for
  }
}



      // Ждём успешный API-ответ от отправки отзыва
    

      // Ждём, пока исчезнет спиннер (если он появился)
      try {
        await page.waitForSelector(SPINNER_SELECTOR, { hidden: true, timeout: SETTINGS.spinnerWaitTimeout });
        console.log('[reviewManager] -> Спиннер исчез, отзыв отправлен корректно.');
      }  catch (spinnerError) {
  console.log('[reviewManager] -> Спиннер не исчез в заданное время, проверяем px-captcha.');
  if (await isPxCaptchaActive(page)) {
    await solvePxCaptcha(page, ws);
    i--;          // повторяем карточку
    continue;
  }
  // если это НЕ капча — считаем ошибкой
  totalFailed++;
  continue;
}

      totalProcessed++;
      cardSeq++;

      await sleep(getRandomInt(SETTINGS.afterSendDelay.min, SETTINGS.afterSendDelay.max));

      // Проверяем наличие капчи после отправки
      const captchaElem = await page.$('.captcha-class-selector');
      if (captchaElem) {
        console.log('[reviewManager] -> Обнаружена капча после отправки отзыва, прекращаем обработку.');
        captchaEncountered = true;
        break;
      }
  
} catch (err) {
  console.log(`[reviewManager] -> Ошибка при обработке карточки #${i}:`, err?.message ?? err);

if (err.message === 'PX_CAPTCHA_TRIGGERED') {
  await solvePxCaptcha(page, ws);              // решаем
  i--;                                         // повторяем эту же карточку
  continue;                                   // к следующей итерации for
}



  // Проверяем, не перекрывает ли страницу px-captcha
  const pxCaptcha = await page.$('#catalog-px-captcha-wrapper');
  if (pxCaptcha) {
    console.log('[reviewManager] -> Обнаружена px-captcha, пытаемся решить...');

    try {
      // даём до 60 c, чтобы пользователь или solver решили задачу
      await checkAndSolveCaptchaInPlace(page, ws, 60000);
      console.log('[reviewManager] -> px-captcha решена, повторяем карточку.');
      i--;          // вернёмся к той же карточке
      continue;     // переход к следующей итерации for
    } catch (capErr) {
      console.log('[reviewManager] -> Не удалось решить px-captcha, прекращаем работу.');
      captchaEncountered = true;
      break;
    }
  }

  totalFailed++;    // это не капча — считаем ошибкой и идём дальше
  continue;
  } 
}

    if (captchaEncountered) break;

   // Ищем кнопку «Загрузить ещё»
const loadMoreButton = await page.$('div.MuiBox-root.css-xi606m > div[role="button"]');
if (loadMoreButton) {
  const buttonText = await loadMoreButton.evaluate(el => el.textContent);
  if (buttonText && buttonText.includes('Загрузить еще')) {
    // прокручиваем к кнопке и кликаем
    await page.evaluate(el => el.scrollIntoView({ block: 'center' }), loadMoreButton);
    await loadMoreButton.click({ delay: 80 });
    // если вылезла px-captcha – решаем и сразу возвращаемся к внешнему while
if (await solvePxCaptcha(page, ws)) {
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  continue;        // внешнее while, карточки снова перечитаются
}

    console.log('[reviewManager] -> Нажата кнопка "Загрузить еще", ждём новые карточки.');


    // ждём подтверждение, что сервер отдал новую порцию карточек
await page.waitForResponse(
  r => r.url().includes('/ugc/api/customer/review/history') && r.status() === 200,
  { timeout: 15000 }
);

// поднимаемся в начало, чтобы новые карточки точно попали в область видимости
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await sleep(600);            // короткая пауза – даём DOM дорисоваться


    const loaded = await Promise.race([
      // ждём, что количество карточек увеличится
      page.waitForFunction(
        prev => document.querySelectorAll('.MuiBox-root.css-it1mab').length > prev,
        { timeout: 15000 },
        cards.length
      ).then(() => 'cards').catch(() => null),

      // или ловим навигацию на товар
      page.waitForNavigation({ waitUntil: 'load', timeout: 15000 })
          .then(() => 'nav').catch(() => null)
    ]);

    // если уехали на страницу товара — вернёмся
    if (loaded === 'nav' && !page.url().startsWith(REVIEWS_URL)) {
      console.log('[reviewManager] -> После "Загрузить ещё" ушли на товар. Возвращаемся.');
      await page.goto(REVIEWS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
      await safeWaitForLoad(page, 10000);
      continue;                     // повторяем внешний while
    }

    if (loaded === 'cards') {
      // новые карточки появились — скроллим вверх, чтобы начать с них
      // await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      // await sleep(600);
      continue;                     // повторяем внешний while
    }



    // возможно, всё тормозит из-за px-captcha
if (await solvePxCaptcha(page, ws)) {
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  continue;        // повторяем внешний while без перезагрузки
}

    // не «cards» и не «nav» → тайм-аут
    console.log('[reviewManager] -> Карточки не загрузились, обновляем страницу.');
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));

    await safeWaitForLoad(page, 10000);
    continue;                       // повторяем внешний while
  }
}





      
    

    console.log('[reviewManager] -> Кнопка "Загрузить еще" не найдена или карточки закончились.');
    // проверяем, остались ли товары без отзывов
const leftText = await page.$eval('[data-testid="my-reviews-tab-2"]', el => el.textContent)
  .catch(() => '');
const match = leftText.match(/\((\d+)\)/);
if (match && Number(match[1]) > 0) {
  console.log(`[reviewManager] -> Осталось товаров без отзывов: ${match[1]}. Обновляем страницу и продолжаем.`);
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));

  await safeWaitForLoad(page, 10000);
  continue; // повторяем внешний while
}

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
