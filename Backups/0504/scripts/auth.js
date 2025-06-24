// scripts/auth.js
/**
 * auth.js
 * ----------------------------------------------------------------------------
 * - Авторизация на iherb
 * - Настройки (timeouts и т.д.) берем из browserConfig.js
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
const browserConf = require('./browserConfig'); // содержит browserConfig.browserConfig.timeouts...

/**
 * Вспомогательная функция: ждём, пока исчезнет «спиннер» (закрывающий весь экран).
 * Селектор: .ConnectedLoading__SpinnerWrapper-sc-1bx9vi1-0
 * - Сначала пробуем дождаться появления (до 1 сек) – если не появился, значит ок.
 * - Если появился, ждём исчезновения (до 10 сек).
 * - Если не исчез – просто логируем и идём дальше (не падаем в ошибку).
 */
async function waitForGlobalSpinnerToDisappear(page) {
  const spinnerSelector = '.ConnectedLoading__SpinnerWrapper-sc-1bx9vi1-0';
  try {
    // Ждём появления до 1 сек
    await page.waitForSelector(spinnerSelector, { visible: true, timeout: 1000 });
    console.log('[auth.js] -> Спиннер появился, ждём исчезновения...');
    // ждем, пока он станет hidden или пропадёт из DOM
    await page.waitForSelector(spinnerSelector, { hidden: true, timeout: 10000 });
    console.log('[auth.js] -> Спиннер исчез.');
  } catch {
    // либо не появился, либо не исчез вовремя
    console.log('[auth.js] -> Спиннер не появился или не пропал, продолжаем...');
  }
}

async function authorize(page, params, ws) {
  console.log('[auth.js] -> Начало authorize()');
  await logActions('Начинаем процесс авторизации...', ws, 'in-progress');

  let currentUserData = null;
  const userLogin = (params.login || '').trim();
  let userPassword = (params.password || '').trim();
  console.log(`[auth.js] -> userLogin="${userLogin}", пароль ${userPassword ? 'указан' : 'нет'}`);

  // Если нет пароля – ищем в accData.json
  if (!userPassword) {
    const accData = await getAccData();
    if (accData && accData.accounts) {
      const foundUser = accData.accounts.find(a => a.email.toLowerCase() === userLogin.toLowerCase());
      if (foundUser && foundUser.pass && foundUser.pass.trim() !== '') {
        userPassword = foundUser.pass.trim();
        console.log(`[auth.js] -> Пароль для ${userLogin} взят из accData.json`);
      }
    }
  }
  const waitingManualPassword = !userPassword;

  // Ловим currentUser (через /catalog/currentUser)
  page.on('response', async (response) => {
    try {
      if (!response.ok()) return;
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
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

  // Берём таймауты из browserConfig
  const timeouts = browserConf.browserConfig?.timeouts || {};
  const pageWaitTime = timeouts.pageWaitTime || 60000;
  const cookieWaitTime = timeouts.cookieWaitTime || 3000;
  const captchaWaitTime = timeouts.captchaWaitTime || 10000;
  const defaultWaitTime = timeouts.defaultWaitTime || 60000;

  // Заходим на iherb
  const gotoStart = Date.now();
  console.log('[DEBUG] Начинаем page.goto("https://kz.iherb.com")...');
  try {
    await page.goto('https://kz.iherb.com', {
      referer: 'https://google.com',
      waitUntil: 'networkidle2',
      timeout: pageWaitTime
    });
    console.log('[auth.js] -> Перешли на iherb');
    console.log(`[DEBUG] page.goto(...) за ${Date.now() - gotoStart} мс`);
    // Ждём, пока глобальный спиннер (если есть) исчезнет
    await waitForGlobalSpinnerToDisappear(page);
    await sleep(1000);
  } catch (errGoto) {
    console.log('[auth.js] -> Ошибка при переходе:', errGoto);
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
  } catch {
    console.log('[auth.js] -> Куки-баннер не найден, пропускаем');
  }

  // Прогрев (мышь + скролл)
  await humanMouseMovements(page, 1500);
  await page.evaluate(() => window.scrollBy(0, 200));
  await sleep(1000);

  // Может, уже залогинен?
  if (currentUserData && currentUserData.email) {
    const currEmail = currentUserData.email.toLowerCase();
    if (currEmail === userLogin.toLowerCase()) {
      await logActions(`Уже авторизован: ${currEmail}`, ws, 'success');
      return true;
    } else {
      // Другой пользователь => разлогин
      console.log(`[auth.js] -> Авторизован другой: ${currEmail}, выходим...`);
      await page.goto('https://checkout12.iherb.com/account/logoff', { waitUntil: 'networkidle2' });
      await sleep(2000);
      currentUserData = null;
      await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2' });
      await sleep(2000);
    }
  } else {
    // Если currentUserData нет – проверим DOM
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

  // Кликаем "Войти"
  try {
    await page.waitForSelector(selectors.buttonGotoLogin, {
      visible: true,
      timeout: defaultWaitTime
    });
    await humanMouseMovements(page, 1500);
    await page.click(selectors.buttonGotoLogin);
    await logActions('Клик по кнопке "Войти" выполнен', ws, 'in-progress');

    // (Новая пауза) ждём, пока React отрисует форму
    await waitForGlobalSpinnerToDisappear(page); 
    await sleep(2000);
  } catch (errLoginBtn) {
    await logActions('Не нашли кнопку "Войти". Возможно, сайт не загрузился.', ws, 'error');
    return false;
  }

  // Проверяем капчу Press & Hold
  try {
    await page.waitForSelector('#px-captcha', { timeout: captchaWaitTime });
    console.log('[auth.js] -> Обнаружена капча Press & Hold');
    await logActions('Капча "Press & Hold" найдена, решаем...', ws, 'in-progress');
    await solvePressAndHoldCaptcha(page);
    // После решения – ещё раз ждём отсутствия спиннера
    await waitForGlobalSpinnerToDisappear(page);
  } catch (err) {
    console.log('[auth.js] -> Капча не обнаружена (или не успела появиться):', err);
  }

  // Ждём поле логина
  try {
    await page.waitForSelector(selectors.loginInputSelector, {
      visible: true,
      timeout: defaultWaitTime
    });
    // Убеждаемся, что спиннер не перекрывает инпут
    await waitForGlobalSpinnerToDisappear(page);
    await logActions('Вводим логин...', ws, 'in-progress');
  } catch (errWaitLogin) {
    await logActions('Не удалось дождаться поля логина', ws, 'error');
    return false;
  }
  await page.type(selectors.loginInputSelector, userLogin, { delay: 100 });

  // Ждём ещё немного (React может подгрузить анимации)
  await sleep(1000);

  // Кликаем "Далее" (кнопка логина) – после этого появится поле пароля
  await clickWhenVisible(page, selectors.loginButton);
  console.log('[auth.js] -> Клик "Далее" (логин) выполнен.');
  
  // Снова ждём, что всё загружено (спиннер, React)
  await waitForGlobalSpinnerToDisappear(page);
  await sleep(2000);

  // Поле пароля
  try {
    await page.waitForSelector(selectors.passwordInput, {
      visible: true,
      timeout: defaultWaitTime
    });
    console.log('[auth.js] -> Поле пароля найдено (или ждём ручной)');
  } catch (errWaitPass) {
    await logActions('Не удалось дождаться поля пароля', ws, 'error');
    return false;
  }

  if (!waitingManualPassword) {
    // Есть пароль
    await page.type(selectors.passwordInput, userPassword, { delay: 100 });
    await humanMouseMovements(page, 1500);

    // Клик "Войти" (финальный)
    await page.click(selectors.authButton);
    await logActions('Пароль введён и отправлен', ws, 'in-progress');
  } else {
    // Нет пароля => ждём ручного ввода
    console.log('[auth.js] -> Пароль не найден в JSON, ждём ручной ввод.');
    await page.exposeFunction('onSubmitPassword', async () => {
      const typedPassword = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.value.trim() : '';
      }, selectors.passwordInput);

      if (typedPassword) {
        console.log('[auth.js] -> Пользователь ввёл пароль (скрыт), сохраняем в accData.json...');
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
      btn.addEventListener('click', () => { window.onSubmitPassword(); });
    }, selectors.authButton);

    console.log('[auth.js] -> Ожидание ручного пароля и клика "Войти"...');
  }

  // Проверяем успешную авторизацию
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
