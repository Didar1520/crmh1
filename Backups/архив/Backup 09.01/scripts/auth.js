// scripts/auth.js

const selectors = require('./selectors');
const { humanMouseMovements, clickWhenVisible, waitForStateChange, logActions, sleep } = require('./utils');
const { solvePressAndHoldCaptcha } = require('./captcha');

async function authorize(page, params, ws) {
  await logActions('Проверяем состояние авторизации...', ws, 'in-progress');

  let currentUserData = null;

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('catalog.app.iherb.com/catalog/currentUser')) {
      try {
        // Проверяем, успешен ли ответ
        if (response.ok()) {
          const content = await response.text();
          const json = JSON.parse(content);
          currentUserData = json;
        } else {
          console.log('Ответ currentUser не ок, пропускаем:', response.status());
        }
      } catch (err) {
        console.log('Ошибка чтения currentUser:', err);
      }
    }
  });

  await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2' });
  await sleep(2000);

  if (currentUserData && currentUserData.email) {
    const currentEmail = currentUserData.email.toLowerCase();
    const neededEmail = params.login.toLowerCase();

    if (currentEmail === neededEmail) {
      await logActions(`Уже авторизован нужный пользователь: ${currentEmail}`, ws, 'success');
      return true;
    } else {
      await logActions(`Авторизован другой пользователь (${currentEmail}), выходим...`, ws, 'in-progress');
      try {
        await page.goto('https://checkout12.iherb.com/account/logoff', { waitUntil: 'networkidle2' });
        await sleep(2000);
        await logActions('Выход завершен, авторизуем нужного пользователя...', ws, 'in-progress');
      } catch (err) {
        await logActions('Ошибка при выходе из аккаунта', ws, 'error');
        return false;
      }

      currentUserData = null;
      await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2' });
      await sleep(2000);
    }
  } else {
    const helloUser = await page.evaluate(() => {
      const el = document.querySelector('.username-my-account-container .welcome-name');
      return el ? el.textContent.trim().toLowerCase() : null;
    });

    if (helloUser && helloUser === params.login.toLowerCase()) {
      await logActions(`Уже авторизован нужный пользователь: ${helloUser}`, ws, 'success');
      return true;
    }

    if (helloUser && helloUser !== params.login.toLowerCase()) {
      await logActions(`Авторизован другой пользователь (${helloUser}), выходим...`, ws, 'in-progress');
      try {
        await page.goto('https://checkout12.iherb.com/account/logoff', { waitUntil: 'networkidle2' });
        await sleep(2000);
        await logActions('Выход завершен, авторизуем нужного пользователя...', ws, 'in-progress');
        await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2' });
        await sleep(2000);
      } catch (err) {
        await logActions('Ошибка при выходе из аккаунта', ws, 'error');
        return false;
      }
    }
  }

  try {
    await page.waitForSelector('#truste-consent-button', { visible: true, timeout: 5000 });
    await logActions('Обнаружена кнопка принятия куки, принимаем...', ws, 'in-progress');
    await page.click('#truste-consent-button');
    await sleep(1000);
  } catch (err) {}

  await page.setViewport({ width: params.screenWidth, height: params.screenHeigth });
  await logActions(`Viewport установлен: ${params.screenWidth}x${params.screenHeigth}`, ws, 'in-progress');

  try {
    await page.waitForSelector(selectors.buttonGotoLogin, { visible: true, timeout: 10000 });
    await logActions('Найден и нажимаем кнопку "Войти"', ws, 'in-progress');
    await humanMouseMovements(page, 2000);
    await page.click(selectors.buttonGotoLogin);
    await logActions('Клик по кнопке "Войти" выполнен', ws, 'in-progress');
  } catch (err) {
    await logActions('Не удалось найти кнопку "Войти". Возможно, проблемы с сайтом.', ws, 'error');
    return false;
  }

  try {
    await page.waitForSelector('#px-captcha', { timeout: 10000 });
    await logActions('Обнаружена капча, начинаем её решать...', ws, 'in-progress');
    await humanMouseMovements(page, 2000);
    await humanMouseMovements(page, 1500);
    const captchaSolved = await solvePressAndHoldCaptcha(page);
    if (!captchaSolved) {
      await logActions('Не удалось решить капчу', ws, 'error');
      return false;
    }
    await logActions('Капча успешно решена', ws, 'in-progress');
  } catch (err) {
    await logActions('Капча отсутствует или не требуется', ws, 'in-progress');
  }

  await logActions('Ожидаем появления поля логина...', ws, 'in-progress');
  await page.waitForSelector(selectors.loginInputSelector, { visible: true, timeout: 100000 });
  await page.focus(selectors.loginInputSelector);
  await sleep(500);
  await logActions('Поле логина найдено, начинаем ввод', ws, 'in-progress');
  await page.type(selectors.loginInputSelector, params.login, { delay: 100 });
  await clickWhenVisible(page, selectors.loginButton);
  await logActions('Логин введен и отправлен', ws, 'in-progress');

  await logActions('Ожидаем появления поля пароля...', ws, 'in-progress');
  await page.waitForSelector(selectors.passwordInput, { visible: true, timeout: 1000000 });
  await page.focus(selectors.passwordInput);
  await sleep(500);
  await logActions('Поле пароля найдено, начинаем ввод', ws, 'in-progress');
  await page.type(selectors.passwordInput, params.password, { delay: 100 });
  await humanMouseMovements(page, 2000);
  await page.click(selectors.authButton);
  await logActions('Пароль введен и отправлен', ws, 'in-progress');

  try {
    await page.waitForSelector(selectors.gotoOrderCheckout, { visible: true, timeout: 30000 });
    await logActions('Авторизация прошла успешно', ws, 'success');
    return true;
  } catch (err) {
    await logActions('Не удалось подтвердить авторизацию, возможно неверные учетные данные', ws, 'error');
    return false;
  }
}

module.exports = { authorize };
