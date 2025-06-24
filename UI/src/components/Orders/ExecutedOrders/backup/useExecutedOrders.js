/* File: D:\Didar1520\CRM\UI\src\components\Orders\ExecutedOrders\useExecutedOrders.js */

import { useState, useCallback } from 'react';

/**
 * Хук useExecutedOrdersLogic
 * --------------------------
 * Хранит и обновляет allOrders, settings.
 * Предоставляет функции load/save для данных и настроек.
 * Чтобы не захламлять index.jsx.
 */

export function useExecutedOrdersLogic() {
  const [allOrders, setAllOrders] = useState([]);
  const [settings, setSettings] = useState(null);

  const loadOrdersData = useCallback(async () => {
    try {
      const resp = await fetch('/ordersData');
      if (!resp.ok) {
        throw new Error(`Ошибка загрузки ordersData: ${resp.status}`);
      }
      const data = await resp.json();
      if (data && Array.isArray(data.orders)) {
        setAllOrders(data.orders);
      } else {
        setAllOrders([]);
      }
    } catch (error) {
      console.error('[useExecutedOrdersLogic] loadOrdersData error:', error);
    }
  }, []);

  const loadOrdersSettings = useCallback(async () => {
    try {
      const resp = await fetch('/ordersSettings');
      if (!resp.ok) {
        throw new Error(`Ошибка загрузки ordersSettings: ${resp.status}`);
      }
      const st = await resp.json();
      setSettings(st);
    } catch (error) {
      console.error('[useExecutedOrdersLogic] loadOrdersSettings error:', error);
    }
  }, []);

  async function saveOrdersData(updatedOrders) {
    try {
      const body = { orders: updatedOrders };
      const resp = await fetch('/saveOrdersData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        throw new Error(`Ошибка сохранения ordersData: ${resp.status}`);
      }
    } catch (error) {
      console.error('[useExecutedOrdersLogic] saveOrdersData error:', error);
    }
  }

  async function saveOrdersSettings(newSettings) {
    try {
      const resp = await fetch('/saveOrdersSettings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!resp.ok) {
        throw new Error(`Ошибка сохранения ordersSettings: ${resp.status}`);
      }
    } catch (error) {
      console.error('[useExecutedOrdersLogic] saveOrdersSettings error:', error);
    }
  }

  return {
    allOrders,
    setAllOrders,
    settings,
    setSettings,
    loadOrdersData,
    loadOrdersSettings,
    saveOrdersData,
    saveOrdersSettings
  };
}

/**
 * Функция filterOrders(orders, searchText)
 * ----------------------------------------
 * Возвращает заказы, содержащие searchText в одном из значимых полей
 */
export function filterOrders(orders, searchText) {
  const lower = searchText.trim().toLowerCase();
  if (!lower) return orders;

  return orders.filter(order => {
    const combined = [
      order.orderNumber,
      order.trackCode,
      order.date,
      order.client,
      order.paymentMethod,
      order.orderAccount,
      order.cartLink,
      order.deliveryAddress,
      order.promoCodeUsed,
      order.referralCodeUsed
    ].join(' ').toLowerCase();

    const rubVal = order.price?.rub?.toString() || '';
    const usdVal = order.price?.usd?.toString() || '';
    const commVal = order.price?.commission?.toString() || '';

    return (
      combined.includes(lower) ||
      rubVal.includes(lower) ||
      usdVal.includes(lower) ||
      commVal.includes(lower)
    );
  });
}

/**
 * Функция sortFilteredOrders(orders, sortColumn, sortDirection)
 * -------------------------------------------------------------
 * Сортирует массив orders по указанному столбцу (date, rub, usd, commission...)
 */
export function sortFilteredOrders(orders, sortColumn, sortDirection) {
  if (!sortColumn) return orders;

  return [...orders].sort((a, b) => {
    let valA, valB;

    switch (sortColumn) {
      case 'date':
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
        break;
      case 'rub':
        valA = a.price?.rub || 0;
        valB = b.price?.rub || 0;
        break;
      case 'usd':
        valA = a.price?.usd || 0;
        valB = b.price?.usd || 0;
        break;
      case 'commission':
        valA = a.price?.commission || 0;
        valB = b.price?.commission || 0;
        break;
      default:
        valA = (a[sortColumn] || '').toString().toLowerCase();
        valB = (b[sortColumn] || '').toString().toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Функция getPaginatedData(orders, settings, currentPage)
 * -------------------------------------------------------
 * Возвращает либо первые N*currentPage (при useInfiniteScroll),
 * либо конкретную страницу (при обычной пагинации).
 */
export function getPaginatedData(orders, settings, currentPage) {
  if (!settings) return orders;

  if (settings.useInfiniteScroll) {
    return orders.slice(0, currentPage * settings.pageSize);
  } else {
    const startIndex = (currentPage - 1) * settings.pageSize;
    return orders.slice(startIndex, startIndex + settings.pageSize);
  }
}
