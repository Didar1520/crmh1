const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/* Эндпоинты для справочной информации */

// Чтение аккаунтов (accData.json)
router.get('/accData', (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', 'AccData', 'accData.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[reference.js] -> Ошибка при чтении accData.json:', err);
      return res.status(500).json({ error: 'Не удалось прочитать accData.json' });
    }
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error('[reference.js] -> Ошибка парсинга accData.json:', parseError);
      res.status(500).json({ error: 'Ошибка парсинга accData.json' });
    }
  });
});

// Чтение клиентов (clientData.json)
router.get('/clientData', (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', 'ClientData', 'clientData.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[reference.js] -> Ошибка при чтении clientData.json:', err);
      return res.status(500).json({ error: 'Не удалось прочитать clientData.json' });
    }
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error('[reference.js] -> Ошибка парсинга clientData.json:', parseError);
      res.status(500).json({ error: 'Ошибка парсинга clientData.json' });
    }
  });
});

// Чтение адресов доставки (adressList.json)
router.get('/adressList', (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', 'adressBook', 'adressList.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[reference.js] -> Ошибка при чтении adressList.json:', err);
      return res.status(500).json({ error: 'Не удалось прочитать adressList.json' });
    }
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error('[reference.js] -> Ошибка парсинга adressList.json:', parseError);
      res.status(500).json({ error: 'Ошибка парсинга adressList.json' });
    }
  });
});

module.exports = router;
