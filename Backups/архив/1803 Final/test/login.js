const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const configuration = {
  chromiumPath: 'C:\\Users\\Didar1520\\AppData\\Local\\Chromium\\Application\\chrome.exe'
};

const USER_LOGIN = 'Tobirama777ikz@@proton.me';
const USER_PASSWORD = 'somePassword';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: configuration.chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // Попробуем нестандартный размер окна
      '--window-size=600,700',
      '--incognito'
      // Можно поиграться с другими аргументами
    ]
  });
  const page = await browser.newPage();

  // Меняем userAgent на что-то странное
  await page.setUserAgent('Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');

  // Ставим язык явно противоречивый: например, ru-RU, а IP у нас из другой страны
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru-RU',
    'Accept-Encoding': 'gzip, deflate, br'
  });

  await page.setViewport({ width: 600, height: 700 });
  await page.setDefaultNavigationTimeout(60_000);

  // Идём на главную iHerb
  await page.goto('https://kz.iherb.com');
  await sleep(3000);

  // Делаем странные переходы, имитируем «нервное» поведение
  // 1) Переход на страницу корзины
  await page.goto('https://checkout12.iherb.com/cart');
  await sleep(1000);

  // 2) Возвращаемся на главную
  await page.goto('https://kz.iherb.com');
  await sleep(1500);

  // 3) Снова корзина
  await page.goto('https://checkout12.iherb.com/cart');
  await sleep(1000);

  // 4) Теперь Login
  await page.goto('https://kz.iherb.com/account/login/');
  await sleep(2000);

  // Вводим логин
  await page.type('#username-input', USER_LOGIN, { delay: 100 });
  // Жмём Continue
  await page.click('#auth-continue-button');
  await sleep(1000);

  // Вводим неправильный пароль специально, чтобы вызвать подозрения
  await page.type('#password-input', 'WrongPassword123', { delay: 50 });
  await page.click('#auth-sign-in-button');
  await sleep(3000);

  // Повторно — правильный
  await page.click('#password-input', { clickCount: 3 });
  await page.keyboard.press('Backspace'); // чистим поле
  await page.type('#password-input', USER_PASSWORD, { delay: 100 });
  await page.click('#auth-sign-in-button');

  // Теперь ждём...
  // Если Press & Hold появится, решаем её вручную
  // Браузер остаётся открытым
})();
