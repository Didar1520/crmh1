// scripts/browserManager.js
/**
 * Модуль для запуска браузера с учётом userDataDir, headless, launchArgs...
 * Берёт настройки из browserConfig.js (в scripts/browserConfig.js).
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');


// РАНЬШЕ: const config = require('../config');
// ТЕПЕРЬ: если browserManager.js лежит в scripts/, а browserConfig.js в scripts/browserConfig.js:
const browserConf = require('./browserConfig');

puppeteer.use(StealthPlugin());

async function launchBrowserForAccount(options = {}) {
  const {
    accountEmail = 'defaultUser',
    userAgent,
    width = 1920,
    height = 1080
  } = options;

  const baseDir = browserConf.browserConfig.userDataBaseDir;
  if (!baseDir) {
    throw new Error('[browserManager] -> Не указан userDataBaseDir в browserConfig');
  }

  const userDataDirPath = path.join(baseDir, accountEmail);
  if (!fs.existsSync(userDataDirPath)) {
    fs.mkdirSync(userDataDirPath, { recursive: true });
    console.log(`[browserManager] -> Создана папка профиля: ${userDataDirPath}`);
  } else {
    console.log(`[browserManager] -> Используем существующий профиль: ${userDataDirPath}`);
  }

  const launchOptions = {
    headless: browserConf.browserConfig.headless,
    executablePath: browserConf.browserConfig.chromiumPath,
    userDataDir: userDataDirPath,
    args: [...(browserConf.browserConfig.launchArgs || [])]
  };
  console.log(`[browserManager] -> Запуск браузера: headless=${launchOptions.headless}`);

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  
// Глобально переопределяем navigator.webdriver для всех страниц
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // Ставим userAgent
  const finalUserAgent = userAgent || browserConf.browserConfig.userAgent;
  await page.setUserAgent(finalUserAgent);
  console.log(`[browserManager] -> User-Agent: ${finalUserAgent}`);

  // Доп. заголовки
  if (browserConf.browserConfig.extraHTTPHeaders) {
    await page.setExtraHTTPHeaders(browserConf.browserConfig.extraHTTPHeaders);
  }

  // Viewport
  await page.setViewport({ width, height });
  console.log(`[browserManager] -> Viewport: ${width}x${height}`);

  // Request interception
  await page.setRequestInterception(true);
  page.on('request', (req) => req.continue());

  // Таймауты
  if (browserConf.browserConfig.timeouts?.pageWaitTime) {
    await page.setDefaultNavigationTimeout(browserConf.browserConfig.timeouts.pageWaitTime);
  }

  return { browser, page };
}

module.exports = { launchBrowserForAccount };
