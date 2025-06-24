import React, { useState, useEffect } from "react";
import { Modal, Button, Table, Form, Row, Col } from "react-bootstrap";

export default function DebtModal({ client, onClose, onSave }) {
  // Draft клиента
  const [draft, setDraft] = useState(() => {
    const copy = JSON.parse(JSON.stringify(client));
    if (!copy.notPaidOrders) copy.notPaidOrders = {};
    return copy;
  });
  // ID новой строки для фокуса
  const [newRowId, setNewRowId] = useState(null);

  // Форматирование даты по blur
  const fmtDate = (s) => {
    const digits = s.replace(/\D/g, "");
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

  // Сумма всех заказов
  const ordersTotal = Object.values(draft.notPaidOrders).reduce(
    (sum, o) => sum + (Number(o.sum) || 0),
    0
  );

  // Пересчитать долг
  useEffect(() => {
    const pos = draft.balance?.positiveBalance || 0;
    setDraft((d) => ({ ...d, balance: { ...d.balance, debt: ordersTotal + pos } }));
  }, [ordersTotal]);

  // Добавить строку и установить фокус на ID
  const addRow = () => {
    let n = 1;
    while (draft.notPaidOrders[`new_${n}`]) n++;
    const id = `new_${n}`;
    draft.notPaidOrders[id] = { sum: "", date: "" };
    setDraft({ ...draft });
    setNewRowId(id);
  };

  // Обновить поле строки
  const updateRow = (id, field, value) => {
    const obj = { ...draft.notPaidOrders[id] };
    obj[field] = value;
    setDraft({ ...draft, notPaidOrders: { ...draft.notPaidOrders, [id]: obj } });
  };

  // Переименовать ключ (ID заказа)
  const updateId = (oldId, newId) => {
    if (!newId.trim() || draft.notPaidOrders[newId]) return;
    const obj = draft.notPaidOrders[oldId];
    const copy = { ...draft.notPaidOrders };
    delete copy[oldId];
    copy[newId] = obj;
    setDraft({ ...draft, notPaidOrders: copy });
  };

  // Удалить строку
  const deleteRow = (id) => {
    const copy = { ...draft.notPaidOrders };
    delete copy[id];
    setDraft({ ...draft, notPaidOrders: copy });
  };

  // Сохранить
  const handleSave = () => {
    // Преобразовать суммы в числа
    const copy = JSON.parse(JSON.stringify(draft));
    Object.entries(copy.notPaidOrders).forEach(([k, o]) => {
      o.sum = Number(o.sum) || 0;
    });
    onSave(copy);
    onClose();
  };

  return (
    <Modal show onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Долги — {client.name}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Общий долг */}
        <Row className="mb-3">
          <Col md={4}>
            <strong>Общий долг:</strong>
          </Col>
          <Col md={8}>
            <Form.Control
              type="number"
              name="totalDebt"
              value={draft.balance?.debt ?? 0}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  balance: { ...draft.balance, debt: Number(e.target.value) || 0 },
                })
              }
            />
          </Col>
        </Row>

        {/* Список заказов */}
        <Button size="sm" className="mb-2" onClick={addRow}>
          + Добавить заказ
        </Button>

        <Table bordered size="sm">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>№ заказа</th>
              <th style={{ width: "20%" }}>Сумма</th>
              <th>Дата</th>
              <th style={{ width: "5%" }} />
            </tr>
          </thead>
          <tbody>
            {Object.entries(draft.notPaidOrders).map(([id, o]) => (
              <tr key={id}>
                {/* ID заказа */}
                <td>
                  <Form.Control
                    size="sm"
                    name="orderId"
                    defaultValue={id}
                    autoFocus={id === newRowId}
                    onBlur={(e) => updateId(id, e.target.value.trim())}
                  />
                </td>

                {/* Сумма */}
                <td>
                  <Form.Control
                    size="sm"
                    name="orderSum"
                    type="number"
                    value={o.sum}
                    placeholder=""
                    onChange={(e) => updateRow(id, "sum", e.target.value)}
                  />
                </td>

                {/* Дата */}
                <td>
                  <Form.Control
                    size="sm"
                    name="orderDate"
                    placeholder="DD-MM-YYYY HH:MM"
                    value={o.date}
                    onChange={(e) => updateRow(id, "date", e.target.value)}
                    onBlur={(e) => updateRow(id, "date", fmtDate(e.target.value))}
                  />
                </td>

                {/* Удалить */}
                <td>
                  <Button size="sm" variant="danger" onClick={() => deleteRow(id)}>
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
