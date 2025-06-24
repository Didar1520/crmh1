// test.js
// ---------------------------------------------
// Запуск: node test.js
// ---------------------------------------------
const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    // Запуск браузера
    browser = await puppeteer.launch({
      headless: false, // можно поменять на false, чтобы видеть, что происходит
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Создаём новую страницу
    const page = await browser.newPage();

    // Устанавливаем заголовок Referer (имитация перехода с dashboard)
    await page.setExtraHTTPHeaders({
      referer: 'https://checkout12.iherb.com/users/dashboard'
    });

    // Переходим на страницу адресной книги
    await page.goto('https://checkout12.iherb.com/users/address-book', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Пример: показываем текущий URL в консоли
    console.log('Текущий URL:', page.url());

    // Обычная пауза на 3 секунды через setTimeout (Node.js)
    await new Promise(resolve => setTimeout(resolve, 3000));

  } catch (err) {
    console.error('Ошибка:', err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
