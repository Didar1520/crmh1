/* ───────────────── ColumnSettings.jsx ───────────────── */
import React, { useState } from "react";
import { Card, Button, Form, Row, Col } from "react-bootstrap";

export default function ColumnSettings({ settings, setSettings }) {
  if (!settings) return null;
  const [open, setOpen] = useState(false);

  const toggle = (k) => {
    const st = { ...settings };
    st.columnsVisibility[k] = !st.columnsVisibility[k];
    setSettings(st);
  };

  const move = (k, dir) => {
    const arr = [...settings.columnsOrder];
    const i = arr.indexOf(k);
    if (i === -1) return;
    if (dir === "left" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (dir === "right" && i < arr.length - 1)
      [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    setSettings({ ...settings, columnsOrder: arr });
  };

  const save = () => {
    /* сохраняем в localStorage */
    localStorage.setItem("crmClientCols", JSON.stringify(settings));
    setOpen(false);
  };

  return (
    <Card className="mb-3">
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
                  <Button
                    size="sm"
                    className="me-1"
                    onClick={() => move(k, "left")}
                  >
                    ←
                  </Button>
                  <Button size="sm" onClick={() => move(k, "right")}>
                    →
                  </Button>
                </div>
              </Col>
            ))}
          </Row>
          <Button variant="success" onClick={save}>
            Сохранить
          </Button>
        </Card.Body>
      )}
    </Card>
  );
}
