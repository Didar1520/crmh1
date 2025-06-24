// scripts/auth.js

const selectors = require('./selectors');
const { humanMouseMovements, clickWhenVisible, waitForStateChange, logActions, sleep } = require('./utils');
// Вместо дубля кода капчи, подключаем наши методы из captcha.js
const { checkAndSolveCaptchaInPlace } = require('./captcha');
const { getAccData, saveAccData } = require('./dataManager');

async function authorize(page, params, ws) {
  await logActions('Проверяем состояние авторизации...', ws, 'in-progress');

  let currentUserData = null;
  const userLogin = params.login.trim();
  let userPassword = params.password.trim(); // Может быть пустая

  // Если пароль пуст, ищем в accData.json
  if (!userPassword) {
    const accData = await getAccData(); 
    if (accData && accData.accounts) {
      const foundUser = accData.accounts.find(a => a.email.toLowerCase() === userLogin.toLowerCase());
      if (foundUser && foundUser.pass && foundUser.pass.trim() !== '') {
        userPassword = foundUser.pass.trim();
        console.log(`[auth] Пароль взят из accData.json для "${userLogin}"`);
      }
    }
  }

  // Если всё ещё нет пароля => ждём ручной ввод
  let waitingManualPassword = !userPassword;

  // Слушаем /catalog/currentUser
  page.on('response', async (response) => {
    try {
      if (!response.ok()) return;  // Игнорируем, если статус не 200
      const url = response.url();
      if (url.includes('catalog.app.iherb.com/catalog/currentUser')) {
        const content = await response.text();
        const json = JSON.parse(content);
        currentUserData = json;
      }
    } catch (err) {
      console.log('Ошибка чтения currentUser:', err);
    }
  });

  // Заходим на iherb.com
  await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2' });
  await sleep(2000);

  // Проверяем, может уже залогинен кто-то
  if (currentUserData && currentUserData.email) {
    const currentEmail = currentUserData.email.toLowerCase();
    if (currentEmail === userLogin.toLowerCase()) {
      await logActions(`Уже авторизован нужный пользователь: ${currentEmail}`, ws, 'success');
      return true;
    } else {
      // Выходим
      await logActions(`Авторизован другой пользователь (${currentEmail}), выходим...`, ws, 'in-progress');
      try {
        await page.goto('https://checkout12.iherb.com/account/logoff', { waitUntil: 'networkidle2' });
        await sleep(2000);
      } catch (err) {
        await logActions('Ошибка при выходе из аккаунта', ws, 'error');
        return false;
      }
      currentUserData = null;
      // Заходим снова на главную
      await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2' });
      await sleep(2000);
    }
  } else {
    // Проверим DOM
    const helloUser = await page.evaluate(() => {
      const el = document.querySelector('.username-my-account-container .welcome-name');
      return el ? el.textContent.trim().toLowerCase() : null;
    });
    if (helloUser && helloUser === userLogin.toLowerCase()) {
      await logActions(`Уже авторизован нужный пользователь: ${helloUser}`, ws, 'success');
      return true;
    } else if (helloUser && helloUser !== userLogin.toLowerCase()) {
      await logActions(`Авторизован другой пользователь (${helloUser}), выходим...`, ws, 'in-progress');
      try {
        await page.goto('https://checkout12.iherb.com/account/logoff', { waitUntil: 'networkidle2' });
        await sleep(2000);
        await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2' });
        await sleep(2000);
      } catch (err) {
        await logActions('Ошибка при выходе из аккаунта', ws, 'error');
        return false;
      }
    }
  }

  // Принимаем куки, если есть
  try {
    await page.waitForSelector('#truste-consent-button', { visible: true, timeout: 5000 });
    await page.click('#truste-consent-button');
    await sleep(1000);
  } catch (err) {}

  // Устанавливаем viewport
  await page.setViewport({ width: params.screenWidth, height: params.screenHeigth });
  await logActions(`Viewport установлен: ${params.screenWidth}x${params.screenHeigth}`, ws, 'in-progress');

  // Нажимаем "Войти"
  try {
    await page.waitForSelector(selectors.buttonGotoLogin, { visible: true, timeout: 15000 });
    await humanMouseMovements(page, 2000);
    await page.click(selectors.buttonGotoLogin);
    await logActions('Клик по кнопке "Войти" выполнен', ws, 'in-progress');
  } catch (err) {
    await logActions('Не удалось найти кнопку "Войти". Возможно, проблемы с сайтом.', ws, 'error');
    return false;
  }

  // Вызываем «точечную» проверку/решение капчи (из captcha.js)
  // (Можно увеличить таймаут, если капча часто появляется не сразу)
  await logActions('Проверяем/решаем капчу, если появилась...', ws, 'in-progress');
  await checkAndSolveCaptchaInPlace(page, ws, 10000);

  // Ввод логина
  try {
    await page.waitForSelector(selectors.loginInputSelector, { visible: true, timeout: 30000 });
  } catch (err) {
    await logActions('Не удалось дождаться поля логина', ws, 'error');
    return false;
  }
  await page.type(selectors.loginInputSelector, userLogin, { delay: 100 });
  await clickWhenVisible(page, selectors.loginButton);
  await logActions('Логин введён и отправлен', ws, 'in-progress');

  // Поле пароля
  try {
    await page.waitForSelector(selectors.passwordInput, { visible: true, timeout: 30000 });
  } catch (err) {
    await logActions('Не удалось дождаться поля пароля', ws, 'error');
    return false;
  }

  if (!waitingManualPassword) {
    // У нас есть пароль => вводим
    await page.type(selectors.passwordInput, userPassword, { delay: 100 });
    await humanMouseMovements(page, 1500);
    await page.click(selectors.authButton);
    await logActions('Пароль введен и отправлен', ws, 'in-progress');
  } else {
    // Нет пароля => ждём «ручного» ввода и клик по кнопке
    console.log(`[auth] Пароль для ${userLogin} не найден, ждём, что пользователь сам введёт на сайте...`);

    // Считываем введённый пароль при клике
    await page.exposeFunction('onSubmitPassword', async () => {
      const typedPassword = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.value.trim() : '';
      }, selectors.passwordInput);

      if (typedPassword) {
        console.log(`[auth] Пользователь ввёл пароль: ${typedPassword}, сохраняем в JSON`);
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

    console.log('[auth] Ожидание, пока пользователь нажмёт "Войти" вручную.');
  }

  // Ждём подтверждения авторизации
  try {
    await page.waitForSelector(selectors.gotoOrderCheckout, { visible: true, timeout: 30000 });
    await logActions('Авторизация прошла успешно', ws, 'success');
    return true;
  } catch (err) {
    await logActions('Не удалось подтвердить авторизацию', ws, 'error');
    return false;
  }
}

module.exports = { authorize };
