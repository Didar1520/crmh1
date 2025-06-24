/* File: D:\Didar1520\CRM\server.js */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { processAllOrders } = require('./scripts/actions/orderManager.js');

const app = express();
app.use(express.json());

// ====== (Старые эндпоинты) ExecuteAction ======
app.get('/inputConfig', (req, res) => {
  try {
    const inputConfigPath = path.join(__dirname, 'inputConfig.json');
    if (!fs.existsSync(inputConfigPath)) {
      return res.json([]);
    }
    const data = fs.readFileSync(inputConfigPath, 'utf8');
    const orders = JSON.parse(data);
    return res.json(orders);
  } catch (error) {
    console.error('[server.js] -> Ошибка чтения inputConfig.json:', error);
    return res.status(500).json({ error: 'Ошибка чтения inputConfig' });
  }
});

app.post('/saveConfig', (req, res) => {
  try {
    const orders = req.body;
    const inputConfigPath = path.join(__dirname, 'inputConfig.json');
    fs.writeFileSync(inputConfigPath, JSON.stringify(orders, null, 2), 'utf8');
    return res.json({ status: 'success', message: 'Заказы сохранены' });
  } catch (error) {
    console.error('[server.js] -> Ошибка записи inputConfig.json:', error);
    return res.status(500).json({ error: 'Ошибка сохранения config' });
  }
});

app.post('/runOrders', async (req, res) => {
  const originalConsoleLog = console.log;
  const logs = [];
  console.log = function (...args) {
    logs.push(args.join(' '));
    originalConsoleLog.apply(console, args);
  };

  try {
    const result = await processAllOrders();
    console.log = originalConsoleLog;
    return res.json({ status: result.status, result: result.message, logs });
  } catch (error) {
    console.log = originalConsoleLog;
    console.error('[server.js] -> Ошибка в /runOrders:', error);
    return res.status(500).json({
      status: false,
      message: 'Не удалось выполнить processAllOrders',
      error: error.message,
      logs
    });
  }
});

// ====== (Новые эндпоинты) ordersData + ordersSettings ======
const ordersDataPath = path.join(__dirname, 'data', 'OrdersData', 'ordersData.json');
const ordersSettingsPath = path.join(
  __dirname,
  'UI',
  'src',
  'components',
  'Orders',
  'ExecutedOrders',
  'settings',
  'ordersSettings.json'
);

// GET /ordersData
app.get('/ordersData', (req, res) => {
  try {
    if (!fs.existsSync(ordersDataPath)) {
      // Если файла нет — возвращаем пустой объект
      return res.json({ orders: [] });
    }
    const data = fs.readFileSync(ordersDataPath, 'utf8');
    return res.json(JSON.parse(data));
  } catch (error) {
    console.error('[server.js] -> Ошибка чтения ordersData.json:', error);
    return res.status(500).json({ error: 'Ошибка чтения ordersData.json' });
  }
});

// POST /saveOrdersData
app.post('/saveOrdersData', (req, res) => {
  try {
    const newData = req.body; // { orders: [...] }
    fs.writeFileSync(ordersDataPath, JSON.stringify(newData, null, 2), 'utf8');
    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('[server.js] -> Ошибка записи ordersData.json:', error);
    return res.status(500).json({ error: 'Ошибка записи ordersData.json' });
  }
});

// GET /ordersSettings
app.get('/ordersSettings', (req, res) => {
  try {
    if (!fs.existsSync(ordersSettingsPath)) {
      // Если файла нет — создадим по умолчанию
      const defaultSettings = {
        columnsVisibility: {
          orderNumber: true,
          trackCode: true,
          date: true,
          rub: true,
          usd: true,
          commission: true,
          rate: true,
          bybitRate: true,
          client: true,
          paymentMethod: true,
          cartLink: true,
          deliveryAddress: true,
          referralCodeUsed: true,
          promoCodeUsed: true,
          orderAccount: true,
          rewardsUsed: true
        },
        columnsOrder: [
          'orderNumber',
          'trackCode',
          'date',
          'rub',
          'commission',
          'usd',
          'bybitRate',
          'rate',
          'client',
          'paymentMethod',
          'cartLink',
          'deliveryAddress',
          'referralCodeUsed',
          'promoCodeUsed',
          'orderAccount',
          'rewardsUsed'
        ],
        pageSize: 20,
        useInfiniteScroll: false
      };
      fs.mkdirSync(path.dirname(ordersSettingsPath), { recursive: true });
      fs.writeFileSync(
        ordersSettingsPath,
        JSON.stringify(defaultSettings, null, 2),
        'utf8'
      );
      return res.json(defaultSettings);
    }

    const data = fs.readFileSync(ordersSettingsPath, 'utf8');
    return res.json(JSON.parse(data));
  } catch (error) {
    console.error('[server.js] -> Ошибка чтения ordersSettings.json:', error);
    return res.status(500).json({ error: 'Ошибка чтения ordersSettings.json' });
  }
});

// POST /saveOrdersSettings
app.post('/saveOrdersSettings', (req, res) => {
  try {
    const settings = req.body;
    fs.mkdirSync(path.dirname(ordersSettingsPath), { recursive: true });
    fs.writeFileSync(ordersSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('[server.js] -> Ошибка записи ordersSettings.json:', error);
    return res.status(500).json({ error: 'Ошибка записи ordersSettings.json' });
  }
});

// ====== Раздача React-сборки (если build сделан) ======
app.use(express.static(path.join(__dirname, 'UI', 'dist')));

// ====== SPA-фолбек ======
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'UI', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[server.js] -> Сервер запущен на порту ${PORT}`);
});
