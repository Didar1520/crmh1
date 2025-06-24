/* File: UI/src/App.js */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Accounts from './components/Accounts';
import Orders from './components/Orders';
import Cards from './components/Cards';
import Settings from './components/Settings';
import Clients from './components/Clients';
import Notifications from './components/Notifications';
import ExecuteAction from './components/ExecuteAction';
import './App.css';

function App() {
  return (
    <Router>
      <div className="container">
        <aside className="sidebar">
          <div className="logo">CRM</div>
          <nav className="menu">
            <ul>
              <li><Link to="/accounts">Аккаунты</Link></li>
              <li><Link to="/orders">Заказы</Link></li>
              <li><Link to="/cards">Карты</Link></li>
              <li><Link to="/settings">Настройки</Link></li>
              <li><Link to="/clients">Клиенты</Link></li>
              <li><Link to="/notifications">Уведомления</Link></li>
              <li><Link to="/execute-action">Выполнить действие</Link></li>
            </ul>
          </nav>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/cards" element={<Cards />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/execute-action" element={<ExecuteAction />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function Home() {
  return (
    <div className="inner-content">
      <h1>Добро пожаловать в CRM</h1>
      <p>Выберите нужный модуль из меню слева.</p>
    </div>
  );
}

export default App;
