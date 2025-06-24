// test.js
// ---------------------------------------------
// Этот модуль НЕ запускает браузер.
// Предполагается, что браузер и страница уже инициализированы снаружи.
// ---------------------------------------------

async function openWithReferer(page) {
    // Устанавливаем заголовок referer
    await page.setExtraHTTPHeaders({
      referer: 'https://www.google.kz/?hl=ru'
    });
  
    // Переходим на страницу address-book
    await page.goto('https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
  
    // Проверяем, на какой странице оказались
    console.log('Текущий URL:', page.url());
  
    // Небольшая пауза
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Экспортируем функцию, чтобы использовать её в других файлах.
  module.exports = {
    openWithReferer
  };
  