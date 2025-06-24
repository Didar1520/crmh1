// File: D:\Didar1520\CRM\scripts\mainUtils\networkSniffer.js
'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * sniffCart(page [, opts])
 * ------------------------
 *  Логирует все cart-/checkout-запросы.
 *  ▸ выводит краткое сообщение в консоль;
 *  ▸ пишет полные данные в файл *.log рядом с модулем.
 *
 *  Подключение в testRunner:
 *      const { sniffCart } = require('./networkSniffer.js');
 *      sniffCart(page);   // до того, как начнёшь клики
 */
function sniffCart(page, opts = {}) {
  const {
    outDir     = __dirname,
    filePrefix = 'cart_sniff_',
    verbose    = true,
    match      = [
      /\/api\/Carts\/v\d+\/lineitems\/products/i,
      /\/api\/Carts\/v\d+\/cart/i,
      /\/cart/i
    ],
    maxBody    = 2048            // макс. символов в responseBody
  } = opts;

  const filePath = path.join(outDir, `${filePrefix}${Date.now()}.log`);
  fs.writeFileSync(filePath, '', 'utf8');   // создаём / очищаем файл

  page.on('response', async (response) => {
    try {
      const request = response.request();
      const url     = request.url();

      if (!match.some(rx => rx.test(url))) return;   // фильтр

      const entry = {
        time:             new Date().toISOString(),
        url,
        method:           request.method(),
        requestHeaders:   request.headers(),
        requestBody:      request.postData() || null,
        status:           response.status(),
        responseHeaders:  response.headers(),
      };

      try {
        const bodyTxt = await response.text();
        entry.responseBody = bodyTxt.length > maxBody
          ? `${bodyTxt.slice(0, maxBody)} …(${bodyTxt.length} bytes)`
          : bodyTxt;
      } catch {
        entry.responseBody = '[body_unreadable]';
      }

      fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
      if (verbose) console.log(`[sniffer] ${entry.method} ${entry.url} → ${entry.status}`);
    } catch (err) {
      console.log('[sniffer] error:', err);
    }
  });

  console.log(`[sniffer] logging to: ${filePath}`);
}

module.exports = { sniffCart };
