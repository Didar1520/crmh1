const { launchBrowserForAccount } = require('../../browserManager.js');
const { checkAndSolveCaptchaInPlace } = require('../../captcha.js');
// testRunner.js
// --------------------------------------------------------
// Универсальный тестовый скрипт для локального запуска отдельного модуля.
// Запускается через: node testRunner.js
// Использует browserManager.js для автоматического открытия нужного профиля,
// переходит по указанному URL, при необходимости решает капчу,
// ждёт заданное время для стабилизации страницы, а затем запускает тестируемый модуль.
//
// Чтобы протестировать другой модуль, измените строку импорта тестируемой функции (testedModule),
// а также при необходимости скорректируйте настройки в разделе "Настройки теста".

// ================= Настройки теста =================
const TARGET_URL = 'https://checkout12.iherb.com/cart'; // URL, куда переходим для теста
const CHECK_CAPTCHA = true;        // Если true – будет выполняться проверка/решение капчи
const WAIT_TIME_AFTER_NAVIGATION = 3000; // Задержка (мс) после перехода по URL, для стабилизации страницы
const ACCOUNT_INDEX = 0;           // Индекс профиля из inputConfig.json, который будем использовать

// Измените следующую строку, чтобы протестировать нужный модуль:
// Пример: для проверки номера карты (cardVerification) используйте:
const testedModule = require('../setAdressPage/setAdressPage.js');
// const testedModule = require('./pageTest.js');

// const testedModule = require('./setCartParams.js').setCartParams;

// Если нужно протестировать другой модуль (например, customsInfo), то поменяйте путь и имя экспортированной функции:
// const testedModule = require('./customsInfo.js').fillCustomsInfo;

// ================= Конец настроек =================


let inputOrders = [];
try {
  inputOrders = require('../../inputConfig.json');
  if (!Array.isArray(inputOrders)) inputOrders = [];
} catch (err) {
  console.log('[testRunner] -> Error loading inputConfig.json:', err);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  
  if (inputOrders.length === 0) {
    console.log('[testRunner] -> inputConfig.json is empty. Aborting test.');
    return;
  }
  const accountEmail = inputOrders[ACCOUNT_INDEX].Account || '';
  if (!accountEmail) {
    console.log('[testRunner] -> No Account field in inputConfig.json. Aborting test.');
    return;
  }
  console.log(`[testRunner] -> Using profile: ${accountEmail}`);

  // Запускаем браузер через browserManager.js (профиль открывается автоматически)
  const { browser, page } = await launchBrowserForAccount({ accountEmail });
  
  try {
    console.log(`[testRunner] -> Navigating to: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

    if (CHECK_CAPTCHA) {
      try {
        await checkAndSolveCaptchaInPlace(page, null, 15000);
        console.log('[testRunner] -> Captcha solved.');
      } catch (err) {
        console.log('[testRunner] -> Captcha error, proceeding anyway:', err);
      }
    } else {
      console.log('[testRunner] -> Skipping captcha check as per configuration.');
    }
    
    console.log(`[testRunner] -> Waiting ${WAIT_TIME_AFTER_NAVIGATION} ms after navigation...`);
    await sleep(WAIT_TIME_AFTER_NAVIGATION);

    console.log('[testRunner] -> Running tested module...');
    await testedModule(page);
    console.log('[testRunner] -> Test completed successfully. Browser left open for manual inspection.');

    // Если нужно закрывать браузер после теста, раскомментируйте следующую строку:
    // await browser.close();
  } catch (err) {
    console.error('[testRunner] -> Error during test execution:', err);
    // При ошибке можно закрыть браузер:
    // await browser.close();
  }
}

if (require.main === module) {
  runTest();
}

module.exports = { runTest };
