// scripts/mainScript.js
/**
 * Минимальный WebSocket сервер:
 *  - Не проверяет "CartLink" или "sync" в data.params.
 *  - Просто вызывает processAllOrders() при любом сообщении.
 */

const WebSocket = require('ws');
const { processAllOrders } = require('./actions/orderManager.js'); 
// Путь: "scripts/" → "scripts/actions/orderManager.js", ок

const port = 9999;
const wss = new WebSocket.Server({ port });
console.log(`[mainScript] -> WebSocket-сервер запущен на порту ${port}`);

wss.on('connection', (socket) => {
  console.log('[mainScript] -> Подключен новый клиент WebSocket');

  socket.on('message', async (message) => {
    // Парсим, но не используем (всё берём из inputConfig.json)
    try {
      const data = JSON.parse(message);
      console.log('[mainScript] -> Получены данные от клиента:', data);
    } catch (err) {
      console.log('[mainScript] -> Не удалось JSON.parse:', err);
    }

    console.log('[mainScript] -> Запускаем processAllOrders()');
    // Вызываем processAllOrders (которая читает inputConfig.json)
    const result = await processAllOrders();

    // Допустим, вернём клиенту result
    socket.send(JSON.stringify({ status: true, message: 'Обработка завершена', result }));
  });

  socket.on('close', () => {
    console.log('[mainScript] -> Клиент WebSocket отключился');
  });
});
