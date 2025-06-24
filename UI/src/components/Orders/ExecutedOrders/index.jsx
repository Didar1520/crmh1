/* File: index.jsx */
import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Table, Alert, Modal  } from 'react-bootstrap';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import ColumnSettings from './ColumnSettings';
import EditModal from './EditModal';
import { parseOrderDate } from './dateUtils';

import PaymentStatusCell from './PaymentStatusCell';
import { renderColumnHeader } from './helpers';
import {
  useExecutedOrdersLogic,
  filterOrders,
  sortFilteredOrders,
  getPaginatedData
} from './useExecutedOrders';
import ViewModeToggle from './ViewModeToggle';
import { groupOrdersByMode } from './dateUtils';
import InlineEditableCell from './InlineEditableCell';
import AddExecutedOrderModal from './AddExecutedOrderModal'; // <-- Новый модал

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
  // Диапазон дат
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Масштаб и конкретный период
  const [rangeScale, setRangeScale] = useState('year'); // year | month | week | day
  const [rangeValue, setRangeValue] = useState('');

    const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [editOrder, setEditOrder] = useState(null);
  const [viewMode, setViewMode] = useState('all'); // "all", "day", "week", "month"
  const [deleteOrder, setDeleteOrder] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);


  // Модалка добавления заказа
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);

  // Пагинация
  const firstPage = () => setCurrentPage(1);
  const prevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const nextPage = () => {
    if (settings && currentPage < Math.ceil(filterOrders(allOrders, searchText).length / settings.pageSize)) {
      setCurrentPage(currentPage + 1);
    }
  };
  const lastPage = (totalItems) => setCurrentPage(Math.ceil(totalItems / settings.pageSize));

  useEffect(() => {
    loadOrdersData();
    loadOrdersSettings();
  }, [loadOrdersData, loadOrdersSettings]);

  // Кнопка «Удалить»
  const handleDelete = (order) => {
    setDeleteOrder(order);
    setShowDeleteModal(true);
  };

  const confirmDeleteOrder = () => {
    if (!deleteOrder) return;
    const updated = allOrders.filter(o => o.orderNumber !== deleteOrder.orderNumber);
    console.log('[PAYMENT] clientId =', deleteOrder.clientId, 'order =', deleteOrder);
    setAllOrders(updated);
    saveOrdersData(updated, deleteOrder.clientId); 
    setShowDeleteModal(false);
    setDeleteOrder(null);
  };

  // Кнопка «Редактировать» (модалка)
  const handleEdit = (order) => {
    const realIndex = allOrders.findIndex(o => o.orderNumber === order.orderNumber);
    if (realIndex !== -1) {
      setEditOrder({ ...order, _index: realIndex });
    } else {
      console.warn('[handleEdit] Не удалось найти заказ по orderNumber');
      setEditOrder({ ...order });
    }
  };

  const closeEditModal = () => setEditOrder(null);

  // Сохранение через EditModal
  const saveEditOrder = () => {
    if (editOrder?._index == null) {
      console.warn('[saveEditOrder] editOrder._index не определён.');
      setEditOrder(null);
      return;
    }
    const newOrders = [...allOrders];
    const { _index, ...updated } = editOrder;
    newOrders[_index] = updated;
    setAllOrders(newOrders);
    saveOrdersData(newOrders, updated.clientId);
    setEditOrder(null);
  };

  // Колбэк для изменения статуса оплаты
  const handlePaymentStatusChange = async (updatedOrder) => {
    const newOrders = [...allOrders];
    const idx = newOrders.findIndex(o => o.orderNumber === updatedOrder.orderNumber);
    if (idx !== -1) {
      newOrders[idx] = updatedOrder;
      console.log('[PAYMENT] clientId =', updatedOrder.clientId, 'order =', updatedOrder);

      await saveOrdersData(newOrders, updatedOrder.clientId);
    }
  };

  // Колбэк для сохранения инлайн-редактирования
  const handleInlineSave = async (updatedOrder) => {
    const newOrders = [...allOrders];
    const idx = newOrders.findIndex(o => o.orderNumber === updatedOrder.orderNumber);
    if (idx !== -1) {
      newOrders[idx] = updatedOrder;
      console.log('[PAYMENT] clientId =', newOrder.clientId, 'order =', newOrder);

      setAllOrders(newOrders);
      await saveOrdersData(newOrders, updatedOrder.clientId);
    } else {
      console.warn('[handleInlineSave] Не найден заказ для обновления по orderNumber.');
    }
  };

  // Когда добавили новый заказ через модалку
  const handleOrderAdded = async (newOrder) => {
    const updatedOrders = [...allOrders, newOrder];
    console.log('[PAYMENT] clientId =', newOrder.clientId, 'order =', newOrder);
    setAllOrders(updatedOrders);
    await saveOrdersData(updatedOrders, newOrder.clientId);
  };

  const filtered = filterOrders(allOrders, searchText);
  const filteredByDate = filtered.filter(o => {
    const ms = parseOrderDate(o.date).getTime();
    const okFrom = dateFrom ? ms >= new Date(dateFrom).getTime() : true;
    const okTo   = dateTo   ? ms <= new Date(dateTo).getTime()   : true;
    return okFrom && okTo;
  });
  const sorted = sortFilteredOrders(filtered, sortColumn, sortDirection);
  const displayed = viewMode === 'all' ? getPaginatedData(sorted, settings, currentPage) : sorted;

  const nf = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalRub = nf.format(filteredByDate.reduce((acc, o) => acc + (o.price?.rub || 0), 0));
  const totalUsd = nf.format(filteredByDate.reduce((acc, o) => acc + (o.price?.usd || 0), 0));
  const totalWithCommission = nf.format(filteredByDate.reduce((acc, o) => acc + (o.price?.total || 0), 0));
  

  if (!settings) {
    return (
      <Container className="py-5">
        <Alert variant="info">Загрузка настроек...</Alert>
      </Container>
    );
  }

  // ======== Рендер режима "Все" =========
  if (viewMode === 'all') {
    return (
      <Container fluid className="py-4 bg-light min-vh-100">
        <Container className="bg-white p-4 shadow-sm rounded">

          {/* Шапка со switch'ем и кнопкой "Добавить исполненный заказ" */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
            <Button
              variant="success"
              onClick={() => setShowAddOrderModal(true)}
            >
              Добавить исполненный заказ
            </Button>
          </div>

          <h2 className="mb-4 text-primary">Исполненные заказы</h2>
          {/* Диапазон дат */}
<div className="mb-3 d-flex gap-3">
  <div>
    <Form.Label>От:</Form.Label>
    <Form.Control
      type="date"
      value={dateFrom}
      onChange={e => {
        setDateFrom(e.target.value);
        setCurrentPage(1);
      }}
    />
  </div>
  <div>
    <Form.Label>До:</Form.Label>
    <Form.Control
      type="date"
      value={dateTo}
      onChange={e => {
        setDateTo(e.target.value);
        setCurrentPage(1);
      }}
    />
  </div>
</div>

          {/* Поиск */}
          <div className="mb-3">
            <Form.Label>Поиск:</Form.Label>
            <Form.Control
              type="text"
              style={{ width: '20ch' }}
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
              <option value="total">Сумма с комиссией</option>
              <option value="client">Клиент</option>
              <option value="paymentStatus">Статус оплаты</option>
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
          {/* Бесконечная прокрутка */}
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
          {/* Пагинация */}
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
          {settings.useInfiniteScroll && (
  <div className="mt-3 d-flex justify-content-center">
    <Button
      variant="outline-primary"
      onClick={() => setCurrentPage(p => p + 1)}
    >
      Загрузить ещё
    </Button>
  </div>
)}

          <ColumnSettings
            settings={settings}
            setSettings={setSettings}
            saveOrdersSettings={saveOrdersSettings}
          />

          {/* Таблица */}
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
                    if (colKey === 'paymentStatus') {
                      return (
                        <td key={colKey}>
                          <PaymentStatusCell
                            order={order}
                            onPaymentStatusChange={handlePaymentStatusChange}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={colKey}>
                        <InlineEditableCell
                          order={order}
                          colKey={colKey}
                          onSave={handleInlineSave}
                        />
                      </td>
                    );
                  })}
                  <td>
                    <div className="d-flex align-items-center">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleEdit(order)}
                        className="me-2"
                      >
                        <FaPencilAlt style={{ fontSize: '16px', color: '#fff' }} />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(order)}
                      >
                        <FaTrash style={{ fontSize: '16px', color: '#fff' }} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Итоги (фильтрованные) */}
          <Alert variant="secondary" className="mt-4">
            <strong>Итоги (фильтрованные):</strong>
            <br />Сумма RUB: {totalRub}
            <br />Сумма USD: {totalUsd}
            <br />Сумма (с комиссией): {totalWithCommission}
          </Alert>

          {/* Кнопки пагинации при обычном режиме */}
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

{/* Модалка подтверждения удаления */}
<Modal
  show={showDeleteModal}
  onHide={() => setShowDeleteModal(false)}
  centered
>
  <Modal.Header closeButton>
    <Modal.Title>Подтвердите удаление</Modal.Title>
  </Modal.Header>

  <Modal.Body>
    Вы уверены, что хотите удалить заказ №{deleteOrder?.orderNumber}?
  </Modal.Body>

  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
      Отмена
    </Button>
    <Button variant="danger" onClick={confirmDeleteOrder}>
      Удалить
    </Button>
  </Modal.Footer>
</Modal>



        {/* Модалка редактирования (старый способ) */}
        {editOrder && (
          <EditModal
            order={editOrder}
            setOrder={setEditOrder}
            onClose={closeEditModal}
            onSave={saveEditOrder}
          />
        )}

        {/* Модалка добавления исполненного заказа */}
        {showAddOrderModal && (
          <AddExecutedOrderModal
            onClose={() => setShowAddOrderModal(false)}
            onOrderAdded={handleOrderAdded}
          />
        )}
      </Container>
    );
  }

  // ======== Рендер режима группировки (по дням/неделям/месяцам) =========
  const grouped = groupOrdersByMode(sorted, viewMode);
  const groupKeys = Object.keys(grouped);

  return (
    <Container fluid className="py-4 bg-light min-vh-100">
      <Container className="bg-white p-4 shadow-sm rounded">
        {/* Шапка со switch'ем и кнопкой "Добавить исполненный заказ" */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
          <Button
            variant="success"
            onClick={() => setShowAddOrderModal(true)}
          >
            Добавить исполненный заказ
          </Button>
        </div>

        <h2 className="mb-4 text-primary">
          Исполненные заказы – {viewMode === 'day' ? 'По дням' : viewMode === 'week' ? 'По неделям' : 'По месяцам'}
        </h2>
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
            <option value="total">Сумма с комиссией</option>
            <option value="client">Клиент</option>
            <option value="paymentStatus">Статус оплаты</option>
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
          const groupOrders = grouped[groupKey];
          const { rub, usd, total } = groupOrders.reduce((acc, o) => {
            acc.rub += (o.price?.rub || 0);
            acc.usd += (o.price?.usd || 0);
            acc.total += (o.price?.total || 0);
            return acc;
          }, { rub: 0, usd: 0, total: 0 });

          return (
            <div key={groupKey} className="mb-4">
              <h4 className="mb-1 text-secondary">{groupKey}</h4>
              <Alert variant="info" className="py-1">
                Итоги: RUB {rub} | USD {usd} | С комиссией {total}
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
                        if (colKey === 'paymentStatus') {
                          return (
                            <td key={colKey}>
                              <PaymentStatusCell
                                order={order}
                                onPaymentStatusChange={handlePaymentStatusChange}
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={colKey}>
                            <InlineEditableCell
                              order={order}
                              colKey={colKey}
                              onSave={handleInlineSave}
                            />
                          </td>
                        );
                      })}
                      <td>
                        <div className="d-flex align-items-center">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleEdit(order)}
                            className="me-2"
                          >
                            <FaPencilAlt style={{ fontSize: '16px', color: '#fff' }} />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(order)}
                          >
                            <FaTrash style={{ fontSize: '16px', color: '#fff' }} />
                          </Button>
                        </div>
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
          <br />Сумма (с комиссией): {totalWithCommission}
        </Alert>
      </Container>

      {/* Модалка редактирования (старый способ) */}
      {editOrder && (
        <EditModal
          order={editOrder}
          setOrder={setEditOrder}
          onClose={closeEditModal}
          onSave={saveEditOrder}
        />
      )}

      {/* Модалка добавления исполненного заказа */}
      {showAddOrderModal && (
        <AddExecutedOrderModal
          onClose={() => setShowAddOrderModal(false)}
          onOrderAdded={handleOrderAdded}
        />
      )}


    </Container>
    
  );
}
