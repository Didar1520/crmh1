// D:\Didar1520\CRM\scripts\actions\cartPage\sd.js

const fs = require('fs');
const path = require('path');

// Загружаем конфигурацию из config.js (убедитесь, что путь правильный)
const configPath = path.join(__dirname, '..', '..', 'config.js');
const config = require(configPath);
console.log('[testAdressLog] -> Содержимое config:', config);

// Загружаем адресную книгу из data/adressBook/adressList.json
const adressListPath = path.join(__dirname, '..', '..', '..', 'data', 'adressBook', 'adressList.json');
let adressList;
try {
  const data = fs.readFileSync(adressListPath, 'utf8');
  adressList = JSON.parse(data);
} catch (err) {
  console.error('[testAdressLog] -> Ошибка при чтении адресной книги:', err);
  process.exit(1);
}
console.log(`[testAdressLog] -> Всего адресов: ${Array.isArray(adressList) ? adressList.length : 'не массив'}`);

let index = Number(config.defaultAdress);
if (isNaN(index) || index < 0 || index >= adressList.length) {
  console.warn(`[testAdressLog] -> Некорректный индекс адреса в config.js: ${config.defaultAdress}. Используем индекс 0.`);
  index = 0;
}

const addressData = adressList[index];
if (!addressData) {
  console.error('[testAdressLog] -> addressData is undefined. Проверьте адресную книгу.');
  process.exit(1);
}

console.log(`[testAdressLog] -> Адрес с индексом ${index}:`);
console.log(addressData);

process.exit(0);
