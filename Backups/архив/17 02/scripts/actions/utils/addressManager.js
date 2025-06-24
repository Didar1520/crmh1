// scripts/actions/utils/addressManager.js
/**
 * Address Manager Utility
 * 
 * Этот модуль проверяет, сколько раз использовался адрес, указанный в ordersConfig.js 
 * (поле defaultAdress, либо если его нет, то deliveryAddress) за последние changeAddressFrequencyByDay дней.
 * Если количество использований превышает changeAddressFrequency, то выбирается новый адрес из файла adressList.JSON,
 * и ordersConfig.js обновляется с новым значением.
 * 
 * Параметры:
 *  - ordersConfig.js должен содержать:
 *      • defaultAdress (или deliveryAddress) – текущий адрес по умолчанию.
 *      • changeAddressFrequency – порог использования адреса (например, 2).
 *      • changeAddressFrequencyByDay – период в днях для проверки (например, 30).
 * 
 *  - Файл ordersData.json (по пути: C:\Users\Didar1520\Docks\CRM\data\OrdersData\ordersData.json) должен содержать объект вида:
 *      {
 *        "orders": [
 *          { ... заказ ... },
 *          ...
 *        ]
 *      }
 * 
 *  - Файл adressList.JSON (по пути: C:\Users\Didar1520\Docks\CRM\data\adressBook\adressList.JSON) должен содержать массив объектов с полем FullName.
 * 
 * Тестирование:
 * Для тестирования, запустите в терминале команду:
 *     node scripts/actions/utils/addressManager.js
 * Модуль выведет в консоль текущий адрес по умолчанию, количество его использований за указанный период,
 * а если порог превышен – выберет новый адрес из adressList.JSON, обновит ordersConfig.js и выведет информацию об изменениях.
 */

const fs = require('fs');
const path = require('path');

// Путь к ordersConfig.js (находится в папке scripts/actions)
const ordersConfigPath = path.join(__dirname, '..', 'ordersConfig.js');
let ordersConfig;
try {
  ordersConfig = require(ordersConfigPath);
} catch (error) {
  console.error('Ошибка при загрузке ordersConfig.js:', error);
  process.exit(1);
}

// Определяем текущий адрес по умолчанию: пытаемся получить поле defaultAdress, если его нет – deliveryAddress
let currentAddress = ordersConfig.defaultAdress || ordersConfig.deliveryAddress;
if (!currentAddress) {
  console.error('Не найдено поле defaultAdress или deliveryAddress в ordersConfig.js');
  process.exit(1);
}

// Получаем параметры проверки из ordersConfig.js с дефолтными значениями, если они не заданы
const changeFrequency = ordersConfig.changeAddressFrequency || 2;
const changeFrequencyDays = ordersConfig.changeAddressFrequencyByDay || 30;

// Путь к ordersData.json (находится в data/OrdersData)
// Исправленный путь: переходим из scripts/actions/utils к корню проекта (на 3 уровня вверх)
const ordersDataPath = path.join(__dirname, '..', '..', '..', 'data', 'OrdersData', 'ordersData.json');
// Путь к adressList.JSON (находится в data/adressBook)
const adressListPath = path.join(__dirname, '..', '..', '..', 'data', 'adressBook', 'adressList.JSON');

function getOrdersData() {
  try {
    const data = fs.readFileSync(ordersDataPath, 'utf8');
    const parsed = JSON.parse(data);
    // Если файл содержит объект с массивом orders, возвращаем его, иначе пытаемся вернуть сам parsed
    if (parsed && Array.isArray(parsed.orders)) {
      return parsed.orders;
    } else if (Array.isArray(parsed)) {
      return parsed;
    } else {
      console.error('Структура ordersData.json не соответствует ожидаемой.');
      return [];
    }
  } catch (error) {
    console.error('Ошибка при чтении ordersData.json:', error);
    return [];
  }
}

function getAdressList() {
  try {
    const data = fs.readFileSync(adressListPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Ошибка при чтении adressList.JSON:', error);
    return [];
  }
}

/**
 * Функция обновляет файл ordersConfig.js с новым значением адреса.
 * Ищется поле "defaultAdress" (или, если его нет, "deliveryAddress") и заменяется его значение.
 */
function updateOrdersConfig(newAddress) {
  try {
    const configFilePath = ordersConfigPath;
    let fileContent = fs.readFileSync(configFilePath, 'utf8');

    let updated = false;
    // Пытаемся обновить поле defaultAdress
    const defaultAdressRegex = /(defaultAdress\s*:\s*['"`])([^'"`]+)(['"`])/;
    if (defaultAdressRegex.test(fileContent)) {
      fileContent = fileContent.replace(defaultAdressRegex, `$1${newAddress}$3`);
      updated = true;
    } else {
      // Если defaultAdress не найден, пытаемся заменить deliveryAddress
      const deliveryAddressRegex = /(deliveryAddress\s*:\s*['"`])([^'"`]+)(['"`])/;
      if (deliveryAddressRegex.test(fileContent)) {
        fileContent = fileContent.replace(deliveryAddressRegex, `$1${newAddress}$3`);
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(configFilePath, fileContent, 'utf8');
      console.log(`ordersConfig.js успешно обновлен. Новый адрес: "${newAddress}"`);
    } else {
      console.warn('Не удалось найти поле defaultAdress или deliveryAddress для обновления в ordersConfig.js');
    }
  } catch (error) {
    console.error('Ошибка при обновлении ordersConfig.js:', error);
  }
}

function addressManager() {
  console.log('--- Address Manager Запущен ---');
  console.log(`Текущий адрес по умолчанию: "${currentAddress}"`);
  console.log(`Порог использования адреса: ${changeFrequency} раз(а) за последние ${changeFrequencyDays} дней`);

  const ordersData = getOrdersData();
  if (!Array.isArray(ordersData)) {
    console.error('ordersData.json не является массивом.');
    return;
  }

  // Вычисляем дату-порог: текущая дата минус changeFrequencyDays дней
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - changeFrequencyDays * 24 * 60 * 60 * 1000);

  // Подсчитываем, сколько заказов за указанный период использовали текущий адрес
  const usageCount = ordersData.reduce((count, order) => {
    // Предполагается, что в ordersData используется поле "orderDate" или "date"
    const orderDateStr = order.orderDate || order.date;
    if (order.deliveryAddress === currentAddress && orderDateStr) {
      const orderDate = new Date(orderDateStr);
      if (orderDate >= thresholdDate) {
        return count + 1;
      }
    }
    return count;
  }, 0);

  console.log(`Количество заказов с адресом "${currentAddress}" за последние ${changeFrequencyDays} дней: ${usageCount}`);

  if (usageCount > changeFrequency) {
    console.log(`Порог использования превышен. Необходимо сменить адрес.`);
    const adressList = getAdressList();
    if (!Array.isArray(adressList) || adressList.length === 0) {
      console.error('adressList.JSON пуст или не является массивом.');
      return;
    }
    // Формируем список доступных адресов (FullName) исключая текущий
    const availableAddresses = adressList
      .map(addr => addr.FullName)
      .filter(name => name && name !== currentAddress);

    if (availableAddresses.length === 0) {
      console.log('Нет альтернативных адресов для смены.');
      return;
    }

    // Выбираем случайный новый адрес
    const randomIndex = Math.floor(Math.random() * availableAddresses.length);
    const newAddress = availableAddresses[randomIndex];
    console.log(`Выбран новый адрес: "${newAddress}"`);

    // Обновляем ordersConfig.js с новым адресом
    updateOrdersConfig(newAddress);
  } else {
    console.log(`Порог использования не превышен. Адрес остается без изменений.`);
  }
}

// Если модуль запущен напрямую, выполняем addressManager для тестирования
if (require.main === module) {
  addressManager();
}

module.exports = { addressManager };
