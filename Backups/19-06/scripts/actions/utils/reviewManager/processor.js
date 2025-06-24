/* processor.js – работа с одной карточкой + «Загрузить ещё» */

const { sleep, getRandomInt, getRandomElement, clearAndType } = require('./helpers');
const { isPxCaptchaActive, solvePxCaptcha, handleGuidelinePopup } = require('./captcha');
const { safeClickWithRetry } = require('../safeClick');               // ../../utils/safeClick.js → ../safeClick

const SETTINGS = {
  betweenCardsDelay : { min: 100, max: 200 },
  afterSendDelay    : { min: 100, max: 250 },
  spinnerTimeout    : 15_000
};

const SPINNER = 'div.MuiBox-root.css-vpm3mf svg.css-hqngwm';

/* Полная обработка одной карточки */
async function processCard(page, ws, card, titles, reviews) {
  try {
    await page.evaluate(el => el.scrollIntoView({ block: 'center' }), card);
    await sleep(getRandomInt(SETTINGS.betweenCardsDelay.min, SETTINGS.betweenCardsDelay.max));

    // Открываем карточку кликом по звёздочке
    const star = await card.$('span[id^="rating"] label');
    star ? await star.click({ delay: 50 }) : await card.click({ delay: 50 });

    // Если улетели на страницу товара – назад
    if (!page.url().includes('/ugc/myaccount/review')) {
      await page.goBack({ waitUntil: 'networkidle2' });
      return false;
    }

    await sleep(300);
    const exp = await page.$('.MuiBox-root.css-7b4gkj');
    if (!exp) { await handleGuidelinePopup(page); return false; }

    // Рейтинг 4-5
    const rate = getRandomInt(4, 5);
    const labels = await exp.$$('#ratingValue label');
    if (labels[rate - 1]) await labels[rate - 1].click();

    await handleGuidelinePopup(page);

    // Чекбоксы правил
    for (const id of ['write-review-agree-guideline1', 'write-review-agree-guideline2']) {
      const cb = await exp.$(`[data-testid="${id}"] > .PrivateSwitchBase-input`);
      if (cb && !(await page.evaluate(e => e.checked, cb))) await cb.click();
    }

    // Заголовок
    const titleEl = await exp.$('input#reviewTitle, input[data-testid="write-review-title"]');
    if (!titleEl) return false;
    if (!await clearAndType(page, titleEl, getRandomElement(titles) || 'Отличный продукт')) return false;

    // Текст
    const textEl = await exp.$('textarea#reviewText, textarea[data-testid="write-review-text"]');
    if (!textEl) return false;
    if (!await clearAndType(page, textEl, getRandomElement(reviews) || 'Продукт понравился.')) return false;

    // Отправляем
    await safeClickWithRetry(page, {
      selector: 'button[data-testid="submit-review"]',
      label   : 'submit-review',
      maxAttempts: 3
    });

    // Ждём спиннер
    await page.waitForSelector(SPINNER, { hidden: true, timeout: SETTINGS.spinnerTimeout })
              .catch(async () => { if (await isPxCaptchaActive(page)) await solvePxCaptcha(page, ws); });

    await sleep(getRandomInt(SETTINGS.afterSendDelay.min, SETTINGS.afterSendDelay.max));
    return true;

  } catch (e) {
    console.log('[processor] error:', e.message);
    if (await isPxCaptchaActive(page)) await solvePxCaptcha(page, ws);
    return false;
  }
}

/* Дозагрузка карточек */
async function tryLoadMore(page) {
  const btn = await page.$('div.MuiBox-root.css-xi606m > div[role="button"]');
  if (!btn) return false;

  await page.evaluate(el => el.scrollIntoView({ block: 'center' }), btn);
  await btn.click({ delay: 80 });

  return page.waitForFunction(
    () => document.querySelectorAll('.MuiBox-root.css-it1mab').length,
    { timeout: 15_000 }
  ).then(n => !!n).catch(() => false);
}

module.exports = { processCard, tryLoadMore };
