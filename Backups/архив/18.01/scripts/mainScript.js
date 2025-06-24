// scripts/mainScript.js
/**
 * MAIN SCRIPT
 * -------------------------------------------------------------
 * - Запускает WebSocket-сервер на 9999
 * - При "syncAccount" => запускает Puppeteer, вызывает authorize(...), затем syncData(...)
 * - Создаёт папку профиля userDataDir:  <userDataBaseDir>/<email>
 * - Устанавливает viewport (ТОЛЬКО здесь)
 * - Используем таймауты из config.browserConfig.timeouts
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

// Подключаем stealth
puppeteer.use(StealthPlugin());

const wss = new WebSocket.Server({ port: 9999 });
console.log('[mainScript] -> WebSocket-сервер запущен на порту 9999');

wss.on('connection', (socket) => {
  console.log('[mainScript] -> Подключен новый клиент WebSocket');

  socket.on('message', async (message) => {
    let clientResponse = {};
    try {
      const data = JSON.parse(message);

      if (data.action === 'syncAccount' && config.actionsEnabled.syncAccount) {
        console.log('[mainScript] -> Запрос на синхронизацию аккаунта');

        // 1) Получаем email/пароль
        const userEmail = data.params?.email || config.accountForLogin.email;
        const userPass = data.params?.password || config.accountForLogin.pass || '';
        console.log(`[mainScript] -> Будем работать с аккаунтом: ${userEmail}`);

        // 2) Формируем userDataDir
        const userDataDirPath = path.join(
          config.browserConfig.userDataBaseDir,
          userEmail
        );
        if (!fs.existsSync(userDataDirPath)) {
          fs.mkdirSync(userDataDirPath, { recursive: true });
          console.log(`[mainScript] -> Создана папка профиля: ${userDataDirPath}`);
        } else {
          console.log(`[mainScript] -> Используем существующий профиль: ${userDataDirPath}`);
        }

        // 3) Запускаем браузер Puppeteer
        const browser = await puppeteer.launch({
          headless: config.browserConfig.headless,
          executablePath: config.browserConfig.chromiumPath,
          userDataDir: userDataDirPath,
          args: [...config.browserConfig.launchArgs]
        });

        // Открываем вкладку
        const page = await browser.newPage();

        // Ставим userAgent + заголовки
        const finalUserAgent = data.params?.userAgent || config.browserConfig.userAgent;
        await page.setUserAgent(finalUserAgent);
        console.log(`[mainScript] -> User-Agent: ${finalUserAgent}`);

        await page.setExtraHTTPHeaders(config.browserConfig.extraHTTPHeaders);
      
        

        // Ставим timeouts
        // (Если нужно, можете регулировать page.setDefaultTimeout / setDefaultNavigationTimeout)
        await page.setDefaultNavigationTimeout(config.browserConfig.timeouts.pageWaitTime);

        // Перехват запросов
        await page.setRequestInterception(true);
        page.on('request', (req) => req.continue());

        // 4) Устанавливаем viewport (Только здесь!)
        const finalWidth = data.params.screenWidth || 1366;
        const finalHeight = data.params.screenHeigth || 768;
        console.log(`[mainScript] -> Устанавливаем viewport: ${finalWidth}x${finalHeight}`);
        await page.setViewport({ width: finalWidth, height: finalHeight });

        // 5) Авторизация
        const authParams = {
          login: userEmail,
          password: userPass
          // Убираем screenWidth/screenHeigth, 
          // т.к. вы просили только 1 место для viewport
        };

        const authSuccess = await authorize(page, authParams, socket);

        if (authSuccess) {
          console.log('[mainScript] -> Авторизация прошла, вызываем syncData...');
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
          console.log('[mainScript] -> Авторизация НЕ прошла');
          clientResponse = { status: false, message: 'Ошибка авторизации' };
        }

        await browser.close();

      } else if (data.action === 'makeOrder') {
        if (config.actionsEnabled.makeOrder) {
          clientResponse = { status: true, message: 'Заказ оформлен (пример)' };
        } else {
          clientResponse = { status: false, message: 'Действие makeOrder отключено в настройках' };
        }
      } else {
        clientResponse = { status: false, message: 'Неверный запрос или действие отключено' };
      }

    } catch (err) {
      clientResponse = { status: false, message: 'Ошибка обработки запроса' };
      console.error('[mainScript] -> Сбой выполнения запроса:', err);
    }

    socket.send(JSON.stringify(clientResponse));
  });

  socket.on('close', () => {
    console.log('[mainScript] -> Клиент WebSocket отключился');
  });
});
