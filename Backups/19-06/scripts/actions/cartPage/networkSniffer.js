'use strict';

const fs   = require('fs');
const path = require('path');
const { removeItemsIfNeeded } = require('./removeItems.js');

/**
 * sniffAndRemoveCart(page [, options])
 * ------------------------------------
 * ▸ перехватывает все cart-/checkout-запросы, пишет их в *.log;
 * ▸ вызывает removeItemsIfNeeded(page) до полной очистки корзины;
 * ▸ возвращает путь к лог-файлу.
 *
 * Пример подключения в testRunner:
 *   const { sniffAndRemoveCart } = require('./sniffAndRemoveCart.js');
 *   await sniffAndRemoveCart(page);   // перед твоими кликами ничего делать не надо
 */
async function sniffAndRemoveCart(page, opts = {}) {
  const {
    outDir     = __dirname,          // куда писать лог
    filePrefix = 'cart_sniff_',
    verbose    = true,
    match      = [
      /\/api\/Carts\/v\d+\/lineitems\/products/i,
      /\/api\/Carts\/v\d+\/cart/i,
      /\/api\/Checkout\/v\d+\/cart/i,
      /\/cart/i
    ],
    maxBody    = 4096                // макс. символов в responseBody
  } = opts;

  const logPath = path.join(outDir, `${filePrefix}${Date.now()}.log`);
  fs.writeFileSync(logPath, '', 'utf8');            // создаём пустой файл

  /* ───── перехват сетевых ответов ───── */
  page.on('response', async (response) => {
    try {
      const req = response.request();
      const url = req.url();
      if (!match.some(rx => rx.test(url))) return;  // фильтр

      const entry = {
        time: new Date().toISOString(),
        url,
        method: req.method(),
        requestHeaders: req.headers(),
        requestBody: req.postData() || null,
        status: response.status(),
        responseHeaders: response.headers()
      };

      try {
        const body = await response.text();
        entry.responseBody = body.length > maxBody
          ? `${body.slice(0, maxBody)} …(${body.length} bytes)`
          : body;
      } catch {
        entry.responseBody = '[unreadable]';
      }

      fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
      if (verbose) console.log(`[sniffer] ${req.method()} ${url} → ${response.status()}`);
    } catch (_) {}
  });

  if (verbose) console.log(`[sniffer] logging to: ${logPath}`);

  /* ───── очищаем корзину ───── */
  await removeItemsIfNeeded(page);

  return logPath;
}

module.exports = { sniffAndRemoveCart };
