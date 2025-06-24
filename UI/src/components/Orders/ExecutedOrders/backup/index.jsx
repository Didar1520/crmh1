// Путь: /UI/src/components/Orders/ExecutedOrders/index.jsx
import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Table, Alert } from 'react-bootstrap';
import ColumnSettings from './ColumnSettings';
import EditModal from './EditModal';
import { renderCell, renderColumnHeader } from './helpers';
import {
  useExecutedOrdersLogic,
  filterOrders,
  sortFilteredOrders,
  getPaginatedData
} from './useExecutedOrders';

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

  useEffect(() => {
    loadOrdersData();
    loadOrdersSettings();
  }, [loadOrdersData, loadOrdersSettings]);

  // Пагинация
  const nextPage = () => setCurrentPage((p) => p + 1);
  const prevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const firstPage = () => setCurrentPage(1);
  const lastPage = (totalItems) => {
    if (!settings) return;
    const totalPages = Math.ceil(totalItems / settings.pageSize);
    setCurrentPage(totalPages);
  };

  // Удаление/Редактирование
  const handleDelete = (order) => {
    if (!window.confirm(`Удалить заказ №${order.orderNumber}?`)) return;
    const newOrders = allOrders.filter((o) => o !== order);
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

  // Фильтрация/Сортировка
  const filtered = filterOrders(allOrders, searchText);
  const sorted = sortFilteredOrders(filtered, sortColumn, sortDirection);
  const displayed = getPaginatedData(sorted, settings, currentPage);

  // Итоги
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

  return (
    <Container fluid className="py-4 bg-light min-vh-100">
      <Container className="bg-white p-4 shadow-sm rounded">

        {/* Заголовок */}
        <h2 className="mb-4 text-primary">Исполненные заказы</h2>

        {/* Поиск */}
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

        {/* Сортировка */}
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

          {/* Кнопка переключения направления сортировки */}
          {sortColumn && (
            <Button
              variant="outline-secondary"
              className="mt-2"
              onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            >
              {sortDirection === 'asc' ? '▲ (по возр.)' : '▼ (по убыв.)'}
            </Button>
          )}
        </div>

        {/* Infinite scroll & pageSize */}
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

        {/* Настройка столбцов */}
        <ColumnSettings
          settings={settings}
          setSettings={setSettings}
          saveOrdersSettings={saveOrdersSettings}
        />

        {/* Таблица */}
        <Table striped bordered hover responsive className="mt-3">
          <thead className="bg-primary text-white">
            <tr>
              {settings.columnsOrder.map((colKey) => {
                if (!settings.columnsVisibility[colKey]) return null;
                return <th key={colKey}>{renderColumnHeader(colKey)}</th>;
              })}
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((order, idx) => (
              <tr key={idx}>
                {settings.columnsOrder.map((colKey) => {
                  if (!settings.columnsVisibility[colKey]) return null;
                  return <td key={colKey}>{renderCell(order, colKey)}</td>;
                })}
                <td>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleEdit(order)}
                    className="me-2"
                  >
                    Ред.
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(order)}
                  >
                    Удал.
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {/* Итоги */}
        <Alert variant="secondary" className="mt-4">
          <strong>Итоги (фильтрованные):</strong>
          <br />
          Сумма RUB: {totalRub}
          <br />
          Сумма USD: {totalUsd}
          <br />
          Сумма с комиссией: {totalComm}
        </Alert>

        {/* Пагинация (вертикальный блок) */}
        {!settings.useInfiniteScroll && (
          <div className="mt-3 d-flex justify-content-center gap-2">
            <Button variant="outline-secondary" onClick={firstPage}>
              В начало
            </Button>
            <Button variant="outline-secondary" onClick={prevPage}>
              Назад
            </Button>
            <div className="align-self-center">Стр. {currentPage}</div>
            <Button variant="outline-secondary" onClick={nextPage}>
              Вперёд
            </Button>
            <Button
              variant="outline-secondary"
              onClick={() => lastPage(filtered.length)}
            >
              В конец
            </Button>
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
}
