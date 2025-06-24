/**
 * orderManager.js ─ точка входа
 * --------------------------------------------------------
 * Переработанная архитектура: логика вынесена в модули внутри
 * подпапки `orderManager/`.
 */

const path                = require('path');
const bus                 = require('../core/eventBus');
const { waitIfPaused, shouldAbort } = require('../core/controlFlags');
const config              = require('../config.js');
const { handleCart }      = require('./cartPage/cartPage.js');

// helpers из подпапки orderManager
const state               = require('./orderManager/state.js');
const logger              = require('./orderManager/logger.js');
const { isEmpty }         = require('./orderManager/utils.js');
const loadInputConfig     = require('./orderManager/loadInputConfig.js');
const {
  openOrReuseBrowser,
  ensureAuth,
}                         = require('./orderManager/browserSession.js');
const runSyncFlags        = require('./orderManager/syncRunner.js');
const makeReport          = require('./orderManager/reporter.js');

/**
 * processAllOrders — главный экспорт
 */
async function processAllOrders() {
  state.reset();
  logger.info('[orderManager] -> Начинаем обрабатывать inputConfig.json');

  const inputOrders = loadInputConfig();
  if (inputOrders.length === 0) {
    logger.warn('[orderManager] -> inputConfig.json пуст, выходим');
    return { status: false, message: 'inputConfig.json is empty' };
  }
  state.totalOrders = inputOrders.length;

  // Объект текущей браузер‑сессии (переиспользуется)
  let session = { browser: null, page: null, accountEmail: '' };

  for (let i = 0; i < inputOrders.length; i++) {
    await waitIfPaused();
    if (shouldAbort) {
      bus.emit('error', { idx: i, message: 'Остановлено пользователем' });
      throw new Error('Aborted by user');
    }

    const rawItem      = inputOrders[i];
    const finalParams  = mergeParams(rawItem);
    const nextAccount  = (finalParams.account || '').toLowerCase();

    // переключаем/открываем браузер под нужный аккаунт
    session = await openOrReuseBrowser(session, nextAccount);

    try {
      // --- CART ---
      let cartResult = { success: true };
      if (!isEmpty(finalParams.cartLink)) {
        logger.info(`[orderManager] -> handleCart() для шага #${i + 1}`);
        cartResult = await ensureAuth(session.page, nextAccount, () =>
          handleCart(session.page, finalParams)
        );
      }

      // анализ результата handleCart
      handleCartOutcome(i, cartResult, finalParams);

      // --- SYNC --- (выполняется всегда, даже если cartLink пуст)
      await ensureAuth(session.page, nextAccount, () =>
        runSyncFlags(rawItem, session.page)
      );

      logger.ok(`[orderManager] -> Элемент #${i + 1} обработан.`);
      bus.emit('step', { idx: i, status: 'done' });
    } catch (err) {
      // глобальная обработка ошибок шага
      state.errorCnt++;
      logger.error(`[orderManager] -> Order #${i + 1} ERROR ▸ ${err.message}`);
      bus.emit('error', { idx: i, message: err.message });
    }
  }

  // отчёт + закрываем браузер
  makeReport(state);
  if (session.browser) {
    logger.info('[orderManager] -> Закрываем браузер.');
    await session.browser.close().catch(() => {});
  }
  logger.ok('[orderManager] -> processAllOrders() завершён.');
  return { status: true, message: 'All orders processed' };
}

// ──────────────────────────────────────────────────────────── helpers

function mergeParams(item) {
  const { isEmpty } = require('./orderManager/utils.js');
  return {
    account:        !isEmpty(item.Account)        ? item.Account        : config.account,
    promoCode:      !isEmpty(item.Promocode)      ? item.Promocode      : config.promoCode,
    referralCode:   !isEmpty(item.referalLink)    ? item.referalLink    : config.referralCode,
    cartLink:       !isEmpty(item.CartLink)       ? item.CartLink       : config.cartUrl,
    client:         !isEmpty(item.client)         ? item.client         : config.client,
    orderID:        !isEmpty(item.orderID)        ? item.orderID        : null,
  };
}

function handleCartOutcome(idx, res, params) {
  const { sleep } = require('./orderManager/utils.js');
  const fs = require('fs');
  const shotDir = 'D:\\Didar1520\\CRM\\logs\\screens';
  if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });

  if (!res || !res.success) {
    state.errorCnt++;

    const stamp    = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const shotPath = path.join(shotDir, `fail_step${idx + 1}_${stamp}.png`);

    try {
      res.page && res.page.screenshot && res.page.screenshot({ path: shotPath, fullPage: true });
    } catch (_) {}

    const why = res?.error || 'unknown';
    state.failedOrders.push({ idx: idx + 1, reason: why, screenshot: shotPath });
    state.processedOrders.push({ idx: idx + 1, client: params.client || '—', orderNumber: 'ошибка', status: 'ошибка' });

    throw new Error(why);
  }

  const rec = res.record;
  if (res.type === 'booked') {
    state.bookedCnt++;
    state.usdBookedSum += rec.price.usd;
  } else {
    state.completedCnt++;
    state.usdCompletedSum += rec.price.usd;
  }

  const cl = rec.client || '—';
  state.clientOrders[cl] ??= [];
  state.clientOrders[cl].push(rec.orderNumber);

  const promo = params.promoCode || params.promo || '—';
  state.processedOrders.push({
    idx:        idx + 1,
    client:     cl,
    orderNumber: rec.orderNumber,
    status:     res.type,
    cartLink:   params.cartLink,
    promo,
  });
}

// ──────────────────────────────────────────────────────────── экспорт / CLI

module.exports = { processAllOrders };

if (require.main === module) {
  processAllOrders().catch(err => {
    logger.error(err.message);
    process.exit(1);
  });
}