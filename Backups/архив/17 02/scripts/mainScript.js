// scripts/mainScript.js
/**
 * MAIN SCRIPT
 * -------------------------------------------------------------
 * - Запускает WebSocket-сервер на 9999
 * - При "syncAccount" => берёт аккаунт из config.accountForLogin, авторизуется, вызывает syncData(...)
 * - При "placeOrder" => берёт аккаунт из ordersAction (mergeOrderParams), авторизуется, вызывает startOrderProcess(...)
 * - Не мешаем эти два модуля; они независимы (кроме авторизации).
 * - При любых капчах или ошибках используем captcha.js / pageErrorHandler.js
 */

const puppeteer = require('puppeteer-extra');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const config = require('../config');
const { authorize } = require('./auth');
const { syncData } = require('./sync/syncData');
const { logActions } = require('./utils');
const { setGlobalPageHandlers } = require('./pageErrorHandler');

// Модуль оформления заказа
// (Содержит mergeOrderParams, startOrderProcess, и т.д.)
const { mergeOrderParams, startOrderProcess } = require('./actions/ordersAction');

puppeteer.use(StealthPlugin());

const wss = new WebSocket.Server({ port: 9999 });
console.log('[mainScript] -> WebSocket-сервер запущен на порту 9999');

wss.on('connection', (socket) => {
  console.log('[mainScript] -> Подключен новый клиент WebSocket');

  socket.on('message', async (message) => {
    let clientResponse = {};
    try {
      const data = JSON.parse(message);
      const userAction = data.action; // "syncAccount" или "placeOrder" или что-то ещё

      /**
       * 1) СИНХРОНИЗАЦИЯ АККАУНТА (если включена)
       * ------------------------------------------------------
       */
      if (userAction === 'syncAccount' && config.actionsEnabled.syncAccount) {
        console.log('[mainScript] -> Запрос на синхронизацию аккаунта');

        // 1.1) Берём email/пароль ИМЕННО ИЗ config.accountForLogin
        const userEmail = data.params?.email || config.accountForLogin.email;
        const userPass = data.params?.password || config.accountForLogin.pass || '';
        console.log(`[mainScript] -> Будем работать с аккаунтом (syncAccount): ${userEmail}`);

        // 1.2) Создаём (или переиспользуем) userDataDir
        const userDataDirPath = path.join(config.browserConfig.userDataBaseDir, userEmail);
        if (!fs.existsSync(userDataDirPath)) {
          fs.mkdirSync(userDataDirPath, { recursive: true });
          console.log(`[mainScript] -> Создана папка профиля: ${userDataDirPath}`);
        } else {
          console.log(`[mainScript] -> Используем существующий профиль: ${userDataDirPath}`);
        }

        // 1.3) Запускаем браузер
        const browser = await puppeteer.launch({
          headless: config.browserConfig.headless,
          executablePath: config.browserConfig.chromiumPath,
          userDataDir: userDataDirPath,
          args: [...config.browserConfig.launchArgs]
        });
        const page = await browser.newPage();
        await setGlobalPageHandlers(page, socket);

        // Ставим userAgent
        const finalUserAgent = data.params?.userAgent || config.browserConfig.userAgent;
        await page.setUserAgent(finalUserAgent);
        console.log(`[mainScript] -> User-Agent: ${finalUserAgent}`);

        await page.setExtraHTTPHeaders(config.browserConfig.extraHTTPHeaders);
        await page.setDefaultNavigationTimeout(config.browserConfig.timeouts.pageWaitTime);

        // Перехват запросов
        await page.setRequestInterception(true);
        page.on('request', (req) => req.continue());

        // Viewport
        const finalWidth = data.params.screenWidth || 1366;
        const finalHeight = data.params.screenHeigth || 768;
        console.log(`[mainScript] -> Устанавливаем viewport (syncAccount): ${finalWidth}x${finalHeight}`);
        await page.setViewport({ width: finalWidth, height: finalHeight });

        // 1.4) Авторизация
        const authParams = { login: userEmail, password: userPass };
        const authSuccess = await authorize(page, authParams, socket);

        // 1.5) Если авторизация ок => вызываем syncData
        if (authSuccess) {
          console.log('[mainScript] -> Авторизация прошла (syncAccount), вызываем syncData...');
          try {
            const result = await syncData(page, socket, config.syncData);
            clientResponse = {
              status: 'accountData',
              message: result
            };
          } catch (errSync) {
            console.log('[mainScript] -> Ошибка при syncData:', errSync);
            await logActions('Ошибка при синхронизации данных аккаунта', socket, 'error');
            clientResponse = { status: false, message: 'Ошибка при синхронизации данных аккаунта' };
          }
        } else {
          console.log('[mainScript] -> Авторизация НЕ прошла (syncAccount)');
          clientResponse = { status: false, message: 'Ошибка авторизации (syncAccount)' };
        }

        await browser.close();

      /**
       * 2) ОФОРМЛЕНИЕ ЗАКАЗА (placeOrder) — ОТДЕЛЬНЫЙ БЛОК
       * ------------------------------------------------------
       */
      } else if (userAction === 'placeOrder' && config.actionsEnabled.placeOrder) {
        console.log('[mainScript] -> Запрос на ОФОРМЛЕНИЕ ЗАКАЗА (placeOrder)');

        // 2.1) Сливаем параметры из ordersConfig + ordersInputConfig
        //    (Если нужно, вы можете передать data.params внутрь mergeOrderParams
        //     но сейчас берём "по умолчанию" вариант)
        const finalParams = mergeOrderParams(); 
        // finalParams.account -> аккаунт для заказа
        // finalParams.promoCode ...
        // И т.д.

        // 2.2) Определяем email (возьмём из finalParams.account?)
        // ВОПРОС: Где хранить пароль для этого аккаунта?
        // Предположим, вы храните пароль в accData.json
        // или в ordersConfig. Здесь сделаем "заглушку".
        const userEmail = finalParams.account || 'DefaultOrderAccount@example.com';
        const userPass = 'PLACEHOLDER-PASSWORD'; 
        // ^ Нужно где-то получить реальный пароль, иначе authorize провалится.

        console.log(`[mainScript] -> Будем работать с аккаунтом (placeOrder): ${userEmail}`);

        // Создаём userDataDir
        const userDataDirPath = path.join(config.browserConfig.userDataBaseDir, userEmail);
        if (!fs.existsSync(userDataDirPath)) {
          fs.mkdirSync(userDataDirPath, { recursive: true });
          console.log(`[mainScript] -> Создана папка профиля (placeOrder): ${userDataDirPath}`);
        } else {
          console.log(`[mainScript] -> Используем существующий профиль (placeOrder): ${userDataDirPath}`);
        }

        // Запускаем браузер
        const browser = await puppeteer.launch({
          headless: config.browserConfig.headless,
          executablePath: config.browserConfig.chromiumPath,
          userDataDir: userDataDirPath,
          args: [...config.browserConfig.launchArgs]
        });
        const page = await browser.newPage();
        await setGlobalPageHandlers(page, socket);

        const finalUserAgent = config.browserConfig.userAgent;
        await page.setUserAgent(finalUserAgent);
        console.log(`[mainScript] -> User-Agent (placeOrder): ${finalUserAgent}`);

        await page.setExtraHTTPHeaders(config.browserConfig.extraHTTPHeaders);
        await page.setDefaultNavigationTimeout(config.browserConfig.timeouts.pageWaitTime);

        await page.setRequestInterception(true);
        page.on('request', (req) => req.continue());

        // Viewport
        const finalWidth = data.params?.screenWidth || 1366;
        const finalHeight = data.params?.screenHeigth || 768;
        console.log(`[mainScript] -> Устанавливаем viewport (placeOrder): ${finalWidth}x${finalHeight}`);
        await page.setViewport({ width: finalWidth, height: finalHeight });

        // Авторизация (для placeOrder)
        const authParams = { login: userEmail, password: userPass };
        const authSuccess = await authorize(page, authParams, socket);

        if (authSuccess) {
          console.log('[mainScript] -> Авторизация прошла (placeOrder), вызываем startOrderProcess...');
          try {
            // Передаём page и все finalParams для оформления заказа
            await startOrderProcess(page, socket, finalParams);
            // Возвращаем ответ
            clientResponse = {
              status: 'placeOrderResult',
              message: 'Заказ оформлен (черновой вариант)'
            };
          } catch (errOrder) {
            console.log('[mainScript] -> Ошибка при startOrderProcess:', errOrder);
            await logActions('Ошибка при оформлении заказа', socket, 'error');
            clientResponse = { status: false, message: 'Ошибка при оформлении заказа' };
          }
        } else {
          console.log('[mainScript] -> Авторизация НЕ прошла (placeOrder)');
          clientResponse = { status: false, message: 'Ошибка авторизации (placeOrder)' };
        }

        await browser.close();

      /**
       * 3) ЕСЛИ ДРУГИЕ ДЕЙСТВИЯ ИЛИ ОТКЛЮЧЕНЫ
       */
      } else {
        clientResponse = { status: false, message: 'Неверный запрос или действие отключено' };
      }

    } catch (err) {
      clientResponse = { status: false, message: 'Ошибка обработки запроса' };
      console.error('[mainScript] -> Сбой выполнения запроса:', err);
    }

    // Отправляем ответ обратно
    socket.send(JSON.stringify(clientResponse));
  });

  socket.on('close', () => {
    console.log('[mainScript] -> Клиент WebSocket отключился');
  });
});
