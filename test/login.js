const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const configuration = {
  chromiumPath: 'C:\\Users\\Didar1520\\AppData\\Local\\Chromium\\Application\\chrome.exe'
};


(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: configuration.chromiumPath,
    args: [
      '--no-sandbox',

      // Можно поиграться с другими аргументами
    ]
  });
  const page = await browser.newPage();

  // Меняем userAgent на что-то странное
  await page.setUserAgent('Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');

  // Ставим язык явно противоречивый: например, ru-RU, а IP у нас из другой страны
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru-RU',
  });

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setDefaultNavigationTimeout(60_000);

  // Идём на главную iHerb
  await page.goto('https://kz.iherb.com');
  await sleep(3000);





  // Браузер остаётся открытым
})();
