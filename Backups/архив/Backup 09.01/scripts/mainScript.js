// scripts/mainScript.js

const puppeteer = require('puppeteer-extra');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { authorize } = require('./auth');
const { syncData } = require('./sync/syncData');
const { logActions } = require('./utils');

const configPath = path.join(__dirname, '..', 'inputConfig.json');
let configData = {};
if (fs.existsSync(configPath)) {
  configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
  // Если файла нет, берём дефолт
  configData = {
    syncData: {
      rewards: true,
      cards: false,
      addresses: false,
      orders: false,
      refCode: true,
      orderedProducts: false,
      reviews: false
    },
    actionsEnabled: {
      syncAccount: true,
      makeOrder: false
    }
  };
}

// Подключаем StealthPlugin, как и раньше
puppeteer.use(StealthPlugin());

// Общая конфигурация (не меняем логику)
var configuration = {
  logs: true,
  paymentLimit: 200,
  applicationPort: 9999,
  chromiumPath: 'C:\\Users\\Didar1520\\AppData\\Local\\Chromium\\Application\\chrome.exe'
};

const wss = new WebSocket.Server({ port: configuration.applicationPort });

wss.on('connection', (socket) => {
  console.log('Подключен новый клиент WebSocket');
  
  socket.on('message', async (message) => {
    let clientResponse = {};
    try {
      const data = JSON.parse(message);

      // Проверяем, включено ли syncAccount в inputConfig.json
      if (data.action === 'syncAccount' && configData.actionsEnabled.syncAccount) {
        console.log('Запрос на синхронизацию аккаунта:', data.params);

        // Создаём userDataDir для этого логина (как в старом коде)
        const userDataDir = path.join(__dirname, '..', 'userData', data.params.login);
        const userDataDirPath = path.resolve(userDataDir);
        if (!fs.existsSync(userDataDirPath)){
            fs.mkdirSync(userDataDirPath, { recursive: true });
        }

        // Запуск браузера c нужным профилем
        const browser = await puppeteer.launch({
          headless: false,
          executablePath: configuration.chromiumPath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ],
          userDataDir: userDataDirPath
        });

        const page = await browser.newPage();
        await page.setViewport({
          width: data.params.screenWidth,
          height: data.params.screenHeigth,
        });
        await logActions(`Viewport установлен: ${data.params.screenWidth}x${data.params.screenHeigth}`, socket, 'in-progress');

        // Авторизация по старому коду (auth.js)
        const authSuccess = await authorize(page, data.params, socket);
        if (authSuccess) {
          try {
            // Вызов syncData (см. ниже), передаём configData.syncData
            const accountData = await syncData(page, socket, configData.syncData);
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
        clientResponse = { status: false, message: 'Действие makeOrder отключено в настройках' };
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
