// 📁 UI/src/components/Accounts/AddAccountModal.jsx
import React, { useState } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';

export default function AddAccountModal({ onClose, onSave }) {
  const [f, setF] = useState({ email: '', pass: '', refCode: '', creditCards: '' });
  const ch = (e) => {
    const { name, value } = e.target;
    setF({ ...f, [name]: value });
  };

  const save = () => {
    const acc = {
      email: f.email.trim(),
      pass: f.pass.trim(),
      refCode: f.refCode.trim(),
      allow: true,
      cards: { creditCards: f.creditCards.split(',').map((s) => s.trim()).filter(Boolean) },
      reviews: {
        productsWithoutReviews: 0,
        productsWithReviews: 0,
        totalProducts: 0,
      },
      rewards: {
        availableRewardsSummary: {
          totalAvailableAmount: 0,
          pendingAmount: 0,
          availableRewardsDateExpired: null,
          allTimeEarnedAmount: 0,
        },
      },
    };
    onSave(acc);
    onClose();
  };

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Добавить аккаунт</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-2">
          <Form.Label>E‑mail</Form.Label>
          <Form.Control name="email" value={f.email} onChange={ch} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Пароль</Form.Label>
          <Form.Control name="pass" value={f.pass} onChange={ch} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Ref код</Form.Label>
          <Form.Control name="refCode" value={f.refCode} onChange={ch} />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Карты (4 последние цифры, через запятую)</Form.Label>
          <Form.Control name="creditCards" value={f.creditCards} onChange={ch} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Отмена</Button>
        <Button variant="success" onClick={save}>Добавить</Button>
      </Modal.Footer>
    </Modal>
  );
}
