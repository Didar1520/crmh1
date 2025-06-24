// scripts/actions/executeOrder.js
/**
 * !!!! НИЧЕГО НЕ ТРОГАТЬ !!!!
 * Скрипт для проверки входных параметров и авторизации.
 * 
 * Этот скрипт:
 *  - Загружает входящие параметры заказа из ordersInputConfig.json.
 *  - Загружает параметры по умолчанию из ordersConfig.js.
 *  - Выполняет приоритет: если параметр указан во входящих данных, он используется, иначе используется значение из ordersConfig.js.
 *  - Если включен модуль accountManager и входной параметр Account пуст, выбирается аккаунт через accountManager.
 *  - Если включен модуль addressManager, вызывается утилита addressManager.
 *  - Если включен модуль reviewManager, вызывается утилита reviewManager.
 *  - Запускается браузер, открывается страница корзины (CartLink) и выполняется авторизация через модуль auth.js.
 */

const puppeteer = require('puppeteer');
const { authorize } = require('../auth');

const inputConfigs = require('./ordersInputConfig.json');  // входные данные (массив объектов)
const ordersConfig = require('./ordersConfig.js');

// Утилиты
const accountManager = require('./utils/accountManager');
const reviewManager = require('./utils/reviewManager');

// Для простоты берем первый заказ из входных параметров
const inputConfig = inputConfigs[0] || {};

// Функция проверки: если значение пустое или "none" (без учета регистра), считается незаданным
function isEmpty(value) {
  return !value || value.toString().trim() === '' || value.toString().trim().toLowerCase() === 'none';
}

// Мержим параметры. Приоритет от inputConfig, затем ordersConfig.
const mergedParams = {
  account: !isEmpty(inputConfig.Account) ? inputConfig.Account : ordersConfig.account,
  promoCode: !isEmpty(inputConfig.Promocode) ? inputConfig.Promocode : ordersConfig.promoCode,
  referralCode: !isEmpty(inputConfig.rederalLink) ? inputConfig.rederalLink : ordersConfig.referralCode,
  cartLink: !isEmpty(inputConfig.CartLink) ? inputConfig.CartLink : ordersConfig.cartUrl,
  client: !isEmpty(inputConfig.ClientName) ? inputConfig.ClientName : ordersConfig.client,
  orderID: inputConfig.orderID || null
};

console.log('--- Итоговые параметры заказа ---');
console.log(mergedParams);

// Если accountManager включен в ordersConfig и входной параметр Account пуст, получить аккаунт из accountManager
if (ordersConfig.accountManager && isEmpty(inputConfig.Account)) {
  const randomAccount = accountManager.getRandomAccount();
  console.log('Модуль accountManager включен. Выбран аккаунт:', randomAccount);
  mergedParams.account = randomAccount;
}

// Если addressManager включен, вызываем его для проверки/смены адреса
if (ordersConfig.addressManager) {
  const { addressManager } = require('./utils/addressManager');
  console.log('Модуль addressManager включен. Запускаем addressManager...');
  addressManager();
}

// Если reviewManager включен, вызываем его
if (ordersConfig.reviewManager) {
  console.log('Модуль reviewManager включен. Запускаем reviewManager...');
  reviewManager.run();
}

// Тестирование: запускаем браузер, открываем страницу корзины и выполняем авторизацию
(async () => {
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    console.log('Открываем страницу корзины:', mergedParams.cartLink);
    await page.goto(mergedParams.cartLink, { waitUntil: 'networkidle2' });

    // Выполнение авторизации через auth.js
    // Если пароль не указан, передаем пустую строку, чтобы auth.js ожидал ручного ввода пароля.
    const authParams = {
      login: mergedParams.account,
      password: '' // Пустая строка означает отсутствие пароля - ожидание ручного ввода
    };

    console.log('Выполняется авторизация для аккаунта:', authParams.login);
    const authSuccess = await authorize(page, authParams, null);
    if (authSuccess) {
      console.log('Авторизация прошла успешно.');
    } else {
      console.log('Ошибка авторизации.');
    }

    // Для тестирования оставляем браузер открытым, либо закрываем по необходимости
    // await browser.close();
  } catch (error) {
    console.error('Ошибка в executeOrder:', error);
  }
})();
