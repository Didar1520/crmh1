/* ───────────────── ColumnSettings.jsx ───────────────── */
import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Row, Col } from 'react-bootstrap';

/**
 * props:
 *  - settings      { columnsOrder, columnsVisibility, pageSize, useInfiniteScroll }
 *  - setSettings   updater
 *  - storageKey    строка (по умолчанию 'crmCols')
 */
export default function ColumnSettings({ settings, setSettings, storageKey = 'crmCols' }) {
  if (!settings) return null;
  const [open, setOpen] = useState(false);

  // ―― localStorage helpers ――
  const saveLS   = (st) => localStorage.setItem(storageKey, JSON.stringify(st));
  const clearLS  = ()   => localStorage.removeItem(storageKey);
  const loadLS   = ()   => JSON.parse(localStorage.getItem(storageKey) || 'null');

  /* при первом рендере берём сохранённые настройки (если родитель не передал) */
  useEffect(() => {
    if (!settings) return;
    const saved = loadLS();
    if (saved) setSettings(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (k) => {
    const st = { ...settings };
    st.columnsVisibility[k] = !st.columnsVisibility[k];
    setSettings(st);
  };

  const move = (k, dir) => {
    const arr = [...settings.columnsOrder];
    const i = arr.indexOf(k);
    if (i === -1) return;
    if (dir === 'left'  && i > 0)               [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (dir === 'right' && i < arr.length - 1)  [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    setSettings({ ...settings, columnsOrder: arr });
  };

  const save = () => {
    saveLS(settings);
    setOpen(false);
  };

  const reset = () => {
    clearLS();
    window.location.reload();
  };

  return (
    <Card className="mb-3">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <Button variant="link" onClick={() => setOpen(!open)} aria-expanded={open}>
          Настройка столбцов
        </Button>
        <Button variant="outline-danger" size="sm" onClick={reset}>
          Сбросить
        </Button>
      </Card.Header>

      {open && (
        <Card.Body>
          <Row>
            {settings.columnsOrder.map((k) => (
              <Col md={4} key={k} className="mb-2">
                <Form.Check
                  type="checkbox"
                  label={k}
                  checked={settings.columnsVisibility[k]}
                  onChange={() => toggle(k)}
                />
                <div className="mt-1">
                  <Button size="sm" className="me-1" onClick={() => move(k, 'left')}>←</Button>
                  <Button size="sm" onClick={() => move(k, 'right')}>→</Button>
                </div>
              </Col>
            ))}
          </Row>
          <Button variant="success" onClick={save}>Сохранить</Button>
        </Card.Body>
      )}
    </Card>
  );
}
