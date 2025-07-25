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
     */
    userDataBaseDir: 'C:\\Users\\Didar1520\\Docks\\CRM\\userData',

    /**
     * Устанавливаем реальный User-Agent, соответствующий текущей версии Chrome.
     * Это важно, так как пустой User-Agent может вызывать подозрения у сайта.
     * Если версия Chrome обновится, замените на актуальный User-Agent.
     */
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',

    /**
     * HTTP-заголовки расширены для большей правдоподобности.
     * Добавлены стандартные заголовки, которые отправляет реальный Chrome.
     * Accept-Language оставлен как в оригинале, но добавлены другие заголовки.
     */
    extraHTTPHeaders: {
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,kk;q=0.6',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Upgrade-Insecure-Requests': '1'
    },

    timeouts: {
      cookieWaitTime: 3000,
      pageWaitTime: 60000,
      captchaWaitTime: 10000,
      defaultWaitTime: 60000
    },

    /**
     * Обновлённый набор флагов запуска для имитации стандартного Chrome.
     * Добавлены флаги для скрытия признаков автоматизации и улучшения совместимости.
     */
    launchArgs: [
      '--window-size=1920,1080',
      '--lang=ru-RU,ru,en-US,en,kk',
      '--force-device-scale-factor=1', // Устанавливаем масштабирование 1 для стандартного поведения
      '--disable-blink-features=AutomationControlled', // Скрываем флаг автоматизации
      '--no-sandbox', // Отключаем песочницу для стабильности
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Уменьшаем использование разделяемой памяти
      '--disable-infobars', // Отключаем уведомления Chrome
      '--disable-extensions', // Отключаем расширения для минимизации отличий
      '--start-maximized', // Запускаем в полноэкранном режиме
      '--enable-features=NetworkService,NetworkServiceInProcess', // Включаем сетевые сервисы
      '--disable-features=TranslateUI,Translate' // Отключаем подсказки перевода
    ]
  }
};

const inputConfigPath = path.join(__dirname, '../../inputConfig.json');
exports.inputConfigPath = inputConfigPath;
    