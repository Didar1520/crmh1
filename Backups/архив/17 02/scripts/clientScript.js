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

  // Для оформления заказа используются параметры из модуля mergeOrderParams внутри mainScript.js,
  // поэтому здесь достаточно задать только параметры экрана и userAgent.
  const screenWidth = 1920;
  const screenHeigth = 1080;

  // Формируем сообщение для оформления заказа (action=placeOrder)
  const message = {
    action: 'placeOrder',
    params: {
      userAgent: config.browserConfig.userAgent,
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
