/* File: D:\Didar1520\CRM\scripts\actions\cartPage\removeItems.js */

const CART_QTY_SELECTOR              = '#cart-qty';
const EDIT_BUTTON_SELECTOR           = '[data-qa-element="cart-batch-action-edit"]';
const SELECT_ALL_CHECKBOX_SELECTOR   = 'input[data-qa-element="cart-select-all"]';
const DELETE_BUTTON_SELECTOR         = 'button[data-qa-element="cart-batch-action-delete"]';

// одиночная иконка «корзина»
const ITEM_DELETE_BUTTON_SELECTOR    = '[data-qa-element="btn-item-remove"]';
// поп-ап подтверждения
const MODAL_SELECTOR                 = '[data-qa-element="dk-modal"]';
// кнопка «Удалить» в поп-апе

// индикатор загрузки
const LOADING_SPINNER_SELECTOR       = '[data-qa-element="loading-iherb"]';

const { sleep } = require('../utils/pageLoadHelper.js');

/**
 * removeItemsIfNeeded(page)
 * -----------------------------------------------------------------------------
 * 1) Пробуем массовое удаление (Изменить → Выбрать все → Удалить).
 * 2) Если не получилось, удаляем товары по одному:
 *    • кликаем иконку корзины,
 *    • подтверждаем удаление в поп-апе,
 *    • ждём завершения спиннера.
 */
async function removeItemsIfNeeded(page) {
  /* ───────────────────────── helpers ───────────────────────── */
  async function getCartQty() {
    try {
      const txt = await page.$eval(CART_QTY_SELECTOR, el => el.textContent.trim());
      return parseInt(txt, 10) || 0;
    } catch {
      return 0;
    }
  }

  async function confirmModalDeletion() {
    await page.waitForSelector(MODAL_SELECTOR, { visible: true, timeout: 10000 });
  // ищем кнопку по точному тексту «Удалить» внутри модалки
await page.evaluate(modalSel => {
  const modal = document.querySelector(modalSel);
  if (!modal) throw new Error('Модалка не найдена');

  // ищем <a> или <button> с текстом «Удалить»
  const btn = Array.from(modal.querySelectorAll('a, button'))
    .find(el => el.textContent.trim() === 'Удалить');

  if (!btn) throw new Error('Кнопка «Удалить» не найдена');
  btn.click();
}, MODAL_SELECTOR);

    await page.waitForSelector(LOADING_SPINNER_SELECTOR, { hidden: true, timeout: 30000 }).catch(() => {});
  }

  async function deleteItemsOneByOne() {
    console.log('[removeItems] -> Поштучное удаление…');
    while (await getCartQty() > 0) {
      const btn = await page.$(ITEM_DELETE_BUTTON_SELECTOR);
      if (!btn) throw new Error('[removeItems] -> Нет кнопки удаления, разметка изменилась.');
      await btn.click();
      await confirmModalDeletion();
      await sleep(1000); // короткая пауза перед проверкой количества
    }
    console.log('[removeItems] -> Корзина очищена поштучно.');
  }

  /* ───────────────────────── main flow ───────────────────────── */
  if (await getCartQty() === 0) {
    console.log('[removeItems] -> Корзина пуста, удалять нечего.');
    return;
  }

  console.log('[removeItems] -> Пытаемся массовое удаление…');
  try {
    /* 1. «Изменить» */
    await page.waitForSelector(EDIT_BUTTON_SELECTOR, { visible: true, timeout: 5000 });
    await page.click(EDIT_BUTTON_SELECTOR);
    await sleep(2000);

    /* 2. «Выбрать все» */
    const success = await page.evaluate(sel => {
      const cb = document.querySelector(sel);
      if (!cb) return false;
      cb.click();
      return cb.checked;
    }, SELECT_ALL_CHECKBOX_SELECTOR);
    if (!success) throw new Error('Не смогли поставить «Выбрать все».');

    /* 3. «Удалить» */
    await page.waitForSelector(DELETE_BUTTON_SELECTOR, { visible: true, timeout: 10000 });
    await page.click(DELETE_BUTTON_SELECTOR);

    /* подтверждение и ожидание */
    await confirmModalDeletion();

    /* ждём пустую корзину */
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel);
        return !el || el.textContent.trim() === '0';
      },
      { timeout: 30000 },
      CART_QTY_SELECTOR
    );

    console.log('[removeItems] -> Корзина опустела (массовое удаление).');
  } catch (err) {
    console.log('[removeItems] -> Массовое удаление не удалось: ' + err.message);
    await deleteItemsOneByOne();
  }
}

module.exports = { removeItemsIfNeeded };
