const express = require('express');
const path = require('path');

const ordersRouter = require('./routes/orders');
const referenceRouter = require('./routes/reference');
const executeActionsRouter = require('./routes/executeActions');

const app = express();

// Разбор JSON в теле запросов
app.use(express.json());

// Отдача статических файлов из папки UI
app.use(express.static(path.join(__dirname, 'UI')));

// Подключение модульных маршрутов
app.use('/', ordersRouter);
app.use('/', referenceRouter);
app.use('/', executeActionsRouter);

// Отдача главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'UI', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[server.js] -> Сервер запущен на порту ${PORT}`);
});
