const express = require('express');
const router = express.Router();
const { processAllOrders } = require('../scripts/actions/orderManager.js');

/**
 * Маршрут: POST /runOrders
 * Вызывает processAllOrders() и возвращает результат + все console.log в JSON.
 */
router.post('/runOrders', async (req, res) => {
  // Перехват console.log, чтобы отправить логи на фронт
  const originalLog = console.log;
  const logs = [];
  console.log = function (...args) {
    // Превращаем любые объекты в JSON, чтобы не потерять информацию
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
    logs.push(msg);
    originalLog.apply(console, args); // также выводим их в терминал
  };

  try {
    const result = await processAllOrders();
    return res.json({
      status: true,
      message: 'processAllOrders выполнен',
      logs,
      result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: 'Ошибка при выполнении processAllOrders',
      error: error.message,
      logs
    });
  } finally {
    // Восстанавливаем оригинальный console.log
    console.log = originalLog;
  }
});

module.exports = router;
