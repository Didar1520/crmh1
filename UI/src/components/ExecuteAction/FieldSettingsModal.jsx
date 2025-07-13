// ===== File: UI/src/components/ExecuteAction/FieldSettingsModal.jsx =====
import { useState } from 'react';
import { Modal, Button, Form, Table, Stack } from 'react-bootstrap';

// Добавили тип "object" для сложных полей вроде captureOrders
const TYPES = ['text', 'number', 'url', 'date', 'boolean', 'object'];

export default function FieldSettingsModal({ show, schema, onSave, onHide }) {
  const [draft, setDraft] = useState(schema);

  const update = (i, key, val) =>
    setDraft((d) => d.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)));

  const add = () => setDraft((d) => [...d, { name: '', type: 'text' }]);
  const del = (i) => setDraft((d) => d.filter((_, idx) => idx !== i));

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Настройка полей</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Table bordered size="sm">
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {draft.map((f, i) => (
              <tr key={i}>
                <td>
                  <Form.Control
                    size="sm"
                    value={f.name}
                    onChange={(e) => update(i, 'name', e.target.value)}
                  />
                </td>
                <td>
                  <Form.Select
                    size="sm"
                    value={f.type}
                    onChange={(e) => update(i, 'type', e.target.value)}
                  >
                    {TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Form.Select>
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => del(i)}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Button size="sm" onClick={add}>
          + Поле
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Stack direction="horizontal" gap={2}>
          <Button variant="secondary" onClick={onHide}>
            Отмена
          </Button>
          <Button onClick={() => onSave(draft)}>Сохранить</Button>
        </Stack>
      </Modal.Footer>
    </Modal>
  );
}
