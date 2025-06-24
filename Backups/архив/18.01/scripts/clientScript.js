// scripts/clientScript.js

/**
 * КОРОТКАЯ ИНСТРУКЦИЯ:
 * ------------------------------------
 * В старом коде пароль и логин брались из db.json, 
 * что приводило к использованию "левого" (некорректного) пароля.
 * 
 * Теперь мы избавляемся от db.json совсем и берём 
 * email / password из config.js (или вбиваем вручную).
 * ------------------------------------
 */

const WebSocket = require('ws');
// Если хотите брать email/pass из config.js:
const config = require('../config');

// Подключаемся к WebSocket серверу
const wsClient = new WebSocket('ws://localhost:9999');

wsClient.on('open', () => {
  console.log('Соединение с Puppeteer скриптом установлено.');

  // !!! ЗДЕСЬ УКАЖИТЕ ЛЮБОЙ ИСТОЧНИК ДАННЫХ !!!
  // Например, возьмём из config.accountForLogin
  const userEmail = config.accountForLogin.email;
  const userPass = config.accountForLogin.pass;

  // Параметры экрана (можно взять из config или прописать вручную)
  const screenWidth = 1366;
  const screenHeigth = 768;

  // Формируем сообщение (action=syncAccount)
  const message = {
    action: 'syncAccount',
    params: {
      // Если ваш код внутри mainScript.js ждёт "login" / "password", 
      // то названия полей лучше оставить такими же:
      email: userEmail,
      password: userPass,
      userAgent: config.browserConfig.userAgent,
      screenWidth: screenWidth,
      screenHeigth: screenHeigth
    }
  };

  // Отправляем запрос на авторизацию
  wsClient.send(JSON.stringify(message));
});

wsClient.on('message', (data) => {
  try {
    const response = JSON.parse(data);
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
