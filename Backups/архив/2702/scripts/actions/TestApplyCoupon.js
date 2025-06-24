// applyCoupon.js
// --------------------------------------------------------
// Пример скрипта, аналогичного testCartParams.js, но для применения
// промокода и реферального кода на странице корзины iHerb.
// Использует launchBrowserForAccount из browserManager.js
// и закрывает туториал, если есть cartTutorial.js

const { launchBrowserForAccount } = require('../browserManager.js');

// Пытаемся подключить cartTutorial.js для закрытия возможного попапа
let closeTutorialIfPresent = null;
try {
  const tut = require('./cartTutorial.js');
  closeTutorialIfPresent = tut.closeTutorialIfPresent;
} catch (err) {
  console.log('[applyCoupon] -> Нет cartTutorial.js, пропускаем закрытие туториала:', err);
}

// Загружаем inputConfig.json => берём первый объект
let inputOrders = [];
try {
  inputOrders = require('../inputConfig.json');
  if (!Array.isArray(inputOrders)) inputOrders = [];
} catch (err) {
  console.log('[applyCoupon] -> Не удалось загрузить inputConfig.json:', err);
  inputOrders = [];
}

// Простая функция для пауз
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== ФУНКЦИЯ applyCoupon (оригинал + Puppeteer) ==========
// ВАЖНО: она рассчитывает, что у нас есть page из Puppeteer
async function applyCoupon(page, { promoCode, referralCode }) {
  console.log('[applyCoupon] -> Начало применения промокода и реф.кода...');

  // Если нет ни промокода, ни реф.кода — выходим
  if (!promoCode && !referralCode) {
    console.log('[applyCoupon] -> Нет promoCode/referralCode, завершаем.');
    return;
  }

  // Селекторы
  const COUPON_INPUT_SELECTOR = 'input#coupon-input';
  const COUPON_APPLY_BTN_SELECTOR = 'button#coupon-apply';

  // Локальная функция ожидания ответа POST /api/Carts/v2/applyCoupon
  async function waitForApplyCouponResponse() {
    console.log('[applyCoupon] -> Ждём ответ POST /api/Carts/v2/applyCoupon...');
    const [response] = await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes('/api/Carts/v2/applyCoupon') &&
        resp.request().method() === 'POST'
      , { timeout: 10000 }),

      // Клик по кнопке "Применить" будет в applyOneCode
    ]);

    const status = response.status();
    console.log(`[applyCoupon] -> /api/Carts/v2/applyCoupon ответ статус=${status}`);

    if (!response.ok()) {
      throw new Error(`[applyCoupon] -> Ответ /applyCoupon не OK, status=${status}`);
    }
    const json = await response.json();
    return json;
  }

  // Универсальная функция применения одного кода (промо/реф)
  async function applyOneCode(codeValue, codeTypeLabel) {
    console.log(`[applyCoupon] -> Применяем ${codeTypeLabel}="${codeValue}"`);

    // Ждём инпут купона
    await page.waitForSelector(COUPON_INPUT_SELECTOR, { visible: true, timeout: 5000 });

    // Очищаем поле (выделяем всё, жмём backspace)
    await page.click(COUPON_INPUT_SELECTOR, { clickCount: 3 });
    await page.keyboard.press('Backspace');

    // Вводим код
    await page.type(COUPON_INPUT_SELECTOR, codeValue, { delay: 50 });

    // Готовимся ловить ответ
    const applyCouponPromise = waitForApplyCouponResponse();

    // Жмём кнопку "Применить"
    await page.waitForSelector(COUPON_APPLY_BTN_SELECTOR, { visible: true, timeout: 3000 });
    await page.click(COUPON_APPLY_BTN_SELECTOR);

    // Ждём JSON
    const jsonData = await applyCouponPromise;
    console.log(`[applyCoupon] -> Ответ JSON для ${codeTypeLabel}:`, jsonData);

    // Проверяем промокод / рефкод в JSON
    if (codeTypeLabel === 'promoCode') {
      const appliedPromo = (jsonData.promoCode || '').toLowerCase();
      if (appliedPromo === codeValue.toLowerCase()) {
        console.log(`[applyCoupon] -> Промокод "${codeValue}" применён успешно!`);
      } else {
        console.log(`[applyCoupon] -> Промокод "${codeValue}" не совпадает в JSON.promoCode="${jsonData.promoCode}"`);
      }
    } else {
      // referralCode
      const appliedRef = (jsonData.referralCode || '').toLowerCase();
      if (appliedRef === codeValue.toLowerCase()) {
        console.log(`[applyCoupon] -> Рефкод "${codeValue}" применён успешно!`);
      } else {
        console.log(`[applyCoupon] -> Рефкод "${codeValue}" не совпадает JSON.referralCode="${jsonData.referralCode}"`);
      }
    }

    // Подождём 2 сек, чтобы сайт пересчитал корзину
    await sleep(2000);
  }

  // 1) Применяем PROMO-код
  if (promoCode) {
    try {
      await applyOneCode(promoCode, 'promoCode');
    } catch (errPromo) {
      console.log('[applyCoupon] -> Ошибка при применении промокода:', errPromo);
    }
  }

  // 2) Применяем REFERRAL-код
  if (referralCode) {
    try {
      await applyOneCode(referralCode, 'referralCode');
    } catch (errRef) {
      console.log('[applyCoupon] -> Ошибка при применении рефкода:', errRef);
    }
  }

  console.log('[applyCoupon] -> Применение купонов завершено.');
}

// ========== Основная функция для запуска ==========
// Аналогично структуре testCartParams.js
async function runApplyCouponTest() {
  console.log('[applyCoupon] -> Запуск тестового сценария: открываем cart, применяем промокоды');

  // 1) Проверяем, есть ли данные в inputConfig.json
  if (inputOrders.length === 0) {
    console.log('[applyCoupon] -> inputConfig.json пуст, прерываем.');
    return;
  }
  const firstObj = inputOrders[0];
  const accountEmail = firstObj.Account || '';
  if (!accountEmail) {
    console.log('[applyCoupon] -> Нет поля Account в первом элементе, прерываем.');
    return;
  }
  console.log(`[applyCoupon] -> Используем профиль: ${accountEmail}`);

  // 2) Запускаем браузер через browserManager
  const { browser, page } = await launchBrowserForAccount({ accountEmail });

  try {
    // 3) Открываем страницу корзины
    const cartUrl = 'https://checkout12.iherb.com/cart';
    console.log(`[applyCoupon] -> Переходим на страницу: ${cartUrl}`);
    await page.goto(cartUrl, { waitUntil: 'networkidle2' });

    // 4) Закрываем туториал, если есть
    if (closeTutorialIfPresent) {
      await closeTutorialIfPresent(page);
    }

    // При желании здесь можно вставить проверки страны, валюты, доставки — см. testCartParams.js
    // ...

    // 5) Применяем купоны
    // По заданию: промокод Gold120, реферальный код DUA9670
    const promoCode = 'Gold120';
    const referralCode = 'DUA9670';
    await applyCoupon(page, { promoCode, referralCode });

    console.log('[applyCoupon] -> Готово! Оставляем браузер открытым для проверки вручную.');

    // Если нужно закрывать браузер после завершения, раскомментируйте:
    // await browser.close();

  } catch (err) {
    console.log('[applyCoupon] -> Общая ошибка при выполнении сценария:', err);
    // Можно закрыть браузер на случай ошибки
    // await browser.close();
  }
}

// Если этот файл запущен напрямую, выполняем runApplyCouponTest()
if (require.main === module) {
  runApplyCouponTest();
}

// Экспортируем для использования из других модулей
module.exports = { runApplyCouponTest, applyCoupon };
