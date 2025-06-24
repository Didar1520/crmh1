/* File: D:\Didar1520\CRM\UI\src\components\Orders\ExecutedOrders\helpers.jsx */

import React from 'react';

/**
 * renderCell(order, colKey)
 * -------------------------
 * Рендерит содержимое ячейки таблицы в зависимости от colKey,
 * включая "живую" ссылку для cartLink.
 */
export function renderCell(order, colKey) {
  switch (colKey) {
    case 'orderNumber':
      return order.orderNumber || '';

    case 'trackCode':
      return order.trackCode || '';

    case 'date':
      return order.date || '';

    case 'rub':
      return order.price?.rub ?? '';

    case 'usd':
      return order.price?.usd ?? '';

    case 'commission':
      return order.price?.commission ?? '';

    case 'rate':
      return order.rate ?? '';

    case 'bybitRate':
      return order.bybitRate ?? '';

    case 'client':
      return order.client || '';

    case 'paymentMethod':
      return order.paymentMethod || '';

    case 'cartLink':
      // Если cartLink есть, рендерим ссылку <a>. Иначе пусто.
      return order.cartLink
        ? <a href={order.cartLink} target="_blank" rel="noreferrer">Ссылка</a>
        : '';

    case 'deliveryAddress':
      return order.deliveryAddress || '';

    case 'referralCodeUsed':
      return order.referralCodeUsed || '';

    case 'promoCodeUsed':
      return order.promoCodeUsed || '';

    case 'orderAccount':
      return order.orderAccount || '';

    case 'rewardsUsed':
      return order.rewardsUsed ?? 0;

    default:
      // Любой другой ключ
      return (order[colKey] || '').toString();
  }
}

/**
 * renderColumnHeader(colKey)
 * --------------------------
 * Возвращает заголовок столбца на русском (или сам colKey, если неизвестно).
 */
export function renderColumnHeader(colKey) {
  switch (colKey) {
    case 'orderNumber': return 'Номер заказа';
    case 'trackCode': return 'Трек-код';
    case 'date': return 'Дата';
    case 'rub': return 'Цена (RUB)';
    case 'usd': return 'Цена (USD)';
    case 'commission': return 'С комиссией';
    case 'rate': return 'Курс iHerb';
    case 'bybitRate': return 'Курс Bybit';
    case 'client': return 'Клиент';
    case 'paymentMethod': return 'Способ оплаты';
    case 'cartLink': return 'Ссылка на корзину';
    case 'deliveryAddress': return 'Адрес';
    case 'referralCodeUsed': return 'Реф. код';
    case 'promoCodeUsed': return 'Промокод';
    case 'orderAccount': return 'Аккаунт';
    case 'rewardsUsed': return 'Вознагражд.';
    default:
      return colKey;
  }
}
