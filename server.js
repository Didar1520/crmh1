const express = require('express');
require('./scripts/core/monitor-socket').init();
const cors = require('cors');  // Подключение пакета cors
const path = require('path');
const fs = require('fs');
const { processAllOrders } = require('./scripts/actions/orderManager.js');

const app = express();

// Включаем CORS для всех запросов (или указываем конкретный origin)
app.use(cors());
app.use(express.json());


// ====== (Старые эндпоинты) ExecuteAction ======
app.get('/inputConfig', (req, res) => {
  try {
    const inputConfigPath = path.join(__dirname, 'scripts', 'inputConfig.json');
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
    const inputConfigPath = path.join(__dirname, 'scripts', 'inputConfig.json');
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


// ====== (Новые эндпоинты) ordersData ======
const ordersDataPath = path.join(__dirname, 'data', 'OrdersData', 'ordersData.json');

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


// ====== (Новые эндпоинты) clientData ======
const clientDataPath = path.join(__dirname, 'data', 'ClientData', 'clientData.json');

// GET /clientData
app.get('/clientData', (req, res) => {
  try {
    if (!fs.existsSync(clientDataPath)) {
      // Если файла нет, возвращаем пустой массив
      return res.json([]);
    }
    const data = fs.readFileSync(clientDataPath, 'utf8');
    const parsed = JSON.parse(data);
    // Если данные уже являются массивом или содержат поле clients – возвращаем массив
    if (Array.isArray(parsed)) {
      return res.json(parsed);
    } else if (parsed.clients && Array.isArray(parsed.clients)) {
      return res.json(parsed.clients);
    }
    // Если структура иная, возвращаем пустой массив
    return res.json([]);
  } catch (error) {
    console.error('[server.js] -> Ошибка чтения clientData.json:', error);
    return res.status(500).json({ error: 'Ошибка чтения clientData.json' });
  }
});

// POST /saveClientData
app.post('/saveClientData', (req, res) => {
  try {
    const clientData = req.body; // Ожидается структура { clients: [...] } или массив
    fs.writeFileSync(clientDataPath, JSON.stringify(clientData, null, 2), 'utf8');
    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('[server.js] -> Ошибка записи clientData.json:', error);
    return res.status(500).json({ error: 'Ошибка записи clientData.json' });
  }
});


// ====== (Новые эндпоинты) accData ======
const accDataPath = path.join(__dirname, 'data', 'AccData', 'accData.json');

/**
 * GET /accData
 * Возвращает структуру вида { accounts: [...] },
 * если файл не найден — возвращаем { accounts: [] }.
 */
app.get('/accData', (req, res) => {
  try {
    if (!fs.existsSync(accDataPath)) {
      return res.json({ accounts: [] });
    }
    const raw = fs.readFileSync(accDataPath, 'utf8');
    const parsed = JSON.parse(raw);
    // Предполагаем, что parsed — объект вида { accounts: [...] }
    if (!parsed.accounts) {
      parsed.accounts = [];
    }
    return res.json(parsed);
  } catch (error) {
    console.error('[server.js] -> Ошибка чтения accData.json:', error);
    return res.status(500).json({ error: 'Ошибка чтения accData.json' });
  }
});

/**
 * (Если понадобится) POST /saveAccData
 * Можно раскомментировать при необходимости
 */
// app.post('/saveAccData', (req, res) => {
//   try {
//     const accData = req.body; // Ожидается { accounts: [...] }
//     fs.writeFileSync(accDataPath, JSON.stringify(accData, null, 2), 'utf8');
//     return res.json({ status: 'ok' });
//   } catch (error) {
//     console.error('[server.js] -> Ошибка записи accData.json:', error);
//     return res.status(500).json({ error: 'Ошибка записи accData.json' });
//   }
// });
app.post('/saveAccData', (req, res) => {
  try {
    fs.mkdirSync(path.dirname(accDataPath), { recursive: true });
    fs.writeFileSync(accDataPath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('[server] accData POST', e);
    res.status(500).json({ error: 'write accData' });
  }
});

const ordersSettingsPath = path.join(__dirname, 'UI', 'src', 'components', 'Orders', 'ExecutedOrders', 'settings', 'ordersSettings.json');

// GET /ordersSettings - возвращает настройки
app.get('/ordersSettings', (req, res) => {
  try {
    if (!fs.existsSync(ordersSettingsPath)) {
      return res.status(404).json({ error: 'Файл настроек не найден' });
    }
    const data = fs.readFileSync(ordersSettingsPath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    return res.send(data);
  } catch (error) {
    console.error('[server.js] -> Ошибка чтения ordersSettings.json:', error);
    return res.status(500).json({ error: 'Ошибка чтения ordersSettings.json' });
  }
});

// POST /saveOrdersSettings - сохраняет обновлённые настройки
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

app.post('/recalculateDebt', (req, res) => {
  try {
    console.log('[recalculateDebt] body =', req.body);
    const { clientId } = req.body;
    // 1. Считываем все заказы
    const ordersRaw = fs.readFileSync(ordersDataPath, 'utf8');
    const ordersObj = JSON.parse(ordersRaw);
    const ordersArr = Array.isArray(ordersObj.orders) ? ordersObj.orders : ordersObj;

    // 2. Фильтруем неоплаченные заказы для клиента
    const unpaid = ordersArr.filter(
      o => o.clientId === clientId && o.paymentStatus === 'notPaid'
    );

    // 3. Считаем долг как сумму руб + комиссий
    const debt = unpaid.reduce(
      (sum, o) => sum + (o.price?.total || 0),
      0
    );

    console.log('[recalculateDebt] unpaid orders =', unpaid.length, 'debt =', debt);
    // 4. Собираем новый объект notPaidOrders
    const newNotPaidOrders = {};
    unpaid.forEach(o => {
      const key = o.orderNumber || o.orderId;
      newNotPaidOrders[key] = {
        sum: o.price?.total || 0,
        date: o.date
      };
    });

    // 5. Считываем клиентов и обновляем только нужного
    const clientsRaw = fs.readFileSync(clientDataPath, 'utf8');
    const parsed = JSON.parse(clientsRaw);
    let clientsArr = Array.isArray(parsed) ? parsed : parsed.clients || [];

    const updatedClients = clientsArr.map(c => {
      if (c.clientId === clientId) {
        return {
          ...c,
          balance: { ...c.balance, debt },
          notPaidOrders: newNotPaidOrders
        };
      }
      return c;
    });

    // 6. Записываем обратно в исходном формате
    const payload = Array.isArray(parsed) ? updatedClients : { clients: updatedClients };
    fs.writeFileSync(clientDataPath, JSON.stringify(payload, null, 2), 'utf8');

    return res.json({ clientId, debt });
  } catch (error) {
    console.error('[server.js] recalculateDebt error:', error);
    return res.status(500).json({ error: 'Ошибка пересчёта долга' });
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
