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
  logs: false,
  applicationPort: 9999,

  browserConfig: {
    // Используем стандартный путь к установленному Google Chrome
    chromiumPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,

    /**
     * КЛЮЧЕВОЕ ПОЛЕ:
     * Здесь указываем, где будут храниться профили userDataDir.
     * Пример: 'C:\\Users\\Didar1520\\Docks\\CRM\\userData'
     */
    userDataBaseDir: 'C:\\Users\\Didar1520\\Docks\\CRM\\userData',

    // Для стандартного отпечатка не задаём кастомный User-Agent
    userAgent: '',

    // Не устанавливаем дополнительные HTTP-заголовки
    extraHTTPHeaders: {
      'Accept-Language': 'ru-RU,ru,en-US,en,kk'
    },

    timeouts: {
      cookieWaitTime: 3000,
      pageWaitTime: 60000,
      captchaWaitTime: 10000,
      defaultWaitTime: 60000
    },

    /**
     * Прочие флаги.
     * Оставляем минимальный набор для стандартного запуска браузера.
     */
    launchArgs: [
      // Параметр для задания размера окна; остальные флаги убраны для имитации стандартного запуска.
      '--window-size=1920,1080',
      '--lang=ru-RU,ru,en-US,en,kk'
    ]
  },



  actionsEnabled: {
    syncAccount: false,
    placeOrder: true
  }
};

const inputConfigPath = path.join(__dirname, '../../inputConfig.json');
exports.inputConfigPath = inputConfigPath;
