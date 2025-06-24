/* File: D:\Didar1520\CRM\UI\src\components\Orders\ExecutedOrders\useExecutedOrders.js */
import { useState, useCallback, useEffect } from 'react';
// Импортируем дефолтные настройки, на случай если сервер недоступен или произошла ошибка
import defaultSettings from './settings/ordersSettings.json';

import { parseOrderDate } from './dateUtils';

/**
 * Хук useExecutedOrdersLogic
 * --------------------------
 * Хранит и обновляет allOrders и settings.
 * Предоставляет функции load/save для данных и настроек.
 */

/**
 * Сохраняет список заказов на сервере и пересчитывает долг клиента.
 *
 * @param {Array} updatedOrders — полный массив объектов заказов
 * @param {number} clientId — идентификатор клиента, для которого пересчитываем долг
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

  // Загрузка настроек с сервера через GET /ordersSettings
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
      // Если сервер вернул ошибку (например, HTML вместо JSON), используем дефолтные настройки
      setSettings(defaultSettings);
    }
  }, []);

  async function saveOrdersData(updatedOrders, clientId) {
    try {
      console.log('[saveOrdersData] → POST /saveOrdersData',
        { orders: updatedOrders.length, clientId });

      // 1) Сохраняем обновлённые заказы
      const saveResp = await fetch('/saveOrdersData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: updatedOrders }),
      });
      if (!saveResp.ok) {
        throw new Error(`Ошибка сохранения ordersData: ${saveResp.status}`);
      }

      // 2) Пересчитываем долг по этому клиенту
      const recalcResp = await fetch('/recalculateDebt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      console.log('[saveOrdersData] → POST /recalculateDebt status', recalcResp.status);
      if (!recalcResp.ok) {
        throw new Error(`Ошибка пересчёта долга: ${recalcResp.status}`);
      }

      // По желанию, можно вернуть новый долг из тела ответа:
      const { debt } = await recalcResp.json();
      return debt;

    } catch (error) {
      console.error('[useExecutedOrdersLogic] saveOrdersData error:', error);
      // Можно пробросить ошибку дальше, если нужно
      // throw error;
    }
  }

  // Сохранение настроек через POST /saveOrdersSettings
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
      setSettings(newSettings);
    } catch (error) {
      console.error('[useExecutedOrdersLogic] saveOrdersSettings error:', error);
    }
  }

  useEffect(() => {
    loadOrdersSettings();
  }, [loadOrdersSettings]);

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
/* File: D:\Didar1520\CRM\UI\src\components\Orders\ExecutedOrders\useExecutedOrders.js (continued) */

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
 * Сортирует массив orders по указанному столбцу (date, rub, usd, commission…)
 */
export function sortFilteredOrders(orders, sortColumn, sortDirection) {
  if (!sortColumn) return orders;

  return [...orders].sort((a, b) => {
    let valA, valB;

    switch (sortColumn) {
      case 'date':
        valA = parseOrderDate(a.date).getTime();
        valB = parseOrderDate(b.date).getTime();
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
