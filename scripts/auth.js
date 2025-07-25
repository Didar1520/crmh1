/**
 * auth.js
 * ----------------------------------------------------------------------------
 * - Авторизация на iHerb
 * - Настройки (timeouts и т.д.) берём из browserConfig.js
 */

const selectors = require('./selectors');
const {
  humanMouseMovements,
  clickWhenVisible,
  waitForStateChange,
  logActions,
  sleep
} = require('./utils');
const { getAccData, saveAccData } = require('./dataManager');
const { solvePressAndHoldCaptcha } = require('./captcha');
const browserConf = require('./browserConfig');

const AUTH_URL = 'https://kz.iherb.com';
const SPINNER_SELECTOR = '.ConnectedLoading__SpinnerWrapper-sc-1bx9vi1-0';

/* ---------- helpers ---------- */

/** Безопасное ожидание спиннера: не кидает исключение */
async function waitForGlobalSpinnerToDisappear(page) {
  try {
    await page.waitForSelector(SPINNER_SELECTOR, { visible: true, timeout: 1000 });
    console.log('[auth.js] -> Спиннер появился, ждём исчезновения…');
    await page.waitForSelector(SPINNER_SELECTOR, { hidden: true, timeout: 10000 });
    console.log('[auth.js] -> Спиннер исчез.');
  } catch {
    console.log('[auth.js] -> Спиннер не появился или не пропал, продолжаем…');
  }
}

/** Возвращает пароль для логина из accData.json либо '' */
async function getStoredPassword(login) {
  const accData = await getAccData();
  if (!accData?.accounts?.length) return '';
  const found = accData.accounts.find(
    a => a.email.toLowerCase() === login.toLowerCase() && a.pass?.trim()
  );
  return found ? found.pass.trim() : '';
}

/** Безопасное объявление функции через page.exposeFunction (может быть объявлена ранее) */
async function safeExpose(page, name, fn) {
  try {
    await page.exposeFunction(name, fn);
  } catch (err) {
    if (!/already exists/.test(String(err))) throw err;
  }
}

/* ---------- main ---------- */

async function authorize(page, params, ws) {
  console.log('[auth.js] -> Начало authorize()');
  await logActions('Начинаем процесс авторизации…', ws, 'in-progress');

  const userLogin = (params.login || '').trim();
  let userPassword = (params.password || '').trim();

  console.log(`[auth.js] -> userLogin="${userLogin}", пароль ${userPassword ? 'указан' : 'нет'}`);

  if (!userPassword) {
    userPassword = await getStoredPassword(userLogin);
    if (userPassword) {
      console.log(`[auth.js] -> Пароль для ${userLogin} взят из accData.json`);
    }
  }
  const waitingManualPassword = !userPassword;

  /* ---------- ловим /catalog/currentUser ---------- */

  const onResponse = async (response) => {
    try {
      if (!response.ok()) return;
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('application/json')) return;
      if (!url.includes('catalog.app.iherb.com/catalog/currentUser')) return;

      const body = await response.text();
      if (!body) return;

      try {
        const json = JSON.parse(body);
        if (json?.email) {
          console.log(`[auth.js] -> currentUserData.email = ${json.email}`);
        }
      } catch (errParse) {
        console.log('[auth.js] -> Ошибка при парсинге currentUser:', errParse);
      }
    } catch (errResp) {
      console.log('[auth.js] -> Ошибка в page.on(response):', errResp);
    }
  };

  page.on('response', onResponse);

  /* ---------- таймауты ---------- */

  const {
    pageWaitTime = 60000,
    cookieWaitTime = 3000,
    captchaWaitTime = 10000,
    defaultWaitTime = 60000
  } = browserConf.browserConfig?.timeouts || {};

  page.setDefaultNavigationTimeout(pageWaitTime);

  /* ---------- заходим на iHerb ---------- */

  try {
    console.log('[DEBUG] page.goto(iHerb)…');
    const start = Date.now();
await page.goto(AUTH_URL, {
      referer: 'https://google.com',
      // networkidle2 ждёт пока затихнет весь трафик, а на iHerb работают «долгоиграющие» пиксели.
      // domcontentloaded даёт страницу готовой, но не зависает.
      waitUntil: 'domcontentloaded',
      timeout: pageWaitTime
    });

    console.log(`[DEBUG] page.goto(...) за ${Date.now() - start} мс`);
    await waitForGlobalSpinnerToDisappear(page);
    await sleep(1000);
  } catch (errGoto) {
    console.log('[auth.js] -> Ошибка при переходе:', errGoto);
    await logActions('Ошибка при загрузке iHerb', ws, 'error');
    return false;
  }

  /* ---------- cookie‑баннер ---------- */

  try {
    await page.waitForSelector('#truste-consent-button', { visible: true, timeout: cookieWaitTime });
    await page.click('#truste-consent-button');
    await sleep(1000);
    console.log('[auth.js] -> Клик по cookie‑баннеру');
  } catch {
    console.log('[auth.js] -> Куки‑баннер не найден, пропускаем');
  }

  /* ---------- мелкий «прогрев» страницы ---------- */

  await humanMouseMovements(page, 1500);
  await page.evaluate(() => window.scrollBy(0, 200));
  await sleep(1000);

  /* ---------- кнопка “Войти” ---------- */

  try {
    await page.waitForSelector(selectors.buttonGotoLogin, { visible: true, timeout: defaultWaitTime });
    await humanMouseMovements(page, 1500);
    await page.click(selectors.buttonGotoLogin);
    await logActions('Клик по кнопке “Войти” выполнен', ws, 'in-progress');
    await waitForGlobalSpinnerToDisappear(page);
    await sleep(2000);
  } catch (errLoginBtn) {
    await logActions('Не нашли кнопку “Войти”. Возможно, сайт не загрузился.', ws, 'error');
    return false;
  }

  /* ---------- Press‑and‑Hold CAPTCHA ---------- */

  let captchaState = 'none';
  try {
    captchaState = await Promise.race([
      page.waitForSelector('#px-captcha', { timeout: captchaWaitTime }).then(() => 'found'),
      page
        .waitForResponse(
          (r) => r.url().includes('/px.gif') && r.ok(),
          { timeout: captchaWaitTime }
        )
        .then(() => 'bypassed')
    ]);
  } catch {
    /* игнор */
  }

  if (captchaState === 'found') {
    console.log('[auth.js] -> Обнаружена капча Press & Hold');
    await logActions('Капча “Press & Hold” найдена, решаем…', ws, 'in-progress');
    await solvePressAndHoldCaptcha(page);
    await waitForGlobalSpinnerToDisappear(page);
  } else {
    console.log(`[auth.js] -> Капча не обнаружена (${captchaState})`);
  }

  /* ---------- ввод логина ---------- */

  try {
    await page.waitForSelector(selectors.loginInputSelector, { visible: true, timeout: defaultWaitTime });
    await waitForGlobalSpinnerToDisappear(page);
    await logActions('Вводим логин…', ws, 'in-progress');
  } catch {
    await logActions('Не удалось дождаться поля логина', ws, 'error');
    return false;
  }

  await page.type(selectors.loginInputSelector, userLogin, { delay: 100 });
  await sleep(1000);

  /* ---------- далее → пароль ---------- */

  await clickWhenVisible(page, selectors.loginButton);
  console.log('[auth.js] -> Клик “Далее” (логин) выполнен.');
  await waitForGlobalSpinnerToDisappear(page);
  await sleep(2000);

  try {
    await page.waitForSelector(selectors.passwordInput, { visible: true, timeout: defaultWaitTime });
    console.log('[auth.js] -> Поле пароля найдено');
  } catch {
    await logActions('Не удалось дождаться поля пароля', ws, 'error');
    return false;
  }

  if (!waitingManualPassword) {
    await page.type(selectors.passwordInput, userPassword, { delay: 100 });
    await humanMouseMovements(page, 1500);
    await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(
    b => b.innerText.trim() === 'Войти'
  );
  if (btn) btn.click();
});

    await logActions('Пароль введён и отправлен', ws, 'in-progress');
  } else {
    console.log('[auth.js] -> Пароль не найден, ждём ручной ввод.');

    await safeExpose(page, 'onSubmitPassword', async () => {
      const typedPassword = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.value.trim() : '';
      }, selectors.passwordInput);

      if (!typedPassword) return;

      console.log('[auth.js] -> Пользователь ввёл пароль, сохраняем…');
      const accData = await getAccData();
      const list = accData?.accounts || [];
      const found = list.find(a => a.email.toLowerCase() === userLogin.toLowerCase());

      if (found) {
        found.pass = typedPassword;
      } else {
        list.push({
          email: userLogin,
          pass: typedPassword,
          refCode: '',
          typeOfMail: '',
          typeOfAcc: 'autoCreated',
          allow: true,
          cards: { creditCards: [] },
          reviews: {},
          rewards: {}
        });
      }
      await saveAccData({ accounts: list });
    });

    await page.evaluate((btnSel) => {
      const btn = document.querySelector(btnSel);
      if (btn && !btn.dataset._listenerAttached) {
        btn.addEventListener('click', () => window.onSubmitPassword());
        btn.dataset._listenerAttached = 'true';
      }
    }, selectors.authButton);

    console.log('[auth.js] -> Ожидание ручного пароля и клика “Войти”…');
  }

  /* ---------- проверяем успешную авторизацию ---------- */

  try {
    await page.waitForSelector(selectors.gotoOrderCheckout, { visible: true, timeout: defaultWaitTime });
    await logActions('Авторизация прошла успешно', ws, 'success');
    console.log('[auth.js] -> Авторизация прошла успешно');
    return true;
  } catch (errWaitFinal) {
    console.log('[auth.js] -> Не удалось подтвердить авторизацию:', errWaitFinal);
    await logActions('Не удалось подтвердить авторизацию', ws, 'error');
    return false;
  } finally {
    page.off('response', onResponse); // снимаем обработчик, чтобы не копить
  }
}

module.exports = { authorize };
