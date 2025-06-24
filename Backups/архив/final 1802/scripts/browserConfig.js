// scripts/browserConfig.js
/**
 * ВАЖНО! НЕ МЕНЯТЬ СУЩЕСТВУЮЩИЕ ПОЛЯ БЕЗ ЯВНОГО РАЗРЕШЕНИЯ!
 * ----------------------------------------------------------------
 * Здесь храним настройки:
 *  - Путь к браузеру (chromiumPath)
 *  - Нужно ли headless
 *  - userDataBaseDir (папка для userDataDir)
 *  - launchArgs
 *  - userAgent, extraHTTPHeaders
 *  - Таймауты (cookieWaitTime, captchaWaitTime, pageWaitTime)
 */

const path = require('path');

module.exports = {
  logs: true,
  applicationPort: 9999,

  browserConfig: {
    chromiumPath: 'C:\\Users\\Didar1520\\AppData\\Local\\Chromium\\Application\\chrome.exe',
    headless: false,

    /**
     * КЛЮЧЕВОЕ ПОЛЕ:
     * Здесь указываем, где будут храниться профили userDataDir.
     *   'C:\\Users\\Didar1520\\Docks\\CRM\\userData'
     */
    userDataBaseDir: 'C:\\Users\\Didar1520\\Docks\\CRM\\userData',

    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
               'AppleWebKit/537.36 (KHTML, like Gecko) ' +
               'Chrome/114.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'uk,ru-RU;q=0.8,ru;q=0.6,en-US;q=0.4,en;q=0.2',
      'Accept-Encoding': 'gzip, deflate, br, zstd'
    },

    timeouts: {
      cookieWaitTime: 3000,
      pageWaitTime: 60000,
      captchaWaitTime: 10000,
      defaultWaitTime: 60000
    },

    /**
     * Прочие флаги (если нужно)
     */
    launchArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--force-device-scale-factor=1'
    ]
  },

  accountForLogin: {
    email: 'almaty_222kz@proton.me',
    pass: 'Kasleken_Iherb02'
  },

  syncData: {
    rewards: false,
    cards: false,
    addresses: false,

    // Вместо false делаем объект:
    // - Если нужно искать конкретный заказ => searchOrderNumber
    // - Если нужно брать последние X заказов => limit
    // Если не нужно никакой логики => можно вернуть false
    orders: false,
    //{
      // Пример: ищем конкретный заказ:
      // searchOrderNumber: '532761927',
      
      // Или: берем последние 5 заказов:
      //limit: 5
    //.},

    refCode: false,
    orderedProducts: false,
    reviews: false
  },

  actionsEnabled: {
    syncAccount: false,
    placeOrder: true
  }
  
};
