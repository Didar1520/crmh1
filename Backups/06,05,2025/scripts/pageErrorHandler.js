// scripts/pageErrorHandler.js

/**
 * ВАЖНО НЕ МЕНЯТЬ/УДАЛЯТЬ СУЩЕСТВУЮЩИЕ РАБОЧИЕ ФРАГМЕНТЫ.
 * Мы лишь добавили фильтры для "requestfailed" и "console" событий,
 * чтобы убрать спам от New Relic, "Failed to load resource", и др.
 */

async function setGlobalPageHandlers(page, ws) {
  // --- 1) Фильтруем неудачные запросы (requestfailed) ---

  page.on('console', (msg) => {
    const type = msg.type(); // warn, error, log...
    const text = msg.text();

    // Фильтруем "warn JSHandle@error"
    if (type === 'warn' && text === 'JSHandle@error') {
      return; // пропускаем, не логируем
    }

    // Иначе логируем как обычно
    console.log('[pageErrorHandler] -> PAGE CONSOLE:', type, text);
  });
  
  page.on('requestfailed', (req) => {
    const url = req.url();
    const failure = req.failure() || {};
    const errorText = failure.errorText || '';

    // Список доменов, которые хотим «скрыть» в логах:
    const ignoredDomains = [
      'js-agent.newrelic.com',
      'logx-experimentation.iherb.com',
      'cdn-cgi/challenge-platform'
    ];

    // Список текстов ошибок, которые тоже игнорируем:
    const ignoredErrorTexts = [
      'net::ERR_ABORTED',
      'net::ERR_NAME_NOT_RESOLVED'
    ];

    // Проверяем, попадает ли в "игнор"
    const isIgnoredDomain = ignoredDomains.some((dom) => url.includes(dom));
    const isIgnoredError = ignoredErrorTexts.some((txt) => errorText.includes(txt));

    if (isIgnoredDomain || isIgnoredError) {
      // Просто return, не выводим
      return;
    }

    // Иначе выводим, как раньше
    console.log('[pageErrorHandler] -> "requestfailed" event:', url, errorText);
    console.log(`Ошибка запроса: ${url} (${errorText})`);
  });

  // --- 2) Перехват ошибок JS на странице (pageerror) ---
  page.on('pageerror', (err) => {
    console.log('[pageErrorHandler] -> "pageerror":', err);
  });

  // --- 3) Фильтруем "шумные" консольные сообщения (console) ---
  page.on('console', (msg) => {
    const text = msg.text() || '';
    const type = msg.type();

    // Список «нежелательных» кусков текста в сообщениях:
    const ignoredConsoleMessages = [
      'New Relic',            // Любое сообщение, содержащее "New Relic"
      'Failed to load resource: net::ERR_NAME_NOT_RESOLVED',
      'Apollo DevTools'       // Если надо скрыть и про "Apollo DevTools"
    ];

    // Если сообщение содержит один из игнорируемых шаблонов — пропускаем лог
    if (ignoredConsoleMessages.some((substr) => text.includes(substr))) {
      return;
    }

    // Иначе выводим, как раньше
    console.log('[pageErrorHandler] -> PAGE CONSOLE:', type, text);


    
  });
}


module.exports = { setGlobalPageHandlers };
