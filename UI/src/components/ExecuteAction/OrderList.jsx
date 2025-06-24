// ===== File: UI/src/components/ExecuteAction/OrderList.jsx =====
import { useState } from 'react';
import { Table, Form, Button, Modal, Stack } from 'react-bootstrap';

export default function OrderList({
  orders,
  schema,
  actionFields,
  selected,
  onToggleSelect,
  onEdit,
  onDeleteRow
}) {
  const [idx, setIdx] = useState(null);
  const [draft, setDraft] = useState({});

  const open = (i) => {
    setDraft(orders[i]);
    setIdx(i);
  };
  const save = () => {
    onEdit(idx, draft);
    setIdx(null);
  };

  /* ——— helpers ——— */
  const renderActions = (o) =>
    actionFields
      .filter((f) => o[f])
      .map((f) => f.replace(/([A-Z])/g, ' $1'))
      .join(', ');

  return (
    <>
      <Table bordered hover size="sm" responsive>
        <thead>
          <tr>
            <th style={{ width: 30 }} />
            <th>#</th>
            <th>ID</th>
            {schema
              .filter((f) => !actionFields.includes(f.name))
              .map((f) => (
                <th key={f.name}>{f.name}</th>
              ))}
            <th>actions</th>
            <th style={{ width: 70 }} />
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={i}>
              <td>
                <Form.Check
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => onToggleSelect(i)}
                />
              </td>
             <td>{i + 1}</td>          {/* порядковый номер 1-based */}
             <td>{o.orderID}</td>      {/* реальный orderID из данных */}


              {schema
                .filter((f) => !actionFields.includes(f.name))
                .map((f) => {
                  if (f.name === 'CartLink')
                    return (
                      <td
                        key={f.name}
                        style={{
                          maxWidth: 180,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={o.CartLink}
                      >
                        {o.CartLink}
                      </td>
                    );
                  if (f.type === 'boolean')
                    return <td key={f.name}>{o[f.name] ? '✓' : ''}</td>;
                  return <td key={f.name}>{o[f.name]}</td>;
                })}

              <td>{renderActions(o)}</td>
              <td>
                <Stack direction="horizontal" gap={1}>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => open(i)}
                  >
                    ✎
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => onDeleteRow(i)}
                  >
                    🗑
                  </Button>
                </Stack>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* ---------- modal ---------- */}
      {idx !== null && (
        <Modal show onHide={() => setIdx(null)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Редактировать #{draft.orderID}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {schema.map((f) =>
              f.type === 'boolean' ? (
                <Form.Check
                  key={f.name}
                  className="mb-2"
                  type="checkbox"
                  label={f.name}
                  checked={!!draft[f.name]}
                  onChange={(e) =>
                    setDraft({ ...draft, [f.name]: e.target.checked })
                  }
                />
              ) : (
                <Form.Group key={f.name} className="mb-2">
                  <Form.Label>{f.name}</Form.Label>
                  <Form.Control
                    size="sm"
                    type={f.type}
                    value={draft[f.name] || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, [f.name]: e.target.value })
                    }
                  />
                </Form.Group>
              )
            )}
          </Modal.Body>
          <Modal.Footer>
            <Stack direction="horizontal" gap={2}>
              <Button variant="secondary" onClick={() => setIdx(null)}>
                Отмена
              </Button>
              <Button onClick={save}>Сохранить</Button>
            </Stack>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
