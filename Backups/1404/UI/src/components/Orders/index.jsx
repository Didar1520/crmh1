/* File: D:\Didar1520\CRM\UI\src\components\Orders\index.jsx */

import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

export default function Orders() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Сайдбар слева */}
      <aside style={{
        width: '220px',
        backgroundColor: '#333',
        color: '#fff',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            marginBottom: '15px',
            backgroundColor: '#555',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: '3px'
          }}
        >
          Назад
        </button>
        <h2 style={{ marginTop: 0 }}>Заказы</h2>
        <nav style={{ marginTop: '20px' }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '10px' }}>
              <Link to="/orders/executed" style={{ color: '#fff', textDecoration: 'none' }}>
                Исполненные заказы
              </Link>
            </li>
            <li style={{ marginBottom: '10px' }}>
              <Link to="/orders/incoming" style={{ color: '#fff', textDecoration: 'none' }}>
                Входящие заказы
              </Link>
            </li>
            <li style={{ marginBottom: '10px' }}>
              <Link to="/orders/add-completed" style={{ color: '#fff', textDecoration: 'none' }}>
                Добавить выполненный заказ
              </Link>
            </li>
            <li style={{ marginBottom: '10px' }}>
              <Link to="/orders/stats" style={{ color: '#fff', textDecoration: 'none' }}>
                Статистика
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Основное содержимое */}
      <main style={{ flex: 1, padding: '20px' }}>
        <Outlet />
      </main>
    </div>
  );
}
