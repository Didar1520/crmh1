/**
 * Ждёт, пока страница /ui/transaction не сменится на final-receipt,
 *   либо пока админ не отменит ожидание.
 *  ▸ ENTER  – добавить +60 сек к таймауту
 *  ▸ q      – отмена / бронируем заказ
 *
 * Возвращает { ok: true }   – перешли на инвойс
 *             { ok: false }  – не успели / отменили
 */
const readline = require('readline');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitOnTransaction(page, baseMs = 60_000) {
  let remaining = baseMs;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(
`[transactionWaiter] ▸ Оплата требует подтверждения.
  ENTER  → +60 сек ожидания
  q      → отмена и запись заказа как booked`
  );

  let cancelled = false;
  rl.on('line', (line='') => {
    const cmd = line.trim().toLowerCase();
    if (cmd === '') {
      remaining += 60_000;
      console.log(`[transactionWaiter] +60 сек. Осталось ${remaining / 1000} сек.`);
    } else if (cmd === 'q') {
      cancelled = true;
      rl.close();
    }
  });

  // основной цикл ожидания
  while (remaining > 0 && !cancelled) {
    // если уже на инвойсе — успех
    const urlNow = page.url();
    if (urlNow.includes('/scd/order-receipt')) {
      rl.close();
      return { ok: true };
    }
    // ждём 1 сек
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'load', timeout: 1_000 }).catch(()=>{}),
      sleep(1_000)
    ]);
    remaining -= 1_000;
  }

  rl.close();
  return { ok: false };
}

module.exports = { waitOnTransaction };
