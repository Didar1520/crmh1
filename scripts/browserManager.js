const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const browserConf = require('./browserConfig');

puppeteer.use(StealthPlugin());

async function launchBrowserForAccount(options = {}) {
  try {
    const {
      accountEmail = 'defaultUser',
      userAgent,
      width = 1920,
      height = 1080
    } = options;

    // Создаем безопасное имя папки
    const safeProfileName = accountEmail.replace(/[@.]/g, '_');
    const userDataDirPath = path.join(browserConf.browserConfig.userDataBaseDir, safeProfileName);

    // Создаем папку профиля если не существует
    if (!fs.existsSync(userDataDirPath)) {
      fs.mkdirSync(userDataDirPath, { recursive: true });
      console.log(`[browserManager] -> Создана папка профиля: ${userDataDirPath}`);
    }

    // Запускаем браузер
    const browser = await puppeteer.launch({
      headless: browserConf.browserConfig.headless,
      executablePath: browserConf.browserConfig.chromiumPath,
      userDataDir: userDataDirPath,
      args: browserConf.browserConfig.launchArgs
    });

    const page = await browser.newPage();
    
    // Настройка страницы
    await page.setViewport({ width, height });
    await page.setUserAgent(browserConf.browserConfig.userAgent);
    
    if (browserConf.browserConfig.extraHTTPHeaders) {
      await page.setExtraHTTPHeaders(browserConf.browserConfig.extraHTTPHeaders);
    }

    // Анти-детект
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log('[browserManager] -> Браузер успешно запущен');
    return { browser, page };

  } catch (error) {
    console.error('[browserManager] -> Ошибка при запуске браузера:', error);
    throw error;
  }
}

module.exports = { launchBrowserForAccount };