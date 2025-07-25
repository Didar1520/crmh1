const path = require('path');

module.exports = {
  logs: false,
  applicationPort: 9999,

  browserConfig: {
    chromiumPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    userDataBaseDir: path.join(__dirname, 'user_profiles'),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.141 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document'
    },
    timeouts: {
      cookieWaitTime: 3000,
      pageWaitTime: 60000,
      captchaWaitTime: 10000,
      defaultWaitTime: 60000
    },
    launchArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--lang=ru-RU,ru,en-US,en,kk',
      '--start-maximized',
      '--force-device-scale-factor=1'
    ]
  }
};