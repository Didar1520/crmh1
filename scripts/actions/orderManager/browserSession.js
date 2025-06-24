// Управление браузерной сессией + авторизация

const { launchBrowserForAccount } = require('../../browserManager.js');
const { authorize }               = require('../../auth.js');
const bus                         = require('../../core/eventBus');
const logger                      = require('./logger.js');
const { sleep }                   = require('./utils.js');

async function isUserAuthorized(page, expectedEmail) {
  try {
    await page.goto('https://kz.iherb.com', { waitUntil: 'networkidle2', timeout: 60000 });
    const userData = await page.evaluate(async () => {
      try {
        const r = await fetch('https://catalog.app.iherb.com/catalog/currentUser', {
          method: 'GET', credentials: 'include'
        });
        return r.ok ? r.json() : null;
      } catch (_) { return null; }
    });
    if (!userData || !userData.email) return false;
    return userData.email.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  } catch (err) {
    logger.error(`[isUserAuthorized] -> ${err.message}`);
    return false;
  }
}

async function forceLogoffIfGhost(page) {
  try {
    const ghost = await page.evaluate(() => !!document.querySelector('.username-my-account-container'));
    if (ghost) {
      logger.warn('[auth] → Призрачный логин. Делаем logoff…');
      await page.goto('https://checkout12.iherb.com/account/logoff', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await sleep(1500);
    }
  } catch (_) {}
}

async function ensureAuth(page, email, stepFn) {
  const ok = await isUserAuthorized(page, email);
  if (!ok) {
    await forceLogoffIfGhost(page);
    logger.info('[ensureAuth] → Требуется повторная авторизация…');
    const authOk = await authorize(page, { login: email, password: '' }, null);
    if (!authOk) throw new Error('re-login failed');
    logger.ok('[ensureAuth] → Авторизация восстановлена.');
  }
  return stepFn();
}

/**
 * Открывает новый браузер, если сменился аккаунт, иначе переиспользует текущий.
 */
async function openOrReuseBrowser(session, nextAccount) {
  if (nextAccount === session.accountEmail.toLowerCase()) return session;

  if (session.browser) {
    logger.info(`[browser] → Смена аккаунта (${session.accountEmail} -> ${nextAccount}), закрываем текущий браузер…`);
    await session.browser.close().catch(() => {});
  }

  logger.info(`[browser] → Открываем браузер для ${nextAccount}`);
  const { browser, page } = await launchBrowserForAccount({ accountEmail: nextAccount });
  return { browser, page, accountEmail: nextAccount };
}

module.exports = { openOrReuseBrowser, ensureAuth };