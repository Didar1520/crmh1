/**
 * Address Manager Utility
 * 
 * Этот модуль проверяет, сколько раз использовался адрес, указанный в config.js 
 * (поле defaultAdress, либо если его нет, то deliveryAddress) за последние changeAddressFrequencyByDay дней.
 * Если количество использований превышает changeAddressFrequency, то выбирается новый адрес 
 * из файла adressList.JSON, и config.js обновляется с новым значением.
 * 
 * Параметры:
 *  - config.js должен содержать:
 *      • defaultAdress (или deliveryAddress) – текущий адрес по умолчанию.
 *      • changeAddressFrequency – порог использования адреса (например, 2).
 *      • changeAddressFrequencyByDay – период в днях для проверки (например, 30).
 * 
 *  - Файл ordersData.json (по пути: D:\Didar1520\CRM\data\OrdersData\ordersData.json) 
 *    должен содержать объект вида:
 *      {
 *        "orders": [
 *          { ... заказ ... },
 *          ...
 *        ]
 *      }
 * 
 *  - Файл adressList.JSON (по пути: D:\Didar1520\CRM\data\adressBook\adressList.JSON) 
 *    должен содержать массив объектов с полем FullName.
 * 
 * Тестирование:
 *   node scripts/actions/utils/addressManager.js
 */

const fs = require('fs');
const path = require('path');

// Путь: находимся в "scripts/actions/utils", значит к "config.js" - две директории вверх.
const configPath = path.join(__dirname, '..', '..', 'config.js');
let config;
try {
  config = require(configPath);
} catch (error) {
  console.error('Ошибка при загрузке config.js:', error);
  process.exit(1);
}

// Определяем текущий адрес (defaultAdress или deliveryAddress)
let currentAddress = config.defaultAdress || config.deliveryAddress;
if (!currentAddress) {
  console.error('Не найдено поле defaultAdress или deliveryAddress в config.js');
  process.exit(1);
}

// Параметры проверки из config.js
const changeFrequency = config.changeAddressFrequency || 2;
const changeFrequencyDays = config.changeAddressFrequencyByDay || 30;

// Путь к ordersData.json (3 уровня вверх, затем data/OrdersData)
const ordersDataPath = path.join(__dirname, '..', '..', '..', 'data', 'OrdersData', 'ordersData.json');
// Путь к adressList.JSON (3 уровня вверх, затем data/adressBook)
const adressListPath = path.join(__dirname, '..', '..', '..', 'data', 'adressBook', 'adressList.JSON');

function getOrdersData() {
  try {
    const data = fs.readFileSync(ordersDataPath, 'utf8');
    const parsed = JSON.parse(data);
    // Если "orders": [ ... ], возвращаем parsed.orders
    if (parsed && Array.isArray(parsed.orders)) {
      return parsed.orders;
    } else if (Array.isArray(parsed)) {
      return parsed;
    } else {
      console.error('[addressManager] -> Структура ordersData.json не соответствует ожидаемой.');
      return [];
    }
  } catch (error) {
    console.error('[addressManager] -> Ошибка при чтении ordersData.json:', error);
    return [];
  }
}

function getAdressList() {
  try {
    const data = fs.readFileSync(adressListPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[addressManager] -> Ошибка при чтении adressList.JSON:', error);
    return [];
  }
}

/**
 * Обновляем файл config.js: заменяем значение defaultAdress (или deliveryAddress) 
 * на новый адрес. Логика та же, что была с ordersConfig.js.
 */
function updateConfigAddress(newAddress) {
  try {
    let fileContent = fs.readFileSync(configPath, 'utf8');
    let updated = false;

    // Ищем defaultAdress
    const defaultAdressRegex = /(defaultAdress\s*:\s*['"`])([^'"`]+)(['"`])/;
    if (defaultAdressRegex.test(fileContent)) {
      fileContent = fileContent.replace(defaultAdressRegex, `$1${newAddress}$3`);
      updated = true;
    } else {
      // Если нет defaultAdress, ищем deliveryAddress
      const deliveryAddressRegex = /(deliveryAddress\s*:\s*['"`])([^'"`]+)(['"`])/;
      if (deliveryAddressRegex.test(fileContent)) {
        fileContent = fileContent.replace(deliveryAddressRegex, `$1${newAddress}$3`);
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(configPath, fileContent, 'utf8');
      console.log(`[addressManager] -> config.js успешно обновлён. Новый адрес: "${newAddress}"`);
    } else {
      console.warn('[addressManager] -> Не удалось найти defaultAdress или deliveryAddress для обновления.');
    }
  } catch (error) {
    console.error('[addressManager] -> Ошибка при обновлении config.js:', error);
  }
}

function addressManager() {
  console.log('--- Address Manager Запущен ---');
  console.log(`[addressManager] -> Текущий адрес по умолчанию: "${currentAddress}"`);
  console.log(`[addressManager] -> Порог использования адреса: ${changeFrequency} раз(а) за последние ${changeFrequencyDays} дней`);

  const ordersData = getOrdersData();
  if (!Array.isArray(ordersData)) {
    console.error('[addressManager] -> ordersData.json не является массивом.');
    return;
  }

  // Дата-порог: текущая дата минус X дней
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - changeFrequencyDays * 24 * 60 * 60 * 1000);

  // Считаем, сколько заказов за период использовали currentAddress
  const usageCount = ordersData.reduce((count, order) => {
    const orderDateStr = order.orderDate || order.date;
    if (order.deliveryAddress === currentAddress && orderDateStr) {
      const orderDate = new Date(orderDateStr);
      if (orderDate >= thresholdDate) {
        return count + 1;
      }
    }
    return count;
  }, 0);

  console.log(`[addressManager] -> Кол-во заказов с адресом "${currentAddress}" за последние ${changeFrequencyDays} дней: ${usageCount}`);

  // Если usageCount превышает порог => меняем адрес
  if (usageCount > changeFrequency) {
    console.log('[addressManager] -> Порог использования превышен, меняем адрес.');
    const adressList = getAdressList();
    if (!Array.isArray(adressList) || adressList.length === 0) {
      console.error('[addressManager] -> adressList.JSON пуст или не массив.');
      return;
    }
    const availableAddresses = adressList
      .map(addr => addr.FullName)
      .filter(name => name && name !== currentAddress);

    if (availableAddresses.length === 0) {
      console.log('[addressManager] -> Нет альтернативных адресов для смены.');
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableAddresses.length);
    const newAddress = availableAddresses[randomIndex];
    console.log(`[addressManager] -> Новый адрес: "${newAddress}"`);

    // Обновляем config.js
    updateConfigAddress(newAddress);
  } else {
    console.log('[addressManager] -> Порог использования не превышен. Адрес без изменений.');
  }
}

// Если запускаем напрямую (node addressManager.js)
if (require.main === module) {
  addressManager();
}

module.exports = { addressManager };
