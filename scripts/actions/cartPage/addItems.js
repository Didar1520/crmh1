// scripts/actions/cartPage/addItems.js


const { sleep } = require('../utils/pageLoadHelper.js');
const ADD_TO_CART_BUTTON_SELECTOR = 'button[data-qa-element="btn-add-to-cart"]';

/**
 * addItemsIfNeeded(page, cartLink)
 * -----------------------------------------------------------------------------
 * Если в finalParams.cartLink есть ссылка, переходим и жмём "Добавить в корзину".
 */
async function addItemsIfNeeded(page, cartLink) {
  if (!cartLink) {
    console.log('[addItems] -> Нет cartLink, пропускаем добавление товаров.');
    return;
  }
  console.log('[addItems] -> Переходим по cartLink:', cartLink);
  await page.goto(cartLink, { waitUntil: 'networkidle2' });

  try {
    await page.waitForSelector(ADD_TO_CART_BUTTON_SELECTOR, { visible: true, timeout: 10000 });
    await page.click(ADD_TO_CART_BUTTON_SELECTOR);
    console.log('[addItems] -> Нажали "Добавить в корзину".');
    await sleep(1000);
  } catch (err) {
    console.log('[addItems] -> Ошибка при добавлении товара:', err);
  }
}

module.exports = { addItemsIfNeeded };
