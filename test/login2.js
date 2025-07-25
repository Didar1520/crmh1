// testAuthCaptcha-standalone.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const { browserConfig } = require('./scripts/browserConfig'); // берём готовые настройки
puppeteer.use(StealthPlugin());

/* ───────────────────── helper ───────────────────── */
function ensureProfileDir(email, baseDir) {
  const dir = path.join(baseDir, email);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
/* ─────────────────────────────────────────────────── */

(async () => {
  const profileDir = ensureProfileDir('testProfile', browserConfig.userDataBaseDir);

  const browser = await puppeteer.launch({
    headless: browserConfig.headless,
    executablePath: browserConfig.chromiumPath,
    userDataDir: profileDir,
    ignoreDefaultArgs: ['--enable-automation'],
    ignoreHTTPSErrors: true,
    args: browserConfig.launchArgs
  });

  const page = await browser.newPage();

  // UA + заголовки из конфигурации
  await page.setUserAgent(browserConfig.userAgent);
  await page.setExtraHTTPHeaders(browserConfig.extraHTTPHeaders);

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setDefaultNavigationTimeout(browserConfig.timeouts.pageWaitTime);

  await page.goto('https://kz.iherb.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // …дальнейшие действия / проверки…

  // browser.close();  // оставляем открытым для ручного просмотра
})();
