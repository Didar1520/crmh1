// Путь: /UI/src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Импортируем базовые стили Bootstrap
import 'bootstrap/dist/css/bootstrap.min.css';
// Импортируйте глобальные стили, если нужно (например, index.css с Tailwind)
// Если Tailwind больше не используется, этот импорт можно удалить.
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
