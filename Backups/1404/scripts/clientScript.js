// scripts/clientScript.js
/**
 * КОРОТКАЯ ИНСТРУКЦИЯ:
 * ------------------------------------
 * Раньше конфиг браузера (userAgent) лежал в config.js (как browserConfig).
 * Теперь этот файл переехал / разделён. 
 * Фактически, userAgent хранится в "browserConfig.js".
 * 
 * => нужно импортировать "browserConfig.js", а НЕ "config.js", если хотим взять userAgent!
 */

const WebSocket = require('ws');

// Вместо const config = require('./config');
// Импортируем browserConfig, где есть browserConfig.userAgent
const browserConf = require('./browserConfig');

// Подключаемся к WebSocket серверу
const wsClient = new WebSocket('ws://localhost:9999');

wsClient.on('open', () => {
  console.log('Соединение с Puppeteer скриптом установлено.');

  // Для оформления заказа нужны только параметры экрана и userAgent
  const screenWidth = 1920;
  const screenHeigth = 1080;

  // В browserConf.browserConfig.userAgent лежит userAgent
  const userAgent = browserConf.browserConfig?.userAgent || '';

  // Формируем сообщение (action=placeOrder)
  const message = {
    action: 'placeOrder',
    params: {
      userAgent: userAgent,
      screenWidth: screenWidth,
      screenHeigth: screenHeigth
    }
  };

  // Отправляем запрос на оформление заказа
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
