const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/* Эндпоинты для заказов */

// Чтение исходящих заказов (inputConfig.json)
router.get('/inputConfig', (req, res) => {
  const filePath = path.join(__dirname, '..', 'scripts', 'inputConfig.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[orders.js] -> Ошибка при чтении inputConfig.json:', err);
      return res.status(500).json({ error: 'Не удалось прочитать inputConfig.json' });
    }
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error('[orders.js] -> Ошибка парсинга inputConfig.json:', parseError);
      res.status(500).json({ error: 'Ошибка парсинга inputConfig.json' });
    }
  });
});

// Сохранение исходящих заказов (inputConfig.json)
router.post('/saveConfig', (req, res) => {
  const newData = req.body;
  const filePath = path.join(__dirname, '..', 'scripts', 'inputConfig.json');
  if (!Array.isArray(newData)) {
    return res.status(400).json({ error: 'Данные должны быть массивом заказов' });
  }
  fs.writeFile(filePath, JSON.stringify(newData, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('[orders.js] -> Ошибка при записи в inputConfig.json:', err);
      return res.status(500).json({ error: 'Не удалось сохранить данные в inputConfig.json' });
    }
    res.json({ message: 'Файл inputConfig.json успешно обновлён' });
  });
});

// Чтение исполненных заказов (ordersData.json)
router.get('/ordersData', (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', 'OrdersData', 'ordersData.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[orders.js] -> Ошибка при чтении ordersData.json:', err);
      return res.status(500).json({ error: 'Не удалось прочитать ordersData.json' });
    }
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error('[orders.js] -> Ошибка парсинга ordersData.json:', parseError);
      res.status(500).json({ error: 'Ошибка парсинга ordersData.json' });
    }
  });
});

// Сохранение исполненных заказов (ordersData.json)
router.post('/saveOrdersData', (req, res) => {
  const newData = req.body;
  const filePath = path.join(__dirname, '..', 'data', 'OrdersData', 'ordersData.json');
  if (!Array.isArray(newData)) {
    return res.status(400).json({ error: 'Данные должны быть массивом заказов' });
  }
  // Создаем директорию, если её нет
  const dirPath = path.join(__dirname, '..', 'data', 'OrdersData');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFile(filePath, JSON.stringify({ orders: newData }, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('[orders.js] -> Ошибка при записи в ordersData.json:', err);
      return res.status(500).json({ error: 'Не удалось сохранить данные в ordersData.json' });
    }
    res.json({ message: 'Файл ordersData.json успешно обновлён' });
  });
});

module.exports = router;
