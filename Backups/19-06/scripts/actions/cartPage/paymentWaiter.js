/* paymentWaiter.js  ─ ожидание подтверждения оплаты (Enter = +60 c,  Esc = отмена) */

const readline = require('readline');

function waitForPayment(page, { baseTimeoutMs = 120_000, prolongMs = 60_000 } = {}) {
  return new Promise((resolve) => {
    let timer;

    /* ——— служебные функции ——— */
    const resetTimer = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(() => finish('timeout'), ms);
    };

    const finish = (result) => {
      clearTimeout(timer);
      try { process.stdin.setRawMode(false); } catch (_) { /* игнор */ }
      process.stdin.removeListener('data', onKey);
      rl.close();
      page.removeListener('response', onResp);
      resolve(result);
    };

    /* ——— клавиши ——— */
    const onKey = (chunk) => {
      const key = chunk.toString();
      if (key === '\u001b') {             // Esc
        console.log('[paymentWaiter] -> Ожидание отменено.');
        finish('cancel');
      } else if (key === '\r' || key === '\n') {   // Enter
        console.log('[paymentWaiter] -> +60 секунд.');
        resetTimer(prolongMs);
      }
    };

    /* ——— ловим order-API (успешная оплата) ——— */
    const onResp = (resp) => {
      try {
        if (resp.url().includes('/api/checkout/order?OrderNumber=') && resp.ok()) {
          console.log('[paymentWaiter] -> Получен финальный order-API.');
          finish('completed');
        }
      } catch (_) { /* игнор */ }
    };

    /* ——— инициализация ——— */
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.on('data', onKey);
    page.on('response', onResp);

    console.log('[paymentWaiter] -> Ожидание оплаты. Enter = продлить, Esc = отмена.');
    resetTimer(baseTimeoutMs);
  });
}

module.exports = { waitForPayment };
