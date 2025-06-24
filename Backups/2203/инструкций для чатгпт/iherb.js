const puppeteer = require('puppeteer-extra');
const axios = require('axios');
const sleep = require('util').promisify(setTimeout);
const ws = require('ws');
const fs = require('fs');
const path = require('path');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

/*
 * Общая конфигурация работы скрипта
 */

var configuration = {
  logs: true, // Логировать действия скрипта
  paymentLimit: 200, // Лимит стоимости заказа, с учетом промокода
  applicationPort: 9999, // Порт на котором работает локальный сервер для обработки запросов к IHerb
  chromiumPath: 'C:\\Users\\Didar1520\\AppData\\Local\\Chromium\\Application\\chrome.exe'
};

/*
 * Селекторы IHerb для нужных действий
 */

var selectors = {

  baseCountrySettingsSelector: '[data-url*="/countryselected"]',
  countryCodeSelector: 'div[class*="select-country"] > label > input',
  currencySelector: 'div[class*="select-currency"] > label > input',
  languageSelector: 'div[class*="select-language"] > label > input',
  saveBaseSettingsButtonSelector: 'button[class*="save-selection"]',
  loginInputSelector: '[id="username-input"]',
  loginButton: '[id="auth-continue-button"]',
  passwordInput: '[id="password-input"]',
  authButton: '[id="auth-sign-in-button"]',
  buttonGotoLogin: '[data-ga-navigation-path="/account/login/"]',
  clearShoppingCartBtn: '[data-qa-element="btn-remove-all"]',
  confirmClearnShoppingCartBtn: '[data-qa-element="btn-remove-all-yes"]',
  gotoOrderCheckout: 'button[name="AddToCart"]', // Оформить гостевую корзину и перейти в свою корзину
  couponInput: '[id="coupon-input"]', // поле купона, означает успешный переход на страницу корзины оформления
  appyCouponBtn: '[id="coupon-apply"]',
  deliveryMethod: '[data-ga-event-label="{{method}}"]', // Метод доставки заказа
  gotoConfirmOrderButton: '[data-qa-element="btn-to-checkout"]', // Кнопка перехода к оформлению заказа
  alertCurrencyDifference: '[id="continue-ccl-button"]', // Кнопка подтверждения валюты USD
  changeDeliveryPersonButton: '[id="collapse-label"]', // Кнопка изменения получателя заказа
  addNewAddressDelivery: 'label[id="add-a-new-shipping-address-radio"]', // Кнопка добавления нового адреса доставки,
  recepientNameDelivery: '[id="firstName"]', // ФИО нового адреса доставки
  addressLineInput: '[id="addressLine1"]', // Строка адреса нового адреса доставки
  cityLineInput: '[id="city"]', // Строка города нового адреса доставки
  regionLineInput: '[id="regionName"]', // Строка региона нового адреса доставки
  postalCodeInput: '[id="postalCode"]', // Строка ZIP кода нового адреса доставки
  phoneNummerInput: '[id="phoneNumber"]', // Строка номера телефона нового адреса доставки
  saveNewAddress: '[id="address-save-and-continue-button"]', // Кнопка нового адреса
  placeOrderButton: '[id="place-order-button"]', // Кнопка создания нового заказа
};

const wss = new ws.Server({ port: configuration.applicationPort });

wss.on('connection', (ws) => {

  console.log('Подключен новый клиент WebSocket');
  
  ws.on('message', async (message) => {
    let clientResponse = {};

    try {

      const data = JSON.parse(message);
    
      if (data.action === 'syncAccount') {

        console.log('Запрос на синхронизацию аккаунта:', data.params);

        const browser = await puppeteer.launch({
            headless: false,
            executablePath: configuration.chromiumPath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ],
            userDataDir: '/var/nodejs/' + data.params.login
        });

        clientResponse = await syncAccount(browser, data.params, ws);

      } else if(data.action === 'makeOrder') {

        console.log('Запрос на выполнение заказа:', data.params);

        const browser = await puppeteer.launch({
            headless: false,
            executablePath: configuration.chromiumPath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ],
            userDataDir: '/var/nodejs/' + data.params.login
        });

        clientResponse = await makeOrder(browser, data.params, ws);

      }else{

        clientResponse = { status: false, message: 'Неверный запрос' };

      }

    } catch (err) {
      clientResponse = { status: false, message: 'Ошибка обработки запроса' };
      console.error('Сбой выполнения заказа:', err);
    }

    ws.send(JSON.stringify(clientResponse));
  });

  ws.on('close', () => {
    console.log('Клиент WebSocket отключился');
  });
});

async function changeRegionAndCurrencySettings(page){

  await page.click(selectors.baseCountrySettingsSelector);

  await page.waitForSelector(selectors.currencySelector, {visible: true});

  await page.focus(selectors.currencySelector);
  await page.type(selectors.currencySelector, 'USD');
  await page.focus(selectors.currencySelector);
  await page.keyboard.press('Enter');

  await page.click(selectors.saveBaseSettingsButtonSelector);

  return true;

}

async function listenToEvents(page){

  try {

    page.waitForSelector('#truste-consent-button', {visible: true, timeout: 0}).then(async (element) => {
      console.log('Обнаружен элемент принятия куков, кликаем');
      await element.click();
    }).catch((err) => {
      // слушатель был выключен вместе с браузером
    });;

  }catch(err){

    console.log('Ошибка слушателя базовых event, возможно браузер был закрыт, детализация: ', err);

  }

}

async function humanMouseMovements(page, duration = 2000) {
    const { width, height } = await page.viewport();

    const startX = Math.floor(Math.random() * width);
    const startY = Math.floor(Math.random() * height);

    await page.mouse.move(startX, startY);

    const startTime = Date.now();
    while (Date.now() - startTime < duration) {
        const randomX = startX + (Math.random() - 0.5) * 200;
        const randomY = startY + (Math.random() - 0.5) * 200;
        
        const steps = Math.floor(Math.random() * 8) + 5;
        await page.mouse.move(Math.max(0, Math.min(width, randomX)), Math.max(0, Math.min(height, randomY)), { steps });
        await sleep(Math.random() * 100 + 50);
    }
}

async function solvePressAndHoldCaptcha(page) {
    let attemptCount = 0;
    
    while (attemptCount < 15) {
        attemptCount += 1;
        console.log(`Попытка ${attemptCount}: Была обнаружена капча Press & HOLD`);

        const rect = await page.evaluate(() => {
            const captchaElement = document.querySelector('#px-captcha');
            if (!captchaElement) return null;
            const { x, y, width, height } = captchaElement.getBoundingClientRect();
            return { x, y, width, height };
        });

        if (!rect) {
            console.log('Элемент #px-captcha не найден, возможно, капча пройдена.');
            return true;
        }

        await humanMouseMovements(page, 2000);

        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;

        const offsetXStart = (Math.random() * 4 - 2) / 100 * rect.width;
        const offsetYStart = (Math.random() * 2 - 1) / 100 * rect.height;

        const offsetXEnd = (Math.random() * 4 - 2) / 100 * rect.width;
        const offsetYEnd = (Math.random() * 2 - 1) / 100 * rect.height;

        const startX = centerX + offsetXStart;
        const startY = centerY + offsetYStart;

        const endX = centerX + offsetXEnd;
        const endY = centerY + offsetYEnd;

        console.log(`Наведение мыши на координаты: (${startX.toFixed(2)}, ${startY.toFixed(2)})`);

        await page.mouse.move(startX, startY, { steps: 10 });
        await page.mouse.down();
        
        const holdTime = Math.random() * 4000 + 9000;
        await sleep(holdTime);

        await page.mouse.up();

        console.log('Удержание мыши завершено');

        await sleep(3000);
        
        const captchaStillPresent = await page.evaluate(() => !!document.querySelector('#px-captcha'));
        
        if (!captchaStillPresent) {
            console.log('Капча успешно пройдена');
            return true;
        }

        console.log('Капча всё ещё присутствует, повторяем нажатие...');
    }

    console.log('Не удалось пройти капчу после нескольких попыток');
    return false;
}

async function clickWhenVisible(page, selector, interval = 2000) {
    const checkAndClick = async () => {
        try {
            
            const isVisible = await page.evaluate(selector => {
                const element = document.querySelector(selector);
                return element && element.offsetParent !== null;
            }, selector);

            if (isVisible) {
                console.log(`Элемент "${selector}" найден и видим. Выполняем клик...`);
                await page.click(selector);
                return true;
            }
        } catch (error) {
            console.error(`Ошибка при проверке/клике элемента: ${error}`);
        }
        return false;
    };

    let clicked = false;
    while (!clicked) {
        clicked = await checkAndClick();
        if (!clicked) {
            await sleep(interval);
        }
    }
}

async function syncAccount(browser, params, ws){

  try {

        var stateOfRewards = null;
        var stateOfCards = null;
        var stateOfAddresses = null;

        const page = await browser.newPage();

        listenToEvents(page);

        await page.setExtraHTTPHeaders({
          'Accept-Language': 'uk,ru-RU;q=0.8,ru;q=0.6,en-US;q=0.4,en;q=0.2',
          'Accept-Encoding': 'gzip, deflate, br, zstd'
        });

        await page.setUserAgent(params.userAgent);
        
        await page.setViewport({
            width: params.screenWidth,
            height: params.screenHeigth,
        });

        await page.setDefaultNavigationTimeout(0);

        await page.setRequestInterception(true);

        page.on('request', async request => {

          const url = request.url();

          if (url.includes('api/address/pagination?')) {
              
              const modifiedUrl = url.replace('pageSize=12', 'pageSize=25');
              console.log(`Перехвачен список адресов текущего пользователя: ${modifiedUrl}`);
              request.continue({ url: modifiedUrl });

          }else{

            request.continue();

          }

        });

        page.on('response', async response => {

            const url = response.url();

            if(url.includes('/user/rewards')){

              var contentResponse = await response.text();
              var jsonContentResponse = JSON.parse(contentResponse);

              console.log(jsonContentResponse);

              stateOfRewards = {
                availableRewards: {
                  count: jsonContentResponse.availableRewards.value,
                  amount: jsonContentResponse.availableRewards.formatted
                },
                pendingRewards: {
                  count: jsonContentResponse.pendingRewards.value,
                  amount: jsonContentResponse.pendingRewards.formatted
                }
              };

            }

            if(url.includes('api/address/pagination?')){

              var contentResponse = await response.text();
              var jsonContentResponse = JSON.parse(contentResponse);

              stateOfAddresses = jsonContentResponse.results.map(item => {
                  return {
                      address_id: item.addressId,
                      countryName: item.countryName,
                      isDefault: item.isDefault,
                      addressLine1: item.addressLine1,
                      city: item.city,
                      fullName: item.fullName,
                      phoneNumber: item.phoneNumber,
                      postalCode: item.postalCode,
                      regionName: item.regionName,
                      raw_address: `${item.fullName} - ${item.city} - ${item.regionName} - ${item.postalCode} - ${item.countryName} - ${item.phoneNumber}`
                  };
              });

            }

            if(url.includes('api/creditcards/V3/Creditcards?')){

              var contentResponse = await response.text();
              var jsonContentResponse = JSON.parse(contentResponse);

              stateOfCards = jsonContentResponse.creditCards.map(card => ({
                isDefault: card.isDefault,
                cardholder: card.cardHolderName,
                last4digits: card.cardDigits,
                cardId: card.creditCardId,
                expM: card.expirationMonth,
                expY: card.expirationYear,
                state: card.accountState
              }));

            }

        });

        await logActions('Открываем главную страницу...', ws, 'in-progress');

        await page.goto('https://kz.iherb.com', {referer: 'https://google.com'});

        /* TODO: Добавить аргумент и проверку статуса авторизации для верификации аккаунта */

        await page.waitForSelector(selectors.buttonGotoLogin, {visible: true, timeout: 10000});

        await humanMouseMovements(page, 2000);

        await page.click(selectors.buttonGotoLogin);

        try {

          await page.waitForSelector('#px-captcha', {timeout: 10000});

          await logActions('Была обнаружена капча, решаем...', ws, 'in-progress');

          await humanMouseMovements(page, 2000);

          await humanMouseMovements(page, 1500);

          await solvePressAndHoldCaptcha(page);

        }catch(err){

          console.log('Не удалось или отсутствует капча', err);

        }

        await page.waitForSelector(selectors.loginInputSelector, {visible: true, timeout: 100000});

        await logActions('Капча решена, вводим логин и пароль...', ws, 'in-progress');

        await page.type(selectors.loginInputSelector, params.login, {delay: 100});

        await clickWhenVisible(page, selectors.loginButton);

        await page.waitForSelector(selectors.passwordInput, {visible: true, timeout: 1000000});

        await page.type(selectors.passwordInput, params.password, {delay: 100});

        await humanMouseMovements(page, 2000);

        await page.click(selectors.authButton);

        await waitForStateChange(() => stateOfRewards !== null);

        await logActions('Получено состояние наград, продолжаем парсинг...', ws, 'in-progress');

        await page.goto('https://checkout12.iherb.com/users/address-book');

        await waitForStateChange(() => stateOfAddresses !== null);

        await logActions('Получен список адресов, продолжаем парсинг...', ws, 'in-progress');

        await page.goto('https://checkout12.iherb.com/users/payment-methods');

        await waitForStateChange(() => stateOfCards !== null);

        await logActions('Получено состояние карт, возвращаем ответ...', ws, 'in-progress');

        var accountData = {
            status: 'accountData',
            message: {
              rewards: stateOfRewards,
              cards: stateOfCards,
              addresses: stateOfAddresses
            }
        };

        await browser.close();

        return accountData;

  }catch(err){

    console.log('Ошибка в процессе получения истории заказов: ', err);

  }

}

async function makeOrder(browser, params, ws){

  try {

        var stateOfOrder = null;
        var productList = null;

        const page = await browser.newPage();

        listenToEvents(page);

        await page.setExtraHTTPHeaders({
          'Accept-Language': 'uk,ru-RU;q=0.8,ru;q=0.6,en-US;q=0.4,en;q=0.2',
          'Accept-Encoding': 'gzip, deflate, br, zstd'
        });

        await page.setUserAgent(params.userAgent);
        
        await page.setViewport({
            width: params.screenWidth,
            height: params.screenHeigth,
        });

        await page.setDefaultNavigationTimeout(0);

        await page.setRequestInterception(true);

        page.on('request', async request => {

          const url = request.url();

          /* TODO: Перехват запроса с данными товара для получения списка ID и формирования списка */

          request.continue();

        });

        page.on('response', async response => {

            const url = response.url();

            if(url.includes('api/checkout/order')){

              var contentResponse = await response.text();
              var jsonContentResponse = JSON.parse(contentResponse);

              if(jsonContentResponse.paymentStatus){

                console.log(jsonContentResponse);

                stateOfOrder = {
                  status: 'success',
                  orderInfo: jsonContentResponse,
                  products: productList
                };

              }

            }

        });

        await logActions('Выполняем очистку корзины...', ws, 'in-progress');

        await page.goto('https://checkout12.iherb.com/cart');

        try {

          await page.waitForSelector(selectors.clearShoppingCartBtn, {visible: true, timeout: 5000});

          await changeRegionAndCurrencySettings(page);

          await sleep(4000);

          await page.click(selectors.clearShoppingCartBtn);
          await sleep(500);
          await page.click(selectors.confirmClearnShoppingCartBtn);

          await sleep(5000);

        }catch(err){

          console.log('Очистка корзины не нужна, она пуста');

          await changeRegionAndCurrencySettings(page);

          await sleep(1000);

        }

        await page.goto(params.checkout_url);

        await logActions('Переходим на страницу корзины клиента и копируем ее...', ws, 'in-progress');

        await page.click(selectors.gotoOrderCheckout);

        await page.waitForSelector(selectors.clearShoppingCartBtn, {visible: true});

        productList = await page.evaluate(() => {

            function getProductList() {
                const wrapper = document.querySelector('[data-qa-element="cart-product-list-wrapper"]');
                if (!wrapper) {
                    console.error('Обертка с data-qa-element="cart-product-list-wrapper" не найдена.');
                    return {};
                }

                const lineItems = wrapper.querySelectorAll('[data-qa-element="line-item"]');
                const result = {};

                lineItems.forEach((lineItem, index) => {
                    const linkElement = lineItem.querySelector('a[data-qa-element="product-item-title"]');
                    if (linkElement) {
                        result[index] = {
                            link: linkElement.href,
                            title: linkElement.getAttribute('aria-label')
                        };
                    }
                });

                return result;
            }

            return getProductList();
        });

        if(params.coupon){

          await logActions('Вы указали купон, используем его...', ws, 'in-progress');

          await page.waitForSelector(selectors.couponInput, {visible: true});

          await page.type(selectors.couponInput, params.coupon);

          await page.click(selectors.appyCouponBtn);

        }

        await page.click(selectors.gotoConfirmOrderButton);

        try {

          await page.waitForSelector('#px-captcha', {timeout: 10000});

          await logActions('Была обнаружена капча, решаем...', ws, 'in-progress');

          await humanMouseMovements(page, 2000);

          await humanMouseMovements(page, 1500);

          await solvePressAndHoldCaptcha(page);

        }catch(err){

          console.log('Не удалось или отсутствует капча', err);

        }

        await sleep(5000);

        await logActions('Подтверждаем валюту USDT...', ws, 'in-progress');

        await page.waitForSelector(selectors.alertCurrencyDifference, {visible: true});

        await page.click(selectors.alertCurrencyDifference);

        if(params.delivery_type == 'newAddress'){

          await logActions('Вы указали новый адрес доставки, указываем его...', ws, 'in-progress');

          await page.click(selectors.changeDeliveryPersonButton);

          await sleep(1000);

          await page.click(selectors.addNewAddressDelivery);

          await sleep(1000);

          await page.type(selectors.recepientNameDelivery, params.payloadAddress.recepientName);
          await page.type(selectors.addressLineInput, params.payloadAddress.addressLine);
          await page.type(selectors.cityLineInput, params.payloadAddress.city);
          await page.type(selectors.regionLineInput, params.payloadAddress.regionName);
          await page.type(selectors.postalCodeInput, params.payloadAddress.postalCode);
          await page.type(selectors.phoneNummerInput, params.payloadAddress.phoneNumber);

          await page.click(selectors.saveNewAddress);

          await sleep(3000);

          await page.waitForSelector(selectors.alertCurrencyDifference, {visible: true});

          await page.click(selectors.alertCurrencyDifference);

          await page.waitForSelector('[id="encryptedCardNumber"]', {visible: true});

          await page.type('[id="encryptedCardNumber"]', params.cardNumber);

          await page.click('[id="credit-card-continue-button"]');

          await sleep(1000);

          await page.evaluate(() => document.querySelectorAll('[id="collapse-label"]')[2].click());

          await page.waitForSelector('[id="identificationNumber"]', {visible: true});

          await page.type('[id="identificationNumber"]', params.payloadAddress.inn);
          await page.type('[id="firstName"]', params.payloadAddress.recepientName);
          await page.type('[id="midName"]', params.payloadAddress.midname);
          await page.type('[id="mobileNumber"]', params.payloadAddress.phoneNumber);

          await page.evaluate(() => document.querySelector('[for="address-set-as-default-checkbox"]').click());

          await sleep(1000);

          await page.evaluate(() => document.querySelectorAll('[data-is-continue-btn="true"]')[2].click());

          await sleep(3000);

        }else{

          await page.click(selectors.changeDeliveryPersonButton);

          await sleep(1000);

          await page.click('#address-radio-' + params.address_index);

          await sleep(1000);

          await page.click('#address-continue-' + params.address_index);

          await sleep(1000);

        }


        await logActions('Создаем заказ...', ws, 'in-progress');

        await page.click(selectors.placeOrderButton);

        await waitForStateChange(() => stateOfOrder !== null);

        await logActions('Заказ сформирован, возврат ответа...', ws, 'in-progress');

        await browser.close();

        return stateOfOrder;



  } catch (err){

    console.log(err);

  }

}

function waitForStateChange(conditionFn, interval = 2000, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkInterval = setInterval(() => {
            if (conditionFn()) {
                clearInterval(checkInterval);
                resolve();
            } else if (Date.now() - startTime >= timeout) {
                clearInterval(checkInterval);
                reject(new Error('Timeout: условие не было выполнено за 30 секунд'));
            }
        }, interval);
    });
}

async function logActions(message, ws, status){

  if(configuration.logs == true){

    console.log(message);
    ws.send(JSON.stringify({ status: status, message: message}));

  }else{

    ws.send(JSON.stringify({ status: status, message: message}));

  }

  return true;

}