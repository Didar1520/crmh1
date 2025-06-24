/* ───────────────── ClientModal.jsx ───────────────── */
import React, { useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";

export default function ClientModal({
  client = {},
  onClose,
  onSave,
  nextId = null,
}) {
  const isEdit = !!client.clientId;

  const [f, setF] = useState({
    name: client.name || "",
    telegramId: client.telegramId || "",
    city: client.city || "",
    clientId: client.clientId || nextId || Date.now(),
    phoneNumbers: client.phoneNumbers?.join(", ") || "",
    ordersComission: client.ordersComission || 0,
    transferAgent: client.transferAgent || false,
    positiveBalance: client.balance?.positiveBalance || 0,
    debt: client.balance?.debt || 0,
    totalCollected: client.safekeepingMoney?.totalCollected || 0,
  });

  const ch = (e) => {
    const { name, value, checked, type } = e.target;
    setF({ ...f, [name]: type === "checkbox" ? checked : value });
  };

  /* сохранить */
  const save = () => {
    const obj = {
      ...client,
      name: f.name.trim(),
      telegramId: f.telegramId.trim(),
      city: f.city.trim(),
      clientId: Number(f.clientId),
      phoneNumbers: f.phoneNumbers
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      ordersComission: Number(f.ordersComission) || 0,
      transferAgent: f.transferAgent,
      balance: {
        positiveBalance: Number(f.positiveBalance) || 0,
        debt: Number(f.debt) || 0,
      },
      ...(f.transferAgent && {
        safekeepingMoney: {
          totalCollected: Number(f.totalCollected) || 0,
          transfers: client.safekeepingMoney?.transfers || [],
        },
      }),
    };

    onSave(obj);
    onClose();
  };

  return (
    <Modal show onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          {isEdit ? "Редактировать" : "Добавить"} клиента
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* имя / telegram */}
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Имя</Form.Label>
              <Form.Control name="name" value={f.name} onChange={ch} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Telegram</Form.Label>
              <Form.Control
                name="telegramId"
                value={f.telegramId}
                onChange={ch}
              />
            </Form.Group>
          </Col>
        </Row>

        {/* город / ID */}
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Город</Form.Label>
              <Form.Control name="city" value={f.city} onChange={ch} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>ID клиента</Form.Label>
              <Form.Control
                type="number"
                name="clientId"
                value={f.clientId}
                onChange={ch}
                disabled={isEdit}
              />
            </Form.Group>
          </Col>
        </Row>

        {/* телефоны */}
        <Form.Group className="mb-3">
          <Form.Label>Телефоны (через запятую)</Form.Label>
          <Form.Control
            name="phoneNumbers"
            value={f.phoneNumbers}
            onChange={ch}
          />
        </Form.Group>

        {/* комиссия / чекбокс агент */}
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>% комиссия</Form.Label>
              <Form.Control
                type="number"
                name="ordersComission"
                value={f.ordersComission}
                onChange={ch}
              />
            </Form.Group>
          </Col>
          <Col
            md={6}
            className="d-flex align-items-center justify-content-center"
          >
            <Form.Check
              type="checkbox"
              name="transferAgent"
              label="Агент"
              checked={f.transferAgent}
              onChange={ch}
            />
          </Col>
        </Row>

        {/* баланс / долг */}
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Баланс (+)</Form.Label>
              <Form.Control
                type="number"
                name="positiveBalance"
                value={f.positiveBalance}
                onChange={ch}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Долг</Form.Label>
              <Form.Control
                type="number"
                name="debt"
                value={f.debt}
                onChange={ch}
              />
            </Form.Group>
          </Col>
        </Row>

        {/* у агента */}
        {f.transferAgent && (
          <Form.Group className="mb-3">
            <Form.Label>У агента (totalCollected)</Form.Label>
            <Form.Control
              type="number"
              name="totalCollected"
              value={f.totalCollected}
              onChange={ch}
            />
          </Form.Group>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="success" onClick={save}>
          {isEdit ? "Сохранить" : "Добавить"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
