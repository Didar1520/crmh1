/**
 * setAdressPage.js
 * ------------------------------------------------------------------
 *  - Ищет адрес по имени и ставит его «по умолчанию».
 *  - Если не найдено — вызывает addNewAddress().
 *  - Пагинация iHerb подгружает адреса через XHR, поэтому waitForNavigation не нужен.
 */

const addNewAddress = require('./addNewAdress.js');
const { checkAndSolveCaptchaInPlace } = require('../../captcha.js');
const { safeWaitForLoad } = require('../utils/pageLoadHelper.js');

/* ------------------------------------------------ helpers ---------- */

function processName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).join(' ').toLowerCase();
}

async function waitForSpinner(page, max = 5000) {
  const sel = 'svg[data-qa-element="loading-spinner"]';
  const start = Date.now();
  let shown = false;

  try { await page.waitForSelector(sel, { timeout: 1000 }); shown = true; } catch {}

  if (shown) {
    try {
      await page.waitForSelector(sel, { hidden: true, timeout: max - (Date.now() - start) });
    } catch { return false; }
  }
  return true;
}

/**
 * navigateWithCaptcha(page, expectedUrlSubstring)
 * ------------------------------------------------------------------
 *  1) Быстро проверяем: существует ли элемент #px-captcha.  
 *     – Нет → выходим мгновенно.  
 *     – Есть → вызываем checkAndSolveCaptchaInPlace(page) и ждём
 *       решения столько, сколько потребуется.
 *  2) Дополнительно убеждаемся, что в URL есть ожидаемая подстрока.
 */
async function navigateWithCaptcha(page, expectedUrlSubstring) {
  /* Быстрая проверка наличия капчи (используем ровно тот же селектор,
     что уже применяется в captcha.js) */
  const hasCaptcha = await page.$('#px-captcha');
  if (hasCaptcha) {
    await checkAndSolveCaptchaInPlace(page);           // ждём полное решение
  }

  if (
    expectedUrlSubstring &&
    !page.url().includes(expectedUrlSubstring)
  ) {
    throw new Error(
      `[setAdressPage] -> Не удалось перейти на страницу, ` +
      `ожидалось "${expectedUrlSubstring}" в URL. Текущий URL: ${page.url()}`
    );
  }
}

/**
 * Переходит по всем страницам, кликая кнопки пагинации (XHR-подгрузка, без навигации).
 * Ставит адрес «по умолчанию», если нашёл совпадающее имя.
 */
async function searchAcrossPages(page, desiredName) {
  await waitForSpinner(page, 5000);                      // ждём исчезновения спиннера

  while (true) {
    const action = await page.evaluate((nm) => {
      const items = [...document.querySelectorAll('.address_item')];
      for (const it of items) {
        const nameEl = it.querySelector('.address_no');
        if (!nameEl) continue;
        if (nameEl.textContent.trim().toLowerCase() === nm) {
          if (it.querySelector('.address_item_status.default')) return 'done';
          const btn = it.querySelector('.set_default_btn[data-name="SetAsDefault"]');
          if (btn) { btn.click(); return 'clicked'; }
          return 'done';
        }
      }

      /* пагинация */
      const nav = document.querySelector('.pagination-container');
      if (!nav) return 'not-found';
      const cur = nav.querySelector('button[aria-current="true"]');
      if (!cur) return 'not-found';

      const next = nav.querySelector(
        `button[aria-label="Go to page ${Number(cur.textContent) + 1}"]`
      );
      if (next && !next.disabled) { next.click(); return 'next'; }
      return 'not-found';
    }, desiredName);

    if (action === 'done') return true;

    if (action === 'clicked') {
      try {
        await page.waitForFunction(
          (nm) =>
            [...document.querySelectorAll('.address_item')].some(
              (it) =>
                it.querySelector('.address_item_status.default') &&
                it.querySelector('.address_no').textContent.trim().toLowerCase() === nm
            ),
          { timeout: 5000 },
          desiredName
        );
      } catch {/* если не дождались — всё равно продолжаем */ }
      return true;
    }

    if (action === 'next') {
      await waitForSpinner(page, 7000);                  // ждём подгрузку новой страницы
      continue;
    }

    if (action === 'not-found') return false;
  }
}

/* ------------------------------------------------ main ------------- */

async function setDefaultAddress(page, addressData) {
  if (!addressData?.FullName) throw new Error('[setAdressPage] -> FullName отсутствует.');
  const desiredName = processName(addressData.FullName);
  console.log(`[setAdressPage] -> Искомое имя: "${desiredName}"`);

  await page.evaluateOnNewDocument(() =>
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  );

  await page.goto('https://checkout12.iherb.com/users/address-book', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
    referer: 'https://checkout12.iherb.com/users/dashboard',
  });

  console.log('[setAdressPage] -> Перешли на нужную страницу');
  await safeWaitForLoad(page);
  console.log('[setAdressPage] -> Готовы начинать');

  await navigateWithCaptcha(page, '/users/address-book');
  await page.waitForSelector('.address_item, .empty-address-book', { timeout: 20000 });

  const found = await searchAcrossPages(page, desiredName);
  if (!found) console.log(`[setAdressPage] -> Адрес "${desiredName}" не найден.`);
  return found;
}

async function handleAddressSetPage(page, addressData) {
  const ok = await setDefaultAddress(page, addressData);
  if (!ok) {
    console.log('[setAdressPage] -> Добавляем новый адрес…');
    await addNewAddress(page, addressData);
  }
}

module.exports = handleAddressSetPage;
