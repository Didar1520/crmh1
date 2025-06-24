import React, { useState, useEffect } from 'react';
import { Card, Button, Form } from 'react-bootstrap';

/**
 * Компонент ColumnSettings
 * ------------------------
 * Управляет видимостью и порядком столбцов.
 * Сохранение по кнопке "Сохранить настройки" и авто-закрытие.
 */
export default function ColumnSettings({ settings, setSettings, saveOrdersSettings }) {
  if (!settings) return null;

  const [open, setOpen] = useState(false);
  const [columnsCount, setColumnsCount] = useState(2);

  // Определяем число колонок в зависимости от ширины экрана
  useEffect(() => {
    function updateColumns() {
      const width = window.innerWidth;
      if (width >= 2400) setColumnsCount(3);
      else if (width >= 1280) setColumnsCount(2);
      else setColumnsCount(1);
    }
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

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
    setOpen(false);
  };

  return (
    <Card className="my-3">
      <Card.Header>
        <Button
          variant="link"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          Настройка столбцов
        </Button>
      </Card.Header>

      {open && (
        <Card.Body
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columnsCount}, 1fr)`,
            gap: '1rem'
          }}
        >
          {settings.columnsOrder.map((colKey) => (
            <div key={colKey}>
              <Form.Check
                type="checkbox"
                id={`checkbox-${colKey}`}
                label={colKey}
                checked={settings.columnsVisibility[colKey]}
                onChange={() => toggleColumnVisibility(colKey)}
              />
              <div className="mt-1 d-flex gap-2">
                <Button variant="primary" size="sm" onClick={() => moveColumn(colKey, 'left')}>
                  ←
                </Button>
                <Button variant="primary" size="sm" onClick={() => moveColumn(colKey, 'right')}>
                  →
                </Button>
              </div>
            </div>
          ))}

          <Button variant="success" onClick={handleSave} className="mt-2" colSpan={columnsCount}>
            Сохранить настройки
          </Button>
        </Card.Body>
      )}
    </Card>
  );
}
