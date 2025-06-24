// 📁 UI/src/components/Accounts/ColumnSettings.jsx
// Отдельный компонент настройки столбцов – не влияет на «клиентов»
import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';

export default function ColumnSettings({ settings, setSettings, storageKey, headMap = {}, onSaveToStorage }) {
  const [local, setLocal] = useState(JSON.parse(JSON.stringify(settings)));

  const toggle = (k) =>
    setLocal({
      ...local,
      columnsVisibility: { ...local.columnsVisibility, [k]: !local.columnsVisibility[k] },
    });

  const move = (k, dir) => {
    const idx = local.columnsOrder.indexOf(k);
    if (idx < 0) return;
    const arr = [...local.columnsOrder];
    arr.splice(idx, 1);
    arr.splice(Math.max(0, idx + dir), 0, k);
    setLocal({ ...local, columnsOrder: arr });
  };

  const save = () => {
    setSettings(local);
    (onSaveToStorage || ((v) => localStorage.setItem(storageKey, JSON.stringify(v))))(local);
  };

  return (
    <div className="border p-3 rounded mb-4">
      <h5 className="mb-3">Настройка столбцов</h5>
      <div className="d-flex flex-wrap">
        {local.columnsOrder.map((k) => (
          <div key={k} className="me-4 mb-2" style={{ minWidth: '220px' }}>
            <Form.Check
              type="checkbox"
              label={headMap[k] || k}
              checked={local.columnsVisibility[k]}
              onChange={() => toggle(k)}
            />
            <div className="d-flex gap-1 mt-1">
              <Button size="sm" variant="primary" onClick={() => move(k, -1)}>
                ←
              </Button>
              <Button size="sm" variant="primary" onClick={() => move(k, 1)}>
                →
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button variant="success" onClick={save}>
        Сохранить
      </Button>
    </div>
  );
}
