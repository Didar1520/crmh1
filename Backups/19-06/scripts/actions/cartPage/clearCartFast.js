/* File: clearCartFast.js
 * «Чистим корзину одним ударом» через официальный API iHerb
 * ───────────────────────────────────────────────────────── */

const { sleep } = require('../utils/pageLoadHelper.js');

/* ——— helpers ——— */

/** GET /api/Carts/0/cartcount → int */
async function getCartQty(page) {
  const qty = await page.evaluate(async () => {
    const r = await fetch('/api/Carts/0/cartcount', { credentials: 'include' });
    if (!r.ok) throw new Error('cartcount status ' + r.status);
    const { cartQuantity } = await r.json();
    return cartQuantity;
  });
  return typeof qty === 'number' ? qty : 0;
}

/** GET /api/Carts/v2/cart → массив productId */
async function fetchAllLineItemIds(page) {
  return await page.evaluate(async () => {
    const r = await fetch('/api/Carts/v2/cart', { credentials: 'include' });
    if (!r.ok) throw new Error('cart status ' + r.status);
    const data = await r.json();
    return (data.lineItems || []).map(li => li.productId);
  });
}

/** DELETE /api/Carts/v2/lineitems/products  */
async function deleteByApi(page, ids) {
  if (!ids.length) return;

  await page.evaluate(async lineItems => {
    const r = await fetch('/api/Carts/v2/lineitems/products', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineItems, sourceModule: 'CartLists' })
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '[no body]');
      throw new Error(`DELETE ${r.status}: ${txt.slice(0,120)}`);
    }
  }, ids);
}

/* ——— public ——— */

async function clearCartFast(page) {
  console.log('[clearCartFast] → проверяем корзину…');
  let qty = await getCartQty(page);
  console.log(`[clearCartFast] → позиций: ${qty}`);

  if (qty === 0) {
    console.log('[clearCartFast] → уже пусто, выходим.');
    return;
  }

  /* 1. собираем id всех товаров */
  const ids = await fetchAllLineItemIds(page);
  if (ids.length === 0)
    throw new Error('Корзина не пуста, но API вернул 0 lineItems');

  console.log(`[clearCartFast] → DELETE по API (${ids.length} id)…`);
  await deleteByApi(page, ids);

  /* 2. контроль */
  await sleep(700);
  qty = await getCartQty(page);

  if (qty === 0) {
    console.log('[clearCartFast] ✓ корзина очищена одним запросом.');
  } else {
    throw new Error(`[clearCartFast] ✗ после удаления осталось ${qty} позиций`);
  }
}

module.exports = { clearCartFast };
