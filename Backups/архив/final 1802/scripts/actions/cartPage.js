// scripts/actions/cartPage.js
/**
 * cartPage.js
 * -----------------------------------------------------------------------------
 * Шаг 1: Проверяем корзину через API (https://checkout12.iherb.com/api/Carts/0/cartcount).
 * Шаг 2: Если корзина не пуста, очищаем её (POST на /api/Carts/v2/lineitems/products со "lineItems: []").
 * Шаг 3: Открываем cartLink, жмём "Добавить в корзину".
 */

async function handleCart(page, finalParams) {
  console.log('[cartPage] -> Начало handleCart()');

  // 1) Проверить кол-во товаров (cartcount).
  const cartCount = await page.evaluate(async () => {
    const res = await fetch('https://checkout12.iherb.com/api/Carts/0/cartcount', {
      method: 'GET',
      credentials: 'include'
    });
    if (!res.ok) return -1;
    const txt = await res.text();
    const count = parseInt(txt, 10);
    return isNaN(count) ? -1 : count;
  });

  if (cartCount < 0) {
    console.log('[cartPage] -> Не удалось узнать кол-во товаров (cartcount).');
  } else {
    console.log(`[cartPage] -> Товаров в корзине: ${cartCount}`);
  }

  // 2) Если корзина не пуста => очистить
  if (cartCount > 0) {
    console.log('[cartPage] -> Корзина не пуста, очищаем API...');
    const clearResult = await page.evaluate(async () => {
      try {
        const body = { lineItems: [] };
        const res = await fetch('https://checkout12.iherb.com/api/Carts/v2/lineitems/products', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          return { success: false, status: res.status, message: 'Очистка не OK' };
        }
        const json = await res.json();
        if (json && Array.isArray(json.lineItems) && json.lineItems.length === 0) {
          return { success: true, message: 'Корзина очищена' };
        }
        return { success: false, message: 'lineItems всё ещё не пуст' };
      } catch (err) {
        return { success: false, message: `Ошибка при очистке: ${err}` };
      }
    });
    console.log('[cartPage] -> Результат очистки:', clearResult);
  }

  // 3) Открываем cartLink
  const cartLink = finalParams.cartLink;
  if (!cartLink) {
    console.log('[cartPage] -> Нет cartLink => пропускаем добавление товаров.');
    return;
  }
  console.log(`[cartPage] -> Открываем cartLink: ${cartLink}`);
  await page.goto(cartLink, { waitUntil: 'networkidle2' });

  // 4) Нажимаем кнопку "Добавить в корзину"
  try {
    await page.waitForSelector('button[name="AddToCart"]', { visible: true, timeout: 10000 });
    await page.click('button[name="AddToCart"]');
    console.log('[cartPage] -> Нажали "Добавить в корзину"');
  } catch (err) {
    console.log('[cartPage] -> Не удалось нажать кнопку AddToCart:', err);
  }

  console.log('[cartPage] -> handleCart() завершён.');
}

module.exports = { handleCart };
