// scripts/auth.js
/**
 * auth.js
 * ----------------------------------------------------------------------------
 * - Авторизация на iherb
 * - Не использует старый config.js, а только browserConfig.js (для таймаутов).
 * - Остальные логи, селекторы, captcha — остаются как были.
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

/**
 * ВАЖНО: Раньше мы делали `const config = require('../config')`.
 * Теперь таймауты и прочее берём из browserConfig.js.
 */
const browserConf = require('./browserConfig'); // или '../browserConfig' если нужно
// В browserConf.browserConfig хранятся настройки, включая timeouts.

async function authorize(page, params, ws) {
  console.log('[auth.js] -> Начало authorize()');
  await logActions('Начинаем процесс авторизации...', ws, 'in-progress');

  let currentUserData = null;
  const userLogin = (params.login || '').trim();
  let userPassword = (params.password || '').trim();
  console.log(`[auth.js] -> userLogin="${userLogin}", пароль ${userPassword ? 'указан' : 'нет'}`);

  // Если нет пароля — ищем в accData.json
  if (!userPassword) {
    const accData = await getAccData();
    if (accData && accData.accounts) {
      const foundUser = accData.accounts.find(
        (a) => a.email.toLowerCase() === userLogin.toLowerCase()
      );
      if (foundUser && foundUser.pass && foundUser.pass.trim() !== '') {
        userPassword = foundUser.pass.trim();
        console.log(`[auth.js] -> Пароль для ${userLogin} взят из accData.json`);
      }
    }
  }
  const waitingManualPassword = !userPassword;

  // Ловим currentUser
  page.on('response', async (response) => {
    try {
      if (!response.ok()) return;
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      // Пропускаем, если не JSON
      if (!contentType.includes('application/json')) return;

      if (url.includes('catalog.app.iherb.com/catalog/currentUser')) {
        let textBody = '';
        try {
          textBody = await response.text();
        } catch (errRead) {
          console.log('[auth.js] -> Ошибка при чтении currentUser:', errRead);
          return;
        }
        if (!textBody) {
          console.log('[auth.js] -> Пустой body для currentUser');
          return;
        }
        try {
          const json = JSON.parse(textBody);
          if (json && json.email) {
            currentUserData = json;
            console.log(`[auth.js] -> currentUserData.email = ${json.email}`);
          }
        } catch (errParse) {
          console.log('[auth.js] -> Ошибка при парсинге currentUser:', errParse);
        }
      }
    } catch (errResp) {
      console.log('[auth.js] -> Общая ошибка в page.on(response):', errResp);
    }
  });

  // Достаём таймауты из browserConf.browserConfig.timeouts
  const timeouts = browserConf.browserConfig?.timeouts || {};
  const pageWaitTime = timeouts.pageWaitTime || 60000;
  const cookieWaitTime = timeouts.cookieWaitTime || 3000;
  const captchaWaitTime = timeouts.captchaWaitTime || 10000;
  const defaultWaitTime = timeouts.defaultWaitTime || 60000;

  // DEBUG-переменная для замера времени
  const gotoStart = Date.now();
  console.log('[DEBUG] Начинаем page.goto("https://kz.iherb.com")...');

  // Заходим на iherb
  try {
    await page.goto('https://kz.iherb.com', {
      referer: 'https://google.com',
      waitUntil: 'networkidle2',
      timeout: pageWaitTime
    });
    console.log('[auth.js] -> Перешли на iherb');
    console.log(`[DEBUG] page.goto("https://kz.iherb.com") успешно завершилось. Время: ${Date.now() - gotoStart} мс`);
    await sleep(2000);
  } catch (errGoto) {
    console.log('[auth.js] -> Ошибка при переходе:', errGoto);
    console.log(`[DEBUG] Ошибка page.goto("https://kz.iherb.com"): ${errGoto}`);
    console.log(`[DEBUG] Время: ${Date.now() - gotoStart} мс`);
    await logActions('Ошибка при загрузке iherb', ws, 'error');
    return false;
  }

  // Кука-баннер
  try {
    await page.waitForSelector('#truste-consent-button', {
      visible: true,
      timeout: cookieWaitTime
    });
    await page.click('#truste-consent-button');
    await sleep(1000);
    console.log('[auth.js] -> Клик по cookie-баннеру');
  } catch (errCookie) {
    console.log('[auth.js] -> Куки-баннер не найден, пропускаем');
  }

  // Прогрев (мышь + скролл)
  await humanMouseMovements(page, 1500);
  await page.evaluate(() => window.scrollBy(0, 200));
  await sleep(1000);

  // Проверяем, может уже залогинен
  if (currentUserData && currentUserData.email) {
    const currEmail = currentUserData.email.toLowerCase();
    if (currEmail === userLogin.toLowerCase()) {
      await logActions(`Уже авторизован: ${currEmail}`, ws, 'success');
      return true;
    } else {
      console.log(`[auth.js] -> Авторизован другой: ${currEmail}, выходим...`);
      await page.goto('https://checkout12.iherb.com/account/logoff', { waitUntil: 'networkidle2' });
      await sleep(2000);
      currentUserData = null;
      await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2' });
      await sleep(2000);
    }
  } else {
    // Если currentUserData нет, проверим DOM
    const helloUser = await page.evaluate(() => {
      const el = document.querySelector('.username-my-account-container .welcome-name');
      return el ? el.textContent.trim().toLowerCase() : null;
    });
    if (helloUser && helloUser === userLogin.toLowerCase()) {
      await logActions(`Уже авторизован нужный пользователь: ${helloUser}`, ws, 'success');
      return true;
    } else if (helloUser && helloUser !== userLogin.toLowerCase()) {
      console.log(`[auth.js] -> Авторизован другой: ${helloUser}, выходим...`);
      await page.goto('https://checkout12.iherb.com/account/logoff', { waitUntil: 'networkidle2' });
      await sleep(2000);
      await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2' });
      await sleep(2000);
    }
  }

  // Нажимаем "Войти"
  try {
    await page.waitForSelector(selectors.buttonGotoLogin, {
      visible: true,
      timeout: defaultWaitTime
    });
    await humanMouseMovements(page, 1500);
    await page.click(selectors.buttonGotoLogin);
    await logActions('Клик по кнопке "Войти" выполнен', ws, 'in-progress');
  } catch (errLoginBtn) {
    await logActions('Не нашли кнопку "Войти". Возможно, сайт не загрузился.', ws, 'error');
    return false;
  }

  // Ждём капчу Press & Hold (возможно)
  try {
    await page.waitForSelector('#px-captcha', {
      timeout: captchaWaitTime
    });
    console.log('[auth.js] -> Обнаружена капча, решаем...');
    await logActions('Капча "Press & Hold" найдена, решаем...', ws, 'in-progress');

    await humanMouseMovements(page, 2000);
    await humanMouseMovements(page, 1500);
    await solvePressAndHoldCaptcha(page);
  } catch (errCaptcha) {
    console.log('[auth.js] -> Капча не обнаружена (или не успела появиться)', errCaptcha);
  }

  // Поле логина
  try {
    await page.waitForSelector(selectors.loginInputSelector, {
      visible: true,
      timeout: defaultWaitTime
    });
    await logActions('Вводим логин...', ws, 'in-progress');
  } catch (errWaitLogin) {
    await logActions('Не удалось дождаться поля логина', ws, 'error');
    return false;
  }
  await page.type(selectors.loginInputSelector, userLogin, { delay: 100 });
  await clickWhenVisible(page, selectors.loginButton);

  // Поле пароля
  try {
    await page.waitForSelector(selectors.passwordInput, {
      visible: true,
      timeout: defaultWaitTime
    });
    console.log('[auth.js] -> Поле пароля найдено, вводим пароль (или ждём ручной)');
  } catch (errWaitPass) {
    await logActions('Не удалось дождаться поля пароля', ws, 'error');
    return false;
  }

  if (!waitingManualPassword) {
    // Есть пароль
    await page.type(selectors.passwordInput, userPassword, { delay: 100 });
    await humanMouseMovements(page, 1500);
    await page.click(selectors.authButton);
    await logActions('Пароль введен и отправлен', ws, 'in-progress');
  } else {
    // Нет пароля => ждём ручного ввода
    console.log('[auth.js] -> Пароль не найден в JSON, ждём ввод вручную.');
    await page.exposeFunction('onSubmitPassword', async () => {
      const typedPassword = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.value.trim() : '';
      }, selectors.passwordInput);

      if (typedPassword) {
        console.log(`[auth.js] -> Пользователь ввёл пароль (скрыт), сохраняем в accData.json...`);
        const accData = await getAccData();
        if (accData && accData.accounts) {
          let found = accData.accounts.find(a => a.email.toLowerCase() === userLogin.toLowerCase());
          if (found) {
            found.pass = typedPassword;
          } else {
            accData.accounts.push({
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
          await saveAccData(accData);
        }
      }
    });

    // Перехватываем клик
    await page.evaluate((btnSel) => {
      const btn = document.querySelector(btnSel);
      if (!btn) return;
      btn.addEventListener('click', () => {
        window.onSubmitPassword();
      });
    }, selectors.authButton);

    console.log('[auth.js] -> Ожидание ручного ввода пароля и клика "Войти"');
  }

  // Ждём селектор успешной авторизации
  try {
    await page.waitForSelector(selectors.gotoOrderCheckout, {
      visible: true,
      timeout: defaultWaitTime
    });
    await logActions('Авторизация прошла успешно', ws, 'success');
    console.log('[auth.js] -> Авторизация прошла успешно');
    return true;
  } catch (errWaitFinal) {
    console.log('[auth.js] -> Не удалось подтвердить авторизацию:', errWaitFinal);
    await logActions('Не удалось подтвердить авторизацию', ws, 'error');
    return false;
  }
}

module.exports = { authorize };
