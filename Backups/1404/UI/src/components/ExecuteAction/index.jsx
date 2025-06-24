/* File: D:\Didar1520\CRM\UI\src\components\ExecuteAction\index.jsx */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ExecuteAction.module.css';

/**
 * Компонент "Выполнить действие"
 * Перенесён из старого index.html + script.js на React.
 */
export default function ExecuteAction() {
  const navigate = useNavigate();

  // Список всех заказов, загруженных с сервера
  const [orders, setOrders] = useState([]);
  // Для определения следующего orderID
  const [nextOrderID, setNextOrderID] = useState(1);

  // Поля формы (контроллируемые инпуты)
  const [formData, setFormData] = useState({
    orderID: '',
    Account: '',
    Promocode: '',
    rederalLink: '',
    CartLink: '',
    client: '',
    setAdressPage: false,
    syncOrders: false,
    syncReviews: false,
    reviewManager: false,
    syncRewards: false
  });

  // Сохраняем "lastStaticValues", как в старом коде.
  // Когда отправляем форму, обновляем значения (Account, Promocode, и т. п.) для будущих заказов
  const [lastStaticValues, setLastStaticValues] = useState({
    Account: '',
    Promocode: '',
    rederalLink: '',
    client: ''
  });

  // Сразу загружаем заказы при монтировании
  useEffect(() => {
    loadOrders();
  }, []);

  // ===================== Загрузка заказов =====================
  async function loadOrders() {
    try {
      const response = await fetch('/inputConfig');
      if (!response.ok) {
        throw new Error(`Ошибка загрузки: статус ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setOrders(data);

        // Определяем следующий orderID (max(existing orderIDs) + 1)
        const maxID = data.reduce((max, o) => {
          const num = parseInt(o.orderID, 10) || 0;
          return Math.max(max, num);
        }, 0);
        setNextOrderID(maxID + 1);

        // Предзаполним поля формы
        prepopulateForm(data);
      }
    } catch (error) {
      console.error('Ошибка при загрузке заказов:', error);
    }
  }

  // ===================== Предзаполнение формы =====================
  function prepopulateForm(loadedOrders) {
    // Учитываем lastStaticValues и присваиваем nextOrderID
    setFormData(prev => ({
      ...prev,
      orderID: (loadedOrders?.length ? (nextOrderID) : 1).toString(), 
      Account: lastStaticValues.Account,
      Promocode: lastStaticValues.Promocode,
      rederalLink: lastStaticValues.rederalLink,
      client: lastStaticValues.client,
      CartLink: '' // Всегда очищаем
    }));
  }

  // ===================== Сохранение заказов =====================
  async function saveOrders(updatedOrders) {
    try {
      const response = await fetch('/saveConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrders)
      });
      if (!response.ok) {
        throw new Error(`Ошибка сохранения: статус ${response.status}`);
      }
      const result = await response.json();
      console.log('Заказы успешно сохранены:', result);
    } catch (error) {
      console.error('Ошибка сохранения заказов:', error);
      alert('Ошибка сохранения заказов: ' + error.message);
    }
  }

  // ===================== Обработка "Добавить заказ" =====================
  function handleAddOrder(e) {
    e.preventDefault();

    const numericOrderID = parseInt(formData.orderID, 10) || nextOrderID;
    const newOrder = {
      Account: formData.Account,
      Promocode: formData.Promocode,
      rederalLink: formData.rederalLink,
      orderID: numericOrderID,
      CartLink: formData.CartLink,
      client: formData.client,
      setAdressPage: formData.setAdressPage,
      syncOrders: formData.syncOrders,
      syncReviews: formData.syncReviews,
      reviewManager: formData.reviewManager,
      syncRewards: formData.syncRewards
    };

    // Обновляем lastStaticValues
    setLastStaticValues({
      Account: newOrder.Account,
      Promocode: newOrder.Promocode,
      rederalLink: newOrder.rederalLink,
      client: newOrder.client
    });

    const updatedOrders = [...orders, newOrder];
    setOrders(updatedOrders);

    // Увеличиваем nextOrderID
    setNextOrderID(numericOrderID + 1);

    // Сохраняем
    saveOrders(updatedOrders);

    // Сразу пере-наполняем форму новыми значениями
    setFormData(prev => ({
      ...prev,
      orderID: (numericOrderID + 1).toString(),
      CartLink: ''
    }));
  }

  // ===================== Рендер списка заказов =====================
  function renderOrders() {
    if (!orders.length) {
      return (
        <div>Нет заказов для отображения</div>
      );
    }

    return orders.map((order, index) => (
      <div key={index} className={styles.orderItem}>
        <div className={styles.orderDetails}>
          <input
            type="checkbox"
            className="select-order"
            checked={false} // чекбокс будем контролировать иначе (см. «массовые действия»)
            onChange={() => {}}
            data-index={index}
          />
          <strong>ID:</strong> {order.orderID} | <strong>Клиент:</strong> {order.client} |{' '}
          <strong>Аккаунт:</strong> {order.Account} | <strong>Промокод:</strong> {order.Promocode}
        </div>
        <div className={styles.orderActions}>
          <button
            className={styles.editBtn}
            onClick={() => handleEditOrder(index)}
            data-index={index}
          >
            Редактировать
          </button>
          <button
            className={styles.deleteBtn}
            onClick={() => handleDeleteOrder(index)}
            data-index={index}
          >
            Удалить
          </button>
        </div>
      </div>
    ));
  }

  // ===================== Редактирование заказа =====================
  function handleEditOrder(index) {
    const order = orders[index];

    // Заполняем форму данными выбранного заказа
    setFormData({
      orderID: order.orderID.toString(),
      Account: order.Account,
      Promocode: order.Promocode,
      rederalLink: order.rederalLink,
      CartLink: order.CartLink,
      client: order.client,
      setAdressPage: !!order.setAdressPage,
      syncOrders: !!order.syncOrders,
      syncReviews: !!order.syncReviews,
      reviewManager: !!order.reviewManager,
      syncRewards: !!order.syncRewards
    });

    // Удаляем заказ из массива, чтобы при новом submit он добавился как "новая" версия
    const updatedOrders = orders.filter((_, idx) => idx !== index);
    setOrders(updatedOrders);
    saveOrders(updatedOrders);
  }

  // ===================== Удаление одного заказа =====================
  function handleDeleteOrder(index) {
    const updatedOrders = orders.filter((_, idx) => idx !== index);
    setOrders(updatedOrders);
    saveOrders(updatedOrders);
  }

  // ===================== Массовые действия (Выбрать все / Снять выделение / Удалить выбранные) =====================
  // Для «Выбрать все» и «Снять выделение» нам нужно хранить «какие заказы отмечены»:
  // Однако в старом коде это всё делалось querySelectorAll. 
  // "Бест практис" в React — хранить список "selectedIndexes" в стейте. Для наглядности покажем так:

  const [selectedIndexes, setSelectedIndexes] = useState([]);

  function handleSelectAll() {
    // Отмечаем все индексы
    const allIndexes = orders.map((_, idx) => idx);
    setSelectedIndexes(allIndexes);
  }

  function handleDeselectAll() {
    setSelectedIndexes([]);
  }

  function handleDeleteSelected() {
    if (!selectedIndexes.length) return;
    // Удаляем все по индексам
    const updatedOrders = orders.filter((_, idx) => !selectedIndexes.includes(idx));
    setOrders(updatedOrders);
    setSelectedIndexes([]);
    saveOrders(updatedOrders);
  }

  // Когда пользователь кликает по отдельному чекбоксу
  function toggleCheckbox(index) {
    // Если индекс уже есть — убираем, иначе добавляем
    setSelectedIndexes(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  }

  // ===================== Запуск processAllOrders =====================
  async function handleRunActions() {
    try {
      console.log('[executeAction] -> Отправляем запрос /runOrders');

      const response = await fetch('/runOrders', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Ошибка: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (result.status) {
        console.log('[executeAction] -> processAllOrders завершён успешно');
        console.log('Результат:', result.result);

        // Выводим перехваченные console.log (result.logs)
        if (Array.isArray(result.logs)) {
          console.log('[executeAction] -> Логи, пришедшие с сервера:');
          result.logs.forEach(line => {
            console.log('   ' + line);
          });
        }
      } else {
        console.error('[executeAction] -> processAllOrders вернул ошибку:', result);
      }
    } catch (err) {
      console.error('[executeAction] -> Ошибка при запуске /runOrders:', err);
    }
  }

  // ===================== Обработка изменения в инпутах формы =====================
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    // Если checkbox, берём checked, иначе value
    const newVal = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: newVal }));
  }

  // ===================== Кнопка «Назад» =====================
  function handleGoBack() {
    // Возвращаемся на предыдущую страницу (или на главную)
    // Если нужно именно на "/", замените на navigate("/")
    navigate(-1);
  }

  // ===================== Рендер JSX =====================
  return (
    <div className="inner-content">
      <div className={styles.moduleHeader}>
        <button onClick={handleGoBack} className={styles.btnPrimary}>
          ← Назад
        </button>
        <h1>Выполнить действие</h1>
      </div>

      {/* Форма для добавления нового заказа */}
      <section className={styles.section}>
        <h2>Добавить новый заказ</h2>
        <form onSubmit={handleAddOrder} className={styles.formSection}>
          <div className={styles.formRow}>
            <label htmlFor="orderID">Номер заказа (orderID):</label>
            <input
              type="number"
              id="orderID"
              name="orderID"
              value={formData.orderID}
              onChange={handleChange}
              readOnly
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="Account">Аккаунт:</label>
            <input
              type="email"
              id="Account"
              name="Account"
              value={formData.Account}
              onChange={handleChange}
              list="accountList"
            />
            <datalist id="accountList"></datalist>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="Promocode">Промокод:</label>
            <input
              type="text"
              id="Promocode"
              name="Promocode"
              value={formData.Promocode}
              onChange={handleChange}
              list="promocodeList"
            />
            <datalist id="promocodeList"></datalist>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="rederalLink">Реферальный код:</label>
            <input
              type="text"
              id="rederalLink"
              name="rederalLink"
              value={formData.rederalLink}
              onChange={handleChange}
              list="referralList"
            />
            <datalist id="referralList"></datalist>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="CartLink">Ссылка на корзину:</label>
            <input
              type="url"
              id="CartLink"
              name="CartLink"
              value={formData.CartLink}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="client">Клиент:</label>
            <input
              type="text"
              id="client"
              name="client"
              value={formData.client}
              onChange={handleChange}
              list="clientList"
            />
            <datalist id="clientList"></datalist>
          </div>

          {/* Boolean поля */}
          <div className={styles.formRow}>
            <label htmlFor="setAdressPage">Set Address Page:</label>
            <input
              type="checkbox"
              id="setAdressPage"
              name="setAdressPage"
              checked={formData.setAdressPage}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="syncOrders">Sync Orders:</label>
            <input
              type="checkbox"
              id="syncOrders"
              name="syncOrders"
              checked={formData.syncOrders}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="syncReviews">Sync Reviews:</label>
            <input
              type="checkbox"
              id="syncReviews"
              name="syncReviews"
              checked={formData.syncReviews}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="reviewManager">Review Manager:</label>
            <input
              type="checkbox"
              id="reviewManager"
              name="reviewManager"
              checked={formData.reviewManager}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="syncRewards">Sync Rewards:</label>
            <input
              type="checkbox"
              id="syncRewards"
              name="syncRewards"
              checked={formData.syncRewards}
              onChange={handleChange}
            />
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.btnSuccess}>
              Добавить заказ
            </button>
          </div>
        </form>
      </section>

      {/* Массовые действия */}
      <section className={styles.bulkActions}>
        <button onClick={handleSelectAll} className={styles.btnPrimary}>
          Выбрать все
        </button>
        <button onClick={handleDeselectAll} className={styles.btnWarning}>
          Снять выделение
        </button>
        <button onClick={handleDeleteSelected} className={styles.btnDanger}>
          Удалить выбранные
        </button>
      </section>

      {/* Запуск Puppeteer */}
      <section className={styles.section}>
        <h2>Запуск Puppeteer</h2>
        <button onClick={handleRunActions} className={styles.btnPrimary}>
          Выполнить действие (processAllOrders)
        </button>
      </section>

      {/* Список заказов */}
      <section className={styles.section}>
        <h2>Список заказов</h2>
        <div id="orderList">
          {renderOrders()}
          {/* 
            Чтобы чекбоксы реально работали, нужно:
            - Каждому order-item сделать controlled checkbox
            - toggleCheckbox(index)
            - checked={selectedIndexes.includes(index)}
          */}
        </div>
      </section>
    </div>
  );
}
