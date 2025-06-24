// scripts/actions/cartPage/removeItems.js

const CART_QTY_SELECTOR = '#cart-qty';
const EDIT_BUTTON_SELECTOR = '[data-qa-element="cart-batch-action-edit"]';
const SELECT_ALL_CHECKBOX_SELECTOR = 'input[data-qa-element="cart-select-all"]';
const DELETE_BUTTON_SELECTOR = 'button[data-qa-element="cart-batch-action-delete"]';
const { sleep } = require('../utils/pageLoadHelper.js');

/**
 * removeItemsIfNeeded(page)
 * -----------------------------------------------------------------------------
 * 1) Считывает кол-во товаров (cart-qty).
 * 2) Если > 0:
 *    - "Изменить"
 *    - "Выбрать все"
 *    - "Удалить"
 *    - Ждём, пока станет 0
 * 3) Если после ручной очистки тоже > 0 => ошибка.
 */
async function removeItemsIfNeeded(page) {
  // Функция чтения cart-qty
  async function getCartQty() {
    try {
      const text = await page.$eval(CART_QTY_SELECTOR, el => el.textContent.trim());
      return parseInt(text, 10) || 0;
    } catch {
      return 0;
    }
  }

  const cartQty = await getCartQty();
  if (cartQty <= 0) {
    console.log('[removeItems] -> Корзина пуста, удалять нечего.');
    return;
  }

  console.log('[removeItems] -> Корзина не пуста, удаляем товары...');
  // 1) Нажимаем "Изменить"
  try {
    await page.waitForSelector(EDIT_BUTTON_SELECTOR, { visible: true, timeout: 5000 });
    await page.click(EDIT_BUTTON_SELECTOR);
    console.log('[removeItems] -> Нажали "Изменить".');
  } catch (errEdit) {
    throw new Error('[removeItems] -> Не нашли кнопку "Изменить". Прерываем.');
  }

  // Небольшая пауза
  await sleep(2000);

  // 2) Ставим галочку "Выбрать все"
  try {
    const checkboxClicked = await page.evaluate((sel) => {
      const checkbox = document.querySelector(sel);
      if (!checkbox) return false;
      checkbox.click();
      return checkbox.checked;
    }, SELECT_ALL_CHECKBOX_SELECTOR);
    if (!checkboxClicked) {
      throw new Error('[removeItems] -> Не смогли поставить "Выбрать все".');
    }
    console.log('[removeItems] -> Поставили галочку "Выбрать все".');
  } catch (errSelectAll) {
    throw new Error('[removeItems] -> Ошибка при установке "Выбрать все": ' + errSelectAll);
  }

  // 3) "Удалить"
  try {
    await page.waitForSelector(DELETE_BUTTON_SELECTOR, { visible: true, timeout: 10000 });
    await page.click(DELETE_BUTTON_SELECTOR);
    console.log('[removeItems] -> Нажали "Удалить".');

    // Ждём, пока qty=0 (до 30 сек)
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return true; // нет элемента => 0
        return el.textContent.trim() === '0';
      },
      { timeout: 30000 },
      CART_QTY_SELECTOR
    );
    console.log('[removeItems] -> Корзина опустела (cart-qty=0).');
  } catch (errDelete) {
    console.log('[removeItems] -> Ошибка при удалении:', errDelete);
    console.log('[removeItems] -> Пробуем ручную очистку 30 сек...');
    await sleep(30000);

    const qtyAfterManual = await getCartQty();
    if (qtyAfterManual > 0) {
      throw new Error('[removeItems] -> После ручной очистки qty=' + qtyAfterManual + ', корзина не пуста.');
    }
    console.log('[removeItems] -> Корзина очищена вручную.');
  }
}

module.exports = { removeItemsIfNeeded };
