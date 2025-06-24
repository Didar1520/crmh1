// Путь: /UI/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container, Row, Col, Navbar, Nav } from 'react-bootstrap';

import Accounts from './components/Accounts';
import Orders from './components/Orders'; // если у вас такой компонент есть
import Cards from './components/Cards';
import Settings from './components/Settings';
import Clients from './components/Clients';
import Notifications from './components/Notifications';
import ExecuteAction from './components/ExecuteAction';
import ExecutedOrders from './components/Orders/ExecutedOrders/index';

// import './App.css'; // Если в App.css остались какие-то специфичные стили, можно оставить их.

function App() {
  return (
    <Router>
      <Container fluid className="p-0">
        <Row noGutters>
          {/* Боковая панель */}
          <Col md={3} lg={2} className="bg-dark">
            <Navbar bg="dark" variant="dark" className="flex-column align-items-start p-3 vh-100">
              <Navbar.Brand href="/">CRM</Navbar.Brand>
              <Nav className="flex-column w-100">
                <Nav.Link href="/accounts">Аккаунты</Nav.Link>
                <Nav.Link href="/orders">Заказы</Nav.Link>
                <Nav.Link href="/orders/executed">Исполненные заказы</Nav.Link>
                <Nav.Link href="/cards">Карты</Nav.Link>
                <Nav.Link href="/settings">Настройки</Nav.Link>
                <Nav.Link href="/clients">Клиенты</Nav.Link>
                <Nav.Link href="/notifications">Уведомления</Nav.Link>
                <Nav.Link href="/execute-action">Выполнить действие</Nav.Link>
              </Nav>
            </Navbar>
          </Col>

          {/* Контент */}
          <Col md={9} lg={10} className="p-4">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/cards" element={<Cards />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/execute-action" element={<ExecuteAction />} />
              <Route path="/orders/executed" element={<ExecutedOrders />} />
            </Routes>
          </Col>
        </Row>
      </Container>
    </Router>
  );
}

function Home() {
  return (
    <div>
      <h1 className="mb-4">Добро пожаловать в CRM</h1>
      <p>Выберите нужный модуль из меню слева.</p>
    </div>
  );
}

export default App;
