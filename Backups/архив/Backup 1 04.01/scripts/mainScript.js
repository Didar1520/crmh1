// scripts/mainScript.js

const puppeteer = require('puppeteer-extra');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { authorize } = require('./auth');
const { syncData } = require('./sync/syncData');
const { logActions, sleep } = require('./utils');

// Подключаем из вашего уже существующего captcha.js
// (код solvePressAndHoldCaptcha НЕ меняем — берём тот, что работал "до этого")
const { solvePressAndHoldCaptcha } = require('./captcha');

const configPath = path.join(__dirname, '..', 'inputConfig.json');
let configData = {};
if (fs.existsSync(configPath)) {
  configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
  configData = {
    "syncData": {
      "rewards": true,
      "cards": true,
      "addresses": true,
      "orders": false,
      "refCode": true,
      "orderedProducts": false,
      "reviews": false
    },
    "actionsEnabled": {
      "syncAccount": true,
      "makeOrder": false
    }
  };
}

puppeteer.use(StealthPlugin());

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

      if (data.action === 'syncAccount' && configData.actionsEnabled.syncAccount) {
        console.log('Запрос на синхронизацию аккаунта:', data.params);

        const userDataDir = path.join(__dirname, '..', 'userData', data.params.login);
        const userDataDirPath = path.resolve(userDataDir);
        if (!fs.existsSync(userDataDirPath)){
            fs.mkdirSync(userDataDirPath, { recursive: true });
        }

        // Создаём браузер с указанием userDataDir
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

        // ─────────────────────────────────────────────────────────────────────────
        // ДОБАВЛЯЕМ «УНИВЕРСАЛЬНУЮ» ПРОВЕРКУ КАПЧИ: слушаем событие framenavigated
        // ─────────────────────────────────────────────────────────────────────────
        page.on('framenavigated', async (frame) => {
          try {
            // Ищем элемент #px-captcha
            const captchaElement = await frame.$('#px-captcha');
            if (captchaElement) {
              console.log('[GlobalCaptcha] Обнаружена капча вне авторизации, пытаемся решить...');
              // Попробуем решить капчу "на лету" (как в auth.js)
              // Логируем в WebSocket (можно по желанию)
              await logActions('Найдена капча (фоновая), решаем...', socket, 'in-progress');

              const solved = await solvePressAndHoldCaptcha(page);
              if (!solved) {
                console.log('[GlobalCaptcha] Не удалось решить капчу.');
                await logActions('Капча не решена (Try again)', socket, 'error');
              } else {
                console.log('[GlobalCaptcha] Капча успешно решена.');
                await logActions('Фоновая капча решена', socket, 'success');
                // Желательно подождать чуть-чуть, чтобы сайт успел «принять» решение
                await sleep(2000);
              }
            }
          } catch (err) {
            console.log('[GlobalCaptcha] Ошибка при проверке фрейма на капчу:', err);
          }
        });
        // ─────────────────────────────────────────────────────────────────────────

        // Далее авторизация (старая логика, НЕ трогаем)
        const authSuccess = await authorize(page, data.params, socket);
        if (authSuccess) {
          try {
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
