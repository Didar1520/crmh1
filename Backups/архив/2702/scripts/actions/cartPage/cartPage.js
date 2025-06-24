// scripts/actions/cartPage/cartPage.js
/**
 * cartPage.js (DOM-метод очистки корзины с проверкой "Выбрать все" + остановкой при ошибке)
 * -----------------------------------------------------------------------------
 * Шаги:
 * 1) Переходим на страницу корзины (CART_URL).
 * 2) Если количество товаров (CART_QTY_SELECTOR) > 0:
 *    - Нажимаем кнопку "Изменить" (EDIT_BUTTON_SELECTOR).
 *    - Делаем небольшую паузу (например, 2 секунды), чтобы UI перерисовался.
 *    - Нажимаем галочку "Выбрать все" (SELECT_ALL_CHECKBOX_SELECTOR) через page.evaluate().
 *    - Если галочка не установилась, выбрасываем ошибку.
 *    - Нажимаем кнопку "Удалить" (DELETE_BUTTON_SELECTOR).
 *    - Ждём до 30 секунд, пока количество товаров не станет 0.
 *      Если не получается – просим администратора очистить корзину вручную, ждём ещё 30 сек,
 *      и если всё равно не пусто – кидаем ошибку.
 * 3) Если указан cartLink, переходим по нему и нажимаем кнопку "Добавить в корзину"
 *    (ADD_TO_CART_BUTTON_SELECTOR).
 */
const { closeTutorialIfPresent } = require('./cartTutorial');
const { applyCoupon } = require('./applyCoupon.js');


const CART_URL = 'https://checkout12.iherb.com/cart';
const CART_QTY_SELECTOR = '#cart-qty';
const EDIT_BUTTON_SELECTOR = 'button[data-qa-element="cart-batch-action-edit"]';
const SELECT_ALL_CHECKBOX_SELECTOR = 'input[data-qa-element="cart-select-all"]';
const DELETE_BUTTON_SELECTOR = 'button[data-qa-element="cart-batch-action-delete"]';
const ADD_TO_CART_BUTTON_SELECTOR = 'button[name="AddToCart"]';

async function handleCart(page, finalParams) {
  console.log('[cartPage] -> Начало handleCart() (DOM-метод)');

  // 1) Переходим на страницу корзины
  console.log(`[cartPage] -> Переходим на страницу корзины: ${CART_URL}`);
  await page.goto(CART_URL, { waitUntil: 'networkidle2' });

  await closeTutorialIfPresent(page);
  // Функция получения количества товаров в корзине по селектору CART_QTY_SELECTOR
  async function getCartQty() {
    try {
      const text = await page.$eval(CART_QTY_SELECTOR, el => el.textContent.trim());
      return parseInt(text, 10) || 0;
    } catch {
      return 0; // Если нет элемента, считаем 0
    }
  }

  let cartQty = await getCartQty();
  console.log(`[cartPage] -> Текущий cart-qty=${cartQty}`);

  // 2) Если корзина не пуста, удаляем товары
  if (cartQty > 0) {
    console.log('[cartPage] -> Корзина не пуста, пытаемся удалить товары через DOM...');

    // (a) Нажимаем "Изменить"
    try {
      await page.waitForSelector(EDIT_BUTTON_SELECTOR, { visible: true, timeout: 5000 });
      await page.click(EDIT_BUTTON_SELECTOR);
      console.log('[cartPage] -> Нажали "Изменить".');
    } catch (errEdit) {
      console.log('[cartPage] -> Не нашли кнопку "Изменить":', errEdit);
      throw new Error('Не нашли кнопку "Изменить". Прерываем.');
    }

    // Делаем небольшую паузу, чтобы React-интерфейс перерисовал панель "Выбрать все"/"Удалить"
    await new Promise(resolve => setTimeout(resolve, 2000));


    // (b) Ставим галочку "Выбрать все" через прямой вызов в контексте страницы.
    try {
      const checkboxClicked = await page.evaluate((SELECT_ALL_CHECKBOX_SELECTOR) => {
        const checkbox = document.querySelector(SELECT_ALL_CHECKBOX_SELECTOR);
        if (checkbox) {
          checkbox.click();
          return checkbox.checked; 
        }
        return false;
      }, SELECT_ALL_CHECKBOX_SELECTOR);

      if (!checkboxClicked) {
        console.log('[cartPage] -> Элемент "cart-select-all" не найден или галочка не установилась!');
        throw new Error('Не смогли поставить "Выбрать все". Прерываем.');
      }
      console.log('[cartPage] -> Поставили галочку "Выбрать все".');
    } catch (errSelectAll) {
      console.log('[cartPage] -> Ошибка при установке галочки "Выбрать все":', errSelectAll);
      throw new Error('Не смогли поставить "Выбрать все". Прерываем.');
    }

    // (c) Нажимаем "Удалить"
    try {
      // Увеличиваем таймаут до 10 секунд, так как кнопка может появиться с задержкой
      await page.waitForSelector(DELETE_BUTTON_SELECTOR, { visible: true, timeout: 10000 });
      await page.click(DELETE_BUTTON_SELECTOR);
      console.log('[cartPage] -> Нажали "Удалить".');

      // (d) Ждём, пока корзина станет пустой (до 30 секунд)
      await page.waitForFunction(
        (selector) => {
          const el = document.querySelector(selector);
          if (!el) return true; // если нет элемента, считаем 0
          return el.textContent.trim() === '0';
        },
        { timeout: 30000 },
        CART_QTY_SELECTOR
      );
      console.log('[cartPage] -> Похоже, товары исчезли (cart-qty=0).');
    } catch (errDelete) {
      console.log('[cartPage] -> Ошибка при нажатии "Удалить" или ожидании пустой корзины:', errDelete);
      console.log('[cartPage] -> Просим администратора очистить корзину вручную, ждём 30 сек...');
      await page.waitForTimeout(30000);

      const cartQtyAfterManual = await getCartQty();
      console.log(`[cartPage] -> После ручной очистки (30s), cart-qty=${cartQtyAfterManual}`);
      if (cartQtyAfterManual > 0) {
        throw new Error(`Корзина всё ещё не пуста (cart-qty=${cartQtyAfterManual}), прерываем.`);
      } else {
        console.log('[cartPage] -> Похоже, администратор успешно очистил корзину вручную.');
      }
    }
  } else {
    console.log('[cartPage] -> Корзина уже пуста, очистка не требуется.');
  }

  // 3) Если указан cartLink, переходим по нему и нажимаем "Добавить в корзину"
  const cartLink = finalParams.cartLink;
  if (!cartLink) {
    console.log('[cartPage] -> Нет cartLink => пропускаем добавление товаров.');
    return;
  }

  console.log(`[cartPage] -> Открываем cartLink: ${cartLink}`);
  await page.goto(cartLink, { waitUntil: 'networkidle2' });

  // (4) Нажимаем "Добавить в корзину"
  try {
    await page.waitForSelector(ADD_TO_CART_BUTTON_SELECTOR, { visible: true, timeout: 10000 });
    await page.click(ADD_TO_CART_BUTTON_SELECTOR);
    console.log('[cartPage] -> Нажали "Добавить в корзину".');
  } catch (errAdd) {
    console.log('[cartPage] -> Не удалось нажать "Добавить в корзину":', errAdd);


  }
  if (finalParams.promoCode || finalParams.referralCode) {
    console.log('[cartPage] -> Будем применять купоны/рефкод...');
    await applyCoupon(page, {
      promoCode: finalParams.promoCode,
      referralCode: finalParams.referralCode
    });
  } else {
    console.log('[cartPage] -> Нет promoCode/referralCode в finalParams, пропускаем applyCoupon.');
  }

  console.log('[cartPage] -> handleCart() завершён (DOM-метод).');
}







module.exports = { handleCart };
