// scripts/dataManager.js

const fs = require('fs').promises;
const path = require('path');

// Папка с файлами JSON
const dataDir = path.join(__dirname, '..', 'data');

// Полные пути к нужным JSON-файлам
const accDataPath = path.join(dataDir, 'AccData', 'accData.json');
const accGoodsDataPath = path.join(dataDir, 'AccData', 'accGoodsData.json');
const clientDataPath = path.join(dataDir, 'ClientData', 'clientData.json');
const ordersDataPath = path.join(dataDir, 'OrdersData', 'ordersData.json');

// ─────────────────────────────────────────────────────────────────────────────
// Утилиты для чтения/записи JSON (общие, чтобы не дублировать код).
// ─────────────────────────────────────────────────────────────────────────────
async function readJsonFile(filePath) {
  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (err) {
    // Если файла ещё нет или чтение не удалось — можно вернуть что-нибудь
    // или пробросить ошибку. Для начала удобно вернуть пустой объект/массив.
    console.log(`readJsonFile: Не удалось прочитать файл ${filePath}`, err);
    return null;
  }
}

async function writeJsonFile(filePath, data) {
  try {
    // Превращаем объект/массив в строку
    const jsonString = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonString, 'utf8');
  } catch (err) {
    console.log(`writeJsonFile: Не удалось записать файл ${filePath}`, err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Методы для AccData (accData.json)
// ─────────────────────────────────────────────────────────────────────────────
async function getAccData() {
  const data = await readJsonFile(accDataPath);
  return data; // data может быть { accounts: [...] }
}

async function saveAccData(newData) {
  // newData, скорее всего, будет иметь структуру { accounts: [...] }
  await writeJsonFile(accDataPath, newData);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Методы для AccGoodsData (accGoodsData.json)
// ─────────────────────────────────────────────────────────────────────────────
async function getAccGoodsData() {
  const data = await readJsonFile(accGoodsDataPath);
  return data;
}

async function saveAccGoodsData(newData) {
  await writeJsonFile(accGoodsDataPath, newData);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Методы для ClientData (clientData.json)
// ─────────────────────────────────────────────────────────────────────────────
async function getClientData() {
  const data = await readJsonFile(clientDataPath);
  return data; // data может быть { clients: [...] }
}

async function saveClientData(newData) {
  await writeJsonFile(clientDataPath, newData);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Методы для OrdersData (ordersData.json)
// ─────────────────────────────────────────────────────────────────────────────
async function getOrdersData() {
  const data = await readJsonFile(ordersDataPath);
  return data; // data может быть { orders: [...] }
}

async function saveOrdersData(newData) {
  await writeJsonFile(ordersDataPath, newData);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Экспортируем наши методы наружу
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  getAccData,
  saveAccData,
  getAccGoodsData,
  saveAccGoodsData,
  getClientData,
  saveClientData,
  getOrdersData,
  saveOrdersData,
};
