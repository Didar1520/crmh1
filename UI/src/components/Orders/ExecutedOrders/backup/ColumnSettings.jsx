// Путь: /UI/src/components/Orders/ExecutedOrders/ColumnSettings.jsx
import React, { useState } from 'react';
import { Card, Button, Form } from 'react-bootstrap';

/**
 * Компонент ColumnSettings
 * ------------------------
 * Управляет видимостью и порядком столбцов.
 * Сохранение по кнопке "Сохранить настройки".
 */
export default function ColumnSettings({ settings, setSettings, saveOrdersSettings }) {
  if (!settings) return null;

  const [open, setOpen] = useState(false);

  const toggleColumnVisibility = (colKey) => {
    const newSt = { ...settings };
    newSt.columnsVisibility[colKey] = !newSt.columnsVisibility[colKey];
    setSettings(newSt);
  };

  const moveColumn = (colKey, direction) => {
    const order = [...settings.columnsOrder];
    const idx = order.indexOf(colKey);
    if (idx === -1) return;

    if (direction === 'left' && idx > 0) {
      [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    } else if (direction === 'right' && idx < order.length - 1) {
      [order[idx + 1], order[idx]] = [order[idx], order[idx + 1]];
    }

    const newSt = { ...settings, columnsOrder: order };
    setSettings(newSt);
  };

  const handleSave = () => {
    saveOrdersSettings(settings);
  };

  return (
    <Card className="my-3">
      <Card.Header>
        <Button
          variant="link"
          onClick={() => setOpen(!open)}
          aria-controls="column-settings-collapse"
          aria-expanded={open}
        >
          Настройка столбцов
        </Button>
      </Card.Header>
      {open && (
        <Card.Body>
          {settings.columnsOrder.map((colKey) => (
            <div key={colKey} className="mb-3">
              <Form.Check
                type="checkbox"
                id={`checkbox-${colKey}`}
                label={colKey}
                checked={settings.columnsVisibility[colKey]}
                onChange={() => toggleColumnVisibility(colKey)}
              />
              <div className="mt-1">
                <Button variant="primary" size="sm" onClick={() => moveColumn(colKey, 'left')} className="me-2">
                  ←
                </Button>
                <Button variant="primary" size="sm" onClick={() => moveColumn(colKey, 'right')}>
                  →
                </Button>
              </div>
            </div>
          ))}
          <Button variant="success" onClick={handleSave}>
            Сохранить настройки
          </Button>
        </Card.Body>
      )}
    </Card>
  );
}
