/* reviewManager.js  ─ главный управляющий файл */

const { safeWaitForLoad }      = require('./pageLoadHelper');
const { sleep, readArrayFromJson }          = require('./reviewManager/helpers');
const { solvePxCaptcha, isPxCaptchaActive } = require('./reviewManager/captcha');
const { processCard, tryLoadMore }          = require('./reviewManager/processor');

const REVIEWS_URL = 'https://kz.iherb.com/ugc/myaccount/review?filter=2';


// Ждём, пока на странице появится хотя бы одна карточка отзыва
async function waitForFirstCards(page) {
  for (let i = 0; i < 20; i++) {             // максимум ~10 сек (20 × 500 мс)
    const cardsCnt = await page.$$eval(
      '.MuiBox-root.css-it1mab',
      els => els.length
    ).catch(() => 0);

    if (cardsCnt > 0) return true;           // карточки появились

    await sleep(500);                        // короткая пауза и пробуем снова
  }
  return false;                              // ничего не появилось
}


async function reviewManager(page, ws) {
  console.log('[reviewManager] -> start');

  // Загружаем готовые тексты
  const titles  = readArrayFromJson('titles.json');
  const reviews = readArrayFromJson('reviews.json');

  // Переходим на страницу отзывов
  await page.goto(REVIEWS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await safeWaitForLoad(page, 10_000);

  // дожидаемся первой порции карточек (XHR подгружает их не сразу)
  const firstCardsOk = await waitForFirstCards(page);
  if (!firstCardsOk) {
    console.log('[reviewManager] -> Карточек нет даже через 10 сек, выходим.');
    return;
  }



  let ok = 0;
  let fail = 0;

  while (true) {

    // Если всплыла px-captcha — решаем и продолжаем
    if (await isPxCaptchaActive(page)) {
      await solvePxCaptcha(page, ws);
      await sleep(400);
      continue;
    }

    // Берём первую «неотработанную» карточку
    const card = await page.$('.MuiBox-root.css-it1mab');

    if (card) {
      (await processCard(page, ws, card, titles, reviews)) ? ok++ : fail++;
      await sleep(150);
      continue;
    }

    // Карточек нет → пробуем «Загрузить ещё»
    if (await tryLoadMore(page)) {
      await sleep(600);
      continue;
    }

    break;                               // всё сделано
  }

  console.log(`[reviewManager] -> done. success ${ok}, failed ${fail}`);
}

module.exports = { reviewManager };
