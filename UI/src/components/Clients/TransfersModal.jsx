// 📁 UI/src/components/Clients/TransfersModal.jsx

import React, { useState } from 'react';
import { Modal, Button, Table, Form } from 'react-bootstrap';

export default function TransfersModal({ client, onClose, onSave }) {
  // Локальный черновик клиента
  const [draft, setDraft] = useState(() => {
    const copy = JSON.parse(JSON.stringify(client));
    if (!copy.safekeepingMoney) copy.safekeepingMoney = { totalCollected: 0, transfers: [] };
    if (!Array.isArray(copy.safekeepingMoney.transfers))
      copy.safekeepingMoney.transfers = [];
    // Инициализация totalCollected, если нет
    copy.safekeepingMoney.totalCollected = copy.safekeepingMoney.transfers.reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0
    );
    return copy;
  });

  // Форматирование даты по blur
  const fmtDate = (s) => {
    const digits = s.replace(/\D/g, '');
    if (digits.length >= 12) {
      const d = digits.slice(0, 8);
      const t = digits.slice(8, 12);
      return `${d.slice(0,2)}-${d.slice(2,4)}-${d.slice(4,8)} ${t.slice(0,2)}:${t.slice(2,4)}`;
    } else if (digits.length >= 8) {
      const d = digits.slice(0, 8);
      return `${d.slice(0,2)}-${d.slice(2,4)}-${d.slice(4,8)}`;
    }
    return s;
  };

  // Добавить новую запись
  const addTransfer = () => {
    const newTransfer = { sender: '', amount: '', date: '' };
    const transfers = [...draft.safekeepingMoney.transfers, newTransfer];
    const total = transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    setDraft({
      ...draft,
      safekeepingMoney: { ...draft.safekeepingMoney, transfers, totalCollected: total },
    });
  };

  // Обновить запись
  const updateTransfer = (idx, field, value) => {
    const transfers = [...draft.safekeepingMoney.transfers];
    transfers[idx] = { ...transfers[idx], [field]: value };
    const total = transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    setDraft({
      ...draft,
      safekeepingMoney: { ...draft.safekeepingMoney, transfers, totalCollected: total },
    });
  };

  // Удалить запись
  const deleteTransfer = (idx) => {
    const transfers = draft.safekeepingMoney.transfers.filter((_, i) => i !== idx);
    const total = transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    setDraft({
      ...draft,
      safekeepingMoney: { ...draft.safekeepingMoney, transfers, totalCollected: total },
    });
  };

  // Сохранить и вернуть обновлённого клиента
  const handleSave = () => {
    const copy = JSON.parse(JSON.stringify(draft));
    // Убедимся, что totalCollected правильный
    copy.safekeepingMoney.totalCollected = copy.safekeepingMoney.transfers.reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0
    );
    // Форматировать даты
    copy.safekeepingMoney.transfers = copy.safekeepingMoney.transfers.map((t) => ({
      ...t,
      date: fmtDate(t.date),
      amount: Number(t.amount) || 0,
    }));
    onSave(copy);
    onClose();
  };

  return (
    <Modal show onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Переводы агенту {client.name}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="mb-3">
          <strong>Сумма у агента: {draft.safekeepingMoney.totalCollected}</strong>
        </div>
        <Button size="sm" className="mb-2" onClick={addTransfer}>
          + Добавить перевод
        </Button>
        <Table bordered size="sm">
          <thead>
            <tr>
              <th>Отправитель</th>
              <th>Сумма</th>
              <th>Дата</th>
              <th style={{ width: '5%' }} />
            </tr>
          </thead>
          <tbody>
            {draft.safekeepingMoney.transfers.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center">
                  Переводов нет
                </td>
              </tr>
            )}
            {draft.safekeepingMoney.transfers.map((t, i) => (
              <tr key={i}>
                <td>
                  <Form.Control
                    size="sm"
                    name="sender"
                    value={t.sender}
                    onChange={(e) => updateTransfer(i, 'sender', e.target.value)}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    name="amount"
                    type="number"
                    value={t.amount}
                    onChange={(e) => updateTransfer(i, 'amount', e.target.value)}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    name="date"
                    placeholder="DD-MM-YYYY HH:MM"
                    value={t.date}
                    onChange={(e) => updateTransfer(i, 'date', e.target.value)}
                    onBlur={(e) => updateTransfer(i, 'date', fmtDate(e.target.value))}
                  />
                </td>
                <td>
                  <Button size="sm" variant="danger" onClick={() => deleteTransfer(i)}>
                    ×
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="success" onClick={handleSave}>
          Сохранить
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
