/* captcha.js – всё, что связано с px-captcha и pop-up’ом правил */

const { sleep } = require('./helpers');
const { checkAndSolveCaptchaInPlace } = require('../../../captcha');  // путь от подпапки к solver’у

async function isPxCaptchaActive(page) {
  return page.evaluate(() => {
    const w = document.querySelector('#catalog-px-captcha-wrapper');
    if (!w) return false;
    const css  = getComputedStyle(w);
    const vis  = css.display !== 'none' && css.visibility !== 'hidden';
    const rect = w.getBoundingClientRect();
    return vis && rect.width && rect.height && w.querySelector('iframe');
  });
}

async function solvePxCaptcha(page, ws, limit = 120_000) {
  const wrap = await page.$('#catalog-px-captcha-wrapper');
  if (!wrap) return false;

  console.log('[reviewManager] -> px-captcha detected');
  const old = page.getDefaultNavigationTimeout();
  page.setDefaultNavigationTimeout(limit);

  try {
    await checkAndSolveCaptchaInPlace(page, ws, limit);
    console.log('[reviewManager] -> px-captcha solved');
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await sleep(300);
    return true;
  } finally {
    page.setDefaultNavigationTimeout(old);
  }
}

/* pop-up «Прочитав, я принимаю…» */
async function handleGuidelinePopup(page) {
  const cbSel  = 'span[data-testid="review-guideline-checkbox"]';
  const btnSel = 'button[data-testid="review-guideline-agree-btn"]';

  const cb = await page.$(cbSel).catch(() => null);
  if (!cb) return false;

  await cb.click();
  await page.waitForFunction(sel => {
    const b = document.querySelector(sel);
    return b && !b.disabled;
  }, {}, btnSel);

  await page.click(btnSel);
  await page.waitForSelector(btnSel, { hidden: true, timeout: 10_000 });
  return true;
}

module.exports = { isPxCaptchaActive, solvePxCaptcha, handleGuidelinePopup };
