// Путь: /UI/src/components/Orders/ExecutedOrders/index.jsx
import React, { useState, useEffect } from 'react';
import { Container, Form, Button, ButtonGroup, Table, Alert } from 'react-bootstrap';
import ColumnSettings from './ColumnSettings';
import EditModal from './EditModal';
import { renderCell, renderColumnHeader } from './helpers';
import {
  useExecutedOrdersLogic,
  filterOrders,
  sortFilteredOrders,
  getPaginatedData
} from './useExecutedOrders';

/* ---------------------------
   Вспомогательные функции для обработки дат и группировки заказов
----------------------------*/

// Функция для парсинга даты из строки вида "DD-MM-YYYY HH:MM"
function parseOrderDate(dateStr) {
  if (!dateStr) return new Date();
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('-').map(Number);
  const [hour, minute] = timePart ? timePart.split(':').map(Number) : [0, 0];
  return new Date(year, month - 1, day, hour, minute);
}

const RU_MONTHS = [
  'Января', 'Февраля', 'Марта', 'Апреля',
  'Мая', 'Июня', 'Июля', 'Августа',
  'Сентября', 'Октября', 'Ноября', 'Декабря'
];

const RU_DAYS = [
  'Воскресенье', 'Понедельник', 'Вторник',
  'Среда', 'Четверг', 'Пятница', 'Суббота'
];

// Форматирование для режима "day": "07 Апреля, Понедельник"
function formatDateDay(dateObj) {
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = RU_MONTHS[dateObj.getMonth()];
  const weekday = RU_DAYS[dateObj.getDay()];
  return `${day} ${month}, ${weekday}`;
}

// Форматирование для режима "week": "2-я неделя апреля 2025"
function formatDateWeek(dateObj) {
  const day = dateObj.getDate();
  const weekNum = Math.ceil(day / 7);
  const month = RU_MONTHS[dateObj.getMonth()].toLowerCase();
  const year = dateObj.getFullYear();
  return `${weekNum}-я неделя ${month} ${year}`;
}

// Форматирование для режима "month": "Апрель 2025"
function formatDateMonth(dateObj) {
  const month = RU_MONTHS[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${month} ${year}`;
}

// Группировка заказов по выбранному режиму: "day", "week", "month"
function groupOrdersByMode(orders, mode) {
  const groups = {}; // ключ: заголовок, значение: массив заказов
  orders.forEach(order => {
    const dateObj = parseOrderDate(order.date);
    let key = '';
    if (mode === 'day') {
      key = formatDateDay(dateObj);
    } else if (mode === 'week') {
      key = formatDateWeek(dateObj);
    } else if (mode === 'month') {
      key = formatDateMonth(dateObj);
    }
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(order);
  });
  return groups;
}

// Функция для рендера переключателя режимов
function renderViewModeToggle(viewMode, setViewMode) {
  return (
    <ButtonGroup className="mb-3">
      <Button variant={viewMode === "all" ? "primary" : "outline-primary"} onClick={() => setViewMode("all")}>
        Все
      </Button>
      <Button variant={viewMode === "day" ? "primary" : "outline-primary"} onClick={() => setViewMode("day")}>
        По дням
      </Button>
      <Button variant={viewMode === "week" ? "primary" : "outline-primary"} onClick={() => setViewMode("week")}>
        По неделям
      </Button>
      <Button variant={viewMode === "month" ? "primary" : "outline-primary"} onClick={() => setViewMode("month")}>
        По месяцам
      </Button>
    </ButtonGroup>
  );
}

/* ---------------------------
   Основной компонент ExecutedOrders
----------------------------*/

export default function ExecutedOrders() {
  const {
    allOrders,
    settings,
    loadOrdersData,
    loadOrdersSettings,
    saveOrdersData,
    saveOrdersSettings,
    setAllOrders,
    setSettings,
  } = useExecutedOrdersLogic();

  const [searchText, setSearchText] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [editOrder, setEditOrder] = useState(null);
  const [viewMode, setViewMode] = useState("all"); // "all", "day", "week", "month"

  useEffect(() => {
    loadOrdersData();
    loadOrdersSettings();
  }, [loadOrdersData, loadOrdersSettings]);

  // Удаление/Редактирование заказов
  const handleDelete = (order) => {
    if (!window.confirm(`Удалить заказ №${order.orderNumber}?`)) return;
    const newOrders = allOrders.filter(o => o !== order);
    setAllOrders(newOrders);
    saveOrdersData(newOrders);
  };

  const handleEdit = (order) => {
    const realIndex = allOrders.indexOf(order);
    setEditOrder({ ...order, _index: realIndex });
  };

  const closeEditModal = () => setEditOrder(null);
  
  const saveEditOrder = () => {
    if (editOrder?._index == null) return;
    const newOrders = [...allOrders];
    const { _index, ...updated } = editOrder;
    newOrders[_index] = updated;
    setAllOrders(newOrders);
    saveOrdersData(newOrders);
    setEditOrder(null);
  };

  // Фильтрация и сортировка
  const filtered = filterOrders(allOrders, searchText);
  const sorted = sortFilteredOrders(filtered, sortColumn, sortDirection);
  // Если viewMode === "all", используется пагинация
  const displayed = viewMode === "all" ? getPaginatedData(sorted, settings, currentPage) : sorted;

  // Итоговые суммы (общие)
  const totalRub = filtered.reduce((acc, o) => acc + (o.price?.rub || 0), 0);
  const totalUsd = filtered.reduce((acc, o) => acc + (o.price?.usd || 0), 0);
  const totalComm = filtered.reduce((acc, o) => acc + (o.price?.commission || 0), 0);

  if (!settings) {
    return (
      <Container className="py-5">
        <Alert variant="info">Загрузка настроек...</Alert>
      </Container>
    );
  }

  // Рендер для режима "all"
  if (viewMode === "all") {
    return (
      <Container fluid className="py-4 bg-light min-vh-100">
        <Container className="bg-white p-4 shadow-sm rounded">
          {renderViewModeToggle(viewMode, setViewMode)}
          <h2 className="mb-4 text-primary">Исполненные заказы</h2>
          <div className="mb-3">
            <Form.Label>Поиск:</Form.Label>
            <Form.Control
              type="text"
              placeholder="Например, номер заказа или клиент..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="mb-3">
            <Form.Label>Сортировать по:</Form.Label>
            <Form.Select
              value={sortColumn}
              onChange={(e) => {
                setSortColumn(e.target.value);
                setSortDirection('asc');
              }}
            >
              <option value="">Без сортировки</option>
              <option value="date">Дата</option>
              <option value="rub">Сумма (RUB)</option>
              <option value="usd">Сумма (USD)</option>
              <option value="commission">Сумма с комиссией</option>
              <option value="client">Клиент</option>
            </Form.Select>
            {sortColumn && (
              <Button
                variant="outline-secondary"
                className="mt-2"
                onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
              >
                {sortDirection === 'asc' ? '▲ (по возр.)' : '▼ (по убыв.)'}
              </Button>
            )}
          </div>
          <div className="mb-3">
            <Form.Check
              type="checkbox"
              label="Бесконечная прокрутка"
              checked={settings.useInfiniteScroll}
              onChange={(e) => {
                const newSt = { ...settings, useInfiniteScroll: e.target.checked };
                setSettings(newSt);
                saveOrdersSettings(newSt);
                setCurrentPage(1);
              }}
            />
          </div>
          {!settings.useInfiniteScroll && (
            <div className="mb-3 d-flex align-items-center">
              <Form.Label className="me-2">На странице:</Form.Label>
              <Form.Control
                type="number"
                value={settings.pageSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 20;
                  const newSt = { ...settings, pageSize: val };
                  setSettings(newSt);
                  saveOrdersSettings(newSt);
                  setCurrentPage(1);
                }}
                style={{ width: '80px' }}
              />
            </div>
          )}
          <ColumnSettings settings={settings} setSettings={setSettings} saveOrdersSettings={saveOrdersSettings} />
          <Table striped bordered hover responsive className="mt-3">
            <thead className="bg-primary text-white">
              <tr>
                {settings.columnsOrder.map(colKey => {
                  if (!settings.columnsVisibility[colKey]) return null;
                  return <th key={colKey}>{renderColumnHeader(colKey)}</th>;
                })}
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((order, idx) => (
                <tr key={idx}>
                  {settings.columnsOrder.map(colKey => {
                    if (!settings.columnsVisibility[colKey]) return null;
                    return <td key={colKey}>{renderCell(order, colKey)}</td>;
                  })}
                  <td>
                    <Button variant="primary" size="sm" onClick={() => handleEdit(order)} className="me-2">
                      Ред.
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(order)}>
                      Удал.
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Alert variant="secondary" className="mt-4">
            <strong>Итоги (фильтрованные):</strong>
            <br />Сумма RUB: {totalRub}
            <br />Сумма USD: {totalUsd}
            <br />Сумма с комиссией: {totalComm}
          </Alert>
          {!settings.useInfiniteScroll && (
            <div className="mt-3 d-flex justify-content-center gap-2">
              <Button variant="outline-secondary" onClick={firstPage}>В начало</Button>
              <Button variant="outline-secondary" onClick={prevPage}>Назад</Button>
              <div className="align-self-center">Стр. {currentPage}</div>
              <Button variant="outline-secondary" onClick={nextPage}>Вперёд</Button>
              <Button variant="outline-secondary" onClick={() => lastPage(filtered.length)}>В конец</Button>
            </div>
          )}
        </Container>
        {editOrder && (
          <EditModal
            order={editOrder}
            setOrder={setEditOrder}
            onClose={closeEditModal}
            onSave={saveEditOrder}
          />
        )}
      </Container>
    );
  } else {
    // Режимы группировки: "day", "week", "month"
    const groups = groupOrdersByMode(sorted, viewMode);
    const groupKeys = Object.keys(groups);
    return (
      <Container fluid className="py-4 bg-light min-vh-100">
        <Container className="bg-white p-4 shadow-sm rounded">
          {renderViewModeToggle(viewMode, setViewMode)}
          <h2 className="mb-4 text-primary">
            Исполненные заказы – {viewMode === 'day' ? 'По дням' : viewMode === 'week' ? 'По неделям' : 'По месяцам'}
          </h2>
          <div className="mb-3">
            <Form.Label>Поиск:</Form.Label>
            <Form.Control
              type="text"
              placeholder="Например, номер заказа или клиент..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="mb-3">
            <Form.Label>Сортировать по:</Form.Label>
            <Form.Select
              value={sortColumn}
              onChange={(e) => {
                setSortColumn(e.target.value);
                setSortDirection('asc');
              }}
            >
              <option value="">Без сортировки</option>
              <option value="date">Дата</option>
              <option value="rub">Сумма (RUB)</option>
              <option value="usd">Сумма (USD)</option>
              <option value="commission">Сумма с комиссией</option>
              <option value="client">Клиент</option>
            </Form.Select>
            {sortColumn && (
              <Button
                variant="outline-secondary"
                className="mt-2"
                onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
              >
                {sortDirection === 'asc' ? '▲ (по возр.)' : '▼ (по убыв.)'}
              </Button>
            )}
          </div>
          {groupKeys.map((groupKey) => {
            const groupOrders = groups[groupKey];
            const { rub, usd, comm } = groupOrders.reduce((acc, o) => {
              acc.rub += (o.price?.rub || 0);
              acc.usd += (o.price?.usd || 0);
              acc.comm += (o.price?.commission || 0);
              return acc;
            }, { rub: 0, usd: 0, comm: 0 });
            return (
              <div key={groupKey} className="mb-4">
                <h4 className="mb-1 text-secondary">{groupKey}</h4>
                <Alert variant="info" className="py-1">
                  Итоги: RUB {rub} | USD {usd} | С комиссией {comm}
                </Alert>
                <Table striped bordered hover responsive>
                  <thead className="bg-primary text-white">
                    <tr>
                      {settings.columnsOrder.map(colKey => {
                        if (!settings.columnsVisibility[colKey]) return null;
                        return <th key={colKey}>{renderColumnHeader(colKey)}</th>;
                      })}
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupOrders.map((order, idx) => (
                      <tr key={idx}>
                        {settings.columnsOrder.map(colKey => {
                          if (!settings.columnsVisibility[colKey]) return null;
                          return <td key={colKey}>{renderCell(order, colKey)}</td>;
                        })}
                        <td>
                          <Button variant="primary" size="sm" onClick={() => handleEdit(order)} className="me-2">
                            Ред.
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(order)}>
                            Удал.
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            );
          })}
          <Alert variant="secondary" className="mt-4">
            <strong>Общие итоги (фильтрованные):</strong>
            <br />Сумма RUB: {totalRub}
            <br />Сумма USD: {totalUsd}
            <br />Сумма с комиссией: {totalComm}
          </Alert>
        </Container>
      </Container>
    );
  }
}
