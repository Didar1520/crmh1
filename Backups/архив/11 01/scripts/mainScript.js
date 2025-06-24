// scripts/mainScript.js

const puppeteer = require('puppeteer-extra');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const { authorize } = require('./auth');
const { syncData } = require('./sync/syncData');
const { logActions } = require('./utils');

// Подключаем config.js из корня
const config = require('../config');

// Подключаем StealthPlugin
puppeteer.use(StealthPlugin());

// Открываем WebSocket
const wss = new WebSocket.Server({ port: 9999 }); 

wss.on('connection', (socket) => {
  console.log('Подключен новый клиент WebSocket');
  
  socket.on('message', async (message) => {
    let clientResponse = {};
    try {
      const data = JSON.parse(message);

      // Проверяем, включено ли syncAccount в config.actionsEnabled
      if (data.action === 'syncAccount' && config.actionsEnabled.syncAccount) {
        console.log('Запрос на синхронизацию аккаунта через WebSocket.');

        // Берём e-mail из config.js
        const userEmail = config.accountForLogin.email;  
        // Создаём отдельную папку userDataDir для этого e-mail
        const userDataDirPath = path.resolve(
          path.join(config.browserConfig.userDataBaseDir, userEmail)
        );
        if (!fs.existsSync(userDataDirPath)){
            fs.mkdirSync(userDataDirPath, { recursive: true });
        }

        // Запускаем браузер
        const browser = await puppeteer.launch({
          headless: config.browserConfig.headless,
          executablePath: config.browserConfig.chromiumPath,
          userDataDir: userDataDirPath,
          args: [
            ...config.browserConfig.launchArgs,
            `--window-size=${data.params.screenWidth},${data.params.screenHeigth}`
          ]
        });

        const page = await browser.newPage();

        // Логический размер (viewport)
        await page.setViewport({
          width: data.params.screenWidth,
          height: data.params.screenHeigth
        });
        await logActions(
          `Viewport установлен: ${data.params.screenWidth}x${data.params.screenHeigth}`,
          socket,
          'in-progress'
        );

        // Авторизация
        const authParams = {
          // Логин и пароль берём из config.accountForLogin
          login: config.accountForLogin.email,
          password: config.accountForLogin.pass || '',
          screenWidth: data.params.screenWidth,
          screenHeigth: data.params.screenHeigth
        };
        const authSuccess = await authorize(page, authParams, socket);

        if (authSuccess) {
          try {
            // Синхронизация
            const accountData = await syncData(page, socket, config.syncData);
            clientResponse = {
              status: 'accountData',
              message: accountData
            };
          } catch (err) {
            console.log('Ошибка при синхронизации данных аккаунта:', err);
            await logActions('Ошибка при синхронизации данных аккаунта', socket, 'error');
            clientResponse = { status: false, message: 'Ошибка при синхронизации данных аккаунта' };
          }
        } else {
          clientResponse = { status: false, message: 'Ошибка авторизации' };
        }

        await browser.close();

      } else if (data.action === 'makeOrder') {
        if (config.actionsEnabled.makeOrder) {
          // Логика заказа — если у вас есть
          clientResponse = { status: true, message: 'Заказ оформлен (пример)' };
        } else {
          clientResponse = { status: false, message: 'Действие makeOrder отключено в настройках' };
        }
      } else {
        clientResponse = { status: false, message: 'Неверный запрос или действие отключено' };
      }

    } catch (err) {
      clientResponse = { status: false, message: 'Ошибка обработки запроса' };
      console.error('Сбой выполнения запроса:', err);
    }

    socket.send(JSON.stringify(clientResponse));
  });

  socket.on('close', () => {
    console.log('Клиент WebSocket отключился');
  });
});
