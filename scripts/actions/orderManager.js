/**
 * orderManager.js ─ точка входа
 * --------------------------------------------------------
 * Дополнено: подробные отчёты по шагам, вывод строк для клиента,
 * устранены «крякозябры» (цветной вывод отключается под Windows).
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

async function processAllOrders() {
  state.reset();
  logger.info('[orderManager] -> Начинаем обрабатывать inputConfig.json');

  const inputOrders = loadInputConfig();
  if (inputOrders.length === 0) {
    logger.warn('[orderManager] -> inputConfig.json пуст, выходим');
    return { status: false, message: 'inputConfig.json is empty' };
  }
  state.totalOrders = inputOrders.length;

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

    /** тип шага: корзина / sync-only  */
    const stepType = isEmpty(finalParams.cartLink) ? 'синхронизация' : 'корзина';

    // Если нет аккаунта и шаг только для captureOrders,
    // то запускаем sync-флаги без браузера/авторизации
    const onlyCapture =
      stepType === 'синхронизация' &&
      Object.keys(rawItem).length === 1 &&
      rawItem.captureOrders;

    if (!nextAccount && onlyCapture) {
      try {
        await runSyncFlags(rawItem, null);
        const adminLine = `Шаг N${i + 1} тип {${stepType}} успешно!`;
        logger.ok(adminLine);
        state.stepLines.push(adminLine);
        bus.emit('step', { idx: i, status: 'done' });
      } catch (err) {
        state.errorCnt++;
        const errLine = `Шаг N${i + 1} тип {${stepType}} – ошибка! [${err.message}]`;
        state.stepLines.push(errLine);
        logger.error(errLine);
        bus.emit('error', { idx: i, message: err.message });
      }
      continue;
    }

    session = await openOrReuseBrowser(session, nextAccount);

    try {
      let cartResult = { success: true };
      if (stepType === 'корзина') {
        logger.info(`[orderManager] -> handleCart() для шага #${i + 1}`);
        cartResult = await ensureAuth(session.page, nextAccount, () =>
          handleCart(session.page, finalParams)
        );
      }

      // обработка результата корзины только если stepType === 'корзина'
    if (stepType === 'корзина') {
      handleCartOutcome(i, cartResult, finalParams, nextAccount);
    }


     const syncResult = await ensureAuth(session.page, nextAccount, () =>
  runSyncFlags(rawItem, session.page)
);
// запись даты последней успешной синхронизации в accData.json
if (syncResult.reviewsDone || syncResult.rewardsDone) {
  const { getAccData, saveAccData } = require('../dataManager');
  try {
    const accData = await getAccData();
    const idx = accData.accounts.findIndex(
      a => a.email.toLowerCase() === nextAccount.toLowerCase()
    );
    if (idx !== -1) {
      const user = accData.accounts[idx];
      const nowIso = new Date().toISOString();
      if (syncResult.reviewsDone)  user.lastSyncReviewsDate  = nowIso;
      if (syncResult.rewardsDone)  user.lastSyncRewardsDate  = nowIso;
      await saveAccData(accData);
      logger.info('[orderManager] -> Даты синхронизаций обновлены в accData.json');
    }
  } catch (e) {
    logger.warn('[orderManager] -> Не удалось сохранить даты синхронизаций: ' + e.message);
  }
}


      // строка для админ‑отчёта (успешно)
      const adminLine = `Шаг N${i + 1} тип {${stepType}} успешно!` +
                        (stepType === 'корзина' ?
                          ` [сумма ${cartResult.record.price.usd} USD, клиент: ${cartResult.record.client}, номер заказа ${cartResult.record.orderNumber}, аккаунт: ${nextAccount}]`
                          : '');
      logger.ok(adminLine);
      state.stepLines.push(adminLine);

      bus.emit('step', { idx: i, status: 'done' });

    } catch (err) {
      state.errorCnt++;
      const errLine = `Шаг N${i + 1} тип {${stepType}} – ошибка! [${err.message}]`;
      state.stepLines.push(errLine);
      logger.error(errLine);
      bus.emit('error', { idx: i, message: err.message });
    }
  }

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
  return {
    account:        !isEmpty(item.Account)        ? item.Account        : config.account,
    promoCode:      !isEmpty(item.Promocode)      ? item.Promocode      : config.promoCode,
    referralCode:   !isEmpty(item.referalLink)    ? item.referalLink    : config.referralCode,
    cartLink:       !isEmpty(item.CartLink)       ? item.CartLink       : config.cartUrl,
    client:         !isEmpty(item.client)         ? item.client         : config.client,
    orderID:        !isEmpty(item.orderID)        ? item.orderID        : null,
  };
}

function handleCartOutcome(idx, res, params, accountEmail) {
  const fs   = require('fs');
  const shotDir = 'D:\\Didar1520\\CRM\\logs\\screens';
  if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });

  if (!res || !res.success) {
    state.errorCnt++;

    const stamp    = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19);
    const shotPath = path.join(shotDir, `fail_step${idx + 1}_${stamp}.png`);

    try { res.page && res.page.screenshot && res.page.screenshot({ path: shotPath, fullPage: true }); } catch (_) {}

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

  const promo = params.promoCode || params.promo || '—';
  const clientLine = `корзина N${idx + 1} [${params.cartLink}] ${rec.orderNumber} [${promo}] ${rec.client || '—'}`;
  logger.ok(clientLine);           // строка для клиента сразу после шага
  state.clientLines.push(clientLine);

  const cl = rec.client || '—';
  state.clientOrders[cl] ??= [];
  state.clientOrders[cl].push(rec.orderNumber);

  state.processedOrders.push({
    idx:        idx + 1,
    client:     cl,
    orderNumber: rec.orderNumber,
    status:     res.type,
    cartLink:   params.cartLink,
    promo,
    priceUsd:   rec.price.usd,
    account:    accountEmail,
  });
}

module.exports = { processAllOrders };

if (require.main === module) {
  processAllOrders().catch(err => {
    logger.error(err.message);
    process.exit(1);
  });
}