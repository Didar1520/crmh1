// scripts/clientScript.js

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, '..', 'db.json');

// Загружаем данные аккаунта из JSON файла
let rawData = fs.readFileSync(dbPath, 'utf8');
let jsonData = JSON.parse(rawData);

// В данном примере берём первый аккаунт из списка
let account = jsonData.accounts[0];

// Подключаемся к WebSocket серверу, который слушает команды
const wsClient = new WebSocket('ws://localhost:9999');

wsClient.on('open', () => {
  console.log('Соединение с Puppeteer скриптом установлено.');

  // Отправляем команду авторизации (syncAccount)
  let message = {
    action: 'syncAccount',
    params: {
      login: account.login,
      password: account.password,
      userAgent: account.userAgent,
      screenWidth: account.screenWidth,
      screenHeigth: account.screenHeigth
    }
  };

  wsClient.send(JSON.stringify(message));
});

wsClient.on('message', (data) => {
  try {
    let response = JSON.parse(data);
    console.log('Получен ответ от Puppeteer скрипта:', response);
  } catch (err) {
    console.error('Ошибка при обработке ответа:', err);
  }
});

wsClient.on('error', (err) => {
  console.error('Ошибка соединения с Puppeteer скриптом:', err);
});

wsClient.on('close', () => {
  console.log('Соединение с Puppeteer скриптом закрыто.');
});
