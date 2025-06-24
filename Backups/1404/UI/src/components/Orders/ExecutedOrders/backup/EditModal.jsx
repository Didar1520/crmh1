// Путь: /UI/src/components/Orders/ExecutedOrders/EditModal.jsx
import React from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

/**
 * Модальное окно EditModal
 * ------------------------
 * Редактирование заказа через React‑Bootstrap Modal.
 */
export default function EditModal({ order, setOrder, onClose, onSave }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('price.')) {
      const field = name.split('.')[1];
      setOrder((prev) => ({
        ...prev,
        price: { ...prev.price, [field]: Number(value) || 0 },
      }));
    } else {
      setOrder((prev) => ({ ...prev, [name]: value }));
    }
  };

  return (
    <Modal show onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Редактирование заказа</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="row">
          <Form.Group className="mb-3 col-6">
            <Form.Label>Номер заказа</Form.Label>
            <Form.Control
              type="text"
              name="orderNumber"
              value={order.orderNumber || ''}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-6">
            <Form.Label>Трек-код</Form.Label>
            <Form.Control
              type="text"
              name="trackCode"
              value={order.trackCode || ''}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3 col-6">
            <Form.Label>Дата</Form.Label>
            <Form.Control
              type="text"
              name="date"
              value={order.date || ''}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-6">
            <Form.Label>Курс iHerb</Form.Label>
            <Form.Control
              type="number"
              name="rate"
              value={order.rate || 0}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3 col-6">
            <Form.Label>Курс Bybit</Form.Label>
            <Form.Control
              type="number"
              name="bybitRate"
              value={order.bybitRate || 0}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-6">
            <Form.Label>Клиент</Form.Label>
            <Form.Control
              type="text"
              name="client"
              value={order.client || ''}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3 col-6">
            <Form.Label>Способ оплаты</Form.Label>
            <Form.Control
              type="text"
              name="paymentMethod"
              value={order.paymentMethod || ''}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-6">
            <Form.Label>Ссылка на корзину</Form.Label>
            <Form.Control
              type="text"
              name="cartLink"
              value={order.cartLink || ''}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3 col-6">
            <Form.Label>Адрес</Form.Label>
            <Form.Control
              type="text"
              name="deliveryAddress"
              value={order.deliveryAddress || ''}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-6">
            <Form.Label>Промокод</Form.Label>
            <Form.Control
              type="text"
              name="promoCodeUsed"
              value={order.promoCodeUsed || ''}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3 col-6">
            <Form.Label>Реф. код</Form.Label>
            <Form.Control
              type="text"
              name="referralCodeUsed"
              value={order.referralCodeUsed || ''}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-6">
            <Form.Label>Аккаунт</Form.Label>
            <Form.Control
              type="text"
              name="orderAccount"
              value={order.orderAccount || ''}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3 col-4">
            <Form.Label>Цена (RUB)</Form.Label>
            <Form.Control
              type="number"
              name="price.rub"
              value={order.price?.rub || 0}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-4">
            <Form.Label>Цена (USD)</Form.Label>
            <Form.Control
              type="number"
              name="price.usd"
              value={order.price?.usd || 0}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3 col-4">
            <Form.Label>С комиссией</Form.Label>
            <Form.Control
              type="number"
              name="price.commission"
              value={order.price?.commission || 0}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3 col-6">
            <Form.Label>Вознаграждения</Form.Label>
            <Form.Control
              type="number"
              name="rewardsUsed"
              value={order.rewardsUsed || 0}
              onChange={handleChange}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={onSave}>
          Сохранить
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
