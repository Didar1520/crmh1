/* File: UI/src/components/Orders/index.js */
import React from 'react';
import './Orders.module.css';
import ExecutedOrders from './ExecutedOrders/ExecutedOrders';

function Orders() {
  return (
    <div className="orders-container">
      <h1>Заказы</h1>
      {/* Пример использования подкомпонента */}
      <ExecutedOrders />
    </div>
  );
}

export default Orders;
