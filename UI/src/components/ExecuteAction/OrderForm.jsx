// ===== File: UI/src/components/ExecuteAction/OrderForm.jsx =====
import { useState, useEffect } from 'react';
import {
  Form,
  Button,
  Row,
  Col,
  InputGroup,
  Dropdown
} from 'react-bootstrap';

const smallStyle = { maxWidth: 140 };
const mediumStyle = { maxWidth: 240 };

export default function OrderForm({
  orderID,
  schema,
  lastStatic,
  onAdd,
  clients,
  accounts
}) {
  const [form, setForm] = useState({});
  const [suggest, setSuggest] = useState({}); // { field: [values] }
  const [bulkText, setBulkText] = useState('');
  const [showCapture, setShowCapture] = useState(false);
  const [capDropdown, setCapDropdown] = useState(false);
  const [capClients, setCapClients] = useState(new Set());

  /* ---------- init ---------- */
  useEffect(() => {
    const base = Object.fromEntries(
      schema.map((f) => [
        f.name,
        f.type === 'boolean'
          ? false
          : f.type === 'object'
            ? lastStatic[f.name] || {}
            : lastStatic[f.name] || ''
      ])
    );
    setForm(base);
  }, [schema, lastStatic]);

  useEffect(() => {
    const names =
      form.captureOrders && Array.isArray(form.captureOrders.clients)
        ? form.captureOrders.clients
        : [];
    setCapClients(new Set(names));
  }, [form.captureOrders]);

  /* ---------- helpers ---------- */
  const setVal = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const pushSuggest = (k, v) => {
    if (!v) return;
    setSuggest((p) => {
      const arr = p[k] || [];
      if (arr.includes(v)) return p;
      return { ...p, [k]: [v, ...arr].slice(0, 20) };
    });
  };

  /* ---------- submit ---------- */
const submit = (e) => {
  e.preventDefault();

  /* --- обработка bulkText: несколько корзин в одном сообщении --- */
  if (bulkText.trim().length) {
    // достаём все ссылки http/https
    const links = bulkText.match(/https?:\/\/\S+/g) || [];

    if (links.length === 0) {
      alert('Ссылок не найдено');
      return;
    }

    // объект с полями из обычных инпутов
    const base = { ...form };

    // orderID приходит пропсом, используем как первый номер
    const batch = links.map((lnk, idx) => ({
      ...base,
      CartLink: lnk.trim(),
      orderID: orderID + idx
    }));

    onAdd(batch);      // передаём массив заказов
    setBulkText('');   // очищаем textarea
    return;            // одиночный заказ не создаём
  }
  /* --- конец обработки bulkText --- */

  // обычное добавление одного заказа
  onAdd({ ...form, orderID });
  schema
    .filter((f) => f.type === 'text' || f.type === 'number')
    .forEach((f) => pushSuggest(f.name, form[f.name]));
};


  /* ---------- UI ---------- */
  return (
    <Form onSubmit={submit}>
      <Row className="g-2 align-items-end">
        <Col xs="auto">
          <Form.Control
            plaintext
            readOnly
            disabled
            value={`ID:${orderID}`}
            style={smallStyle}
          />
        </Col>


        <Form.Control
  as="textarea"
  rows={3}
  placeholder="Вставьте сюда текст с несколькими корзинами…"
  value={bulkText}
  onChange={e => setBulkText(e.target.value)}
/>
<Form.Text muted>
  Если сюда вставлен текст, кнопка «Добавить» создаст по одной записи на
  каждый найденный CartLink, остальные поля возьмутся из текущих инпутов.
</Form.Text>


        {schema.map(({ name, type }) => {
          if (name === 'clientId') return null; // скрытое

          if (name === 'client')
            return (
              <Col xs="auto" key={name}>
                <Form.Select
                  size="sm"
                  value={form.clientId || ''}
                  onChange={(e) => {
                    const cli = clients.find(
                      (c) => c.clientId === +e.target.value
                    );
                    if (cli) {
                      setForm((p) => ({
                        ...p,
                        clientId: cli.clientId,
                        client: cli.name
                      }));
                    }
                  }}
                  style={mediumStyle}
                >
                  <option value="">Клиент…</option>
                  {clients.map((c) => (
                    <option key={c.clientId} value={c.clientId}>
                      {c.name} (#{c.clientId})
                    </option>
                  ))}
                </Form.Select>
              </Col>
            );

          if (name === 'Account')
            return (
              <Col xs="auto" key={name}>
                <Form.Select
                  size="sm"
                  value={form.Account}
                  onChange={(e) => setVal('Account', e.target.value)}
                  style={mediumStyle}
                >
                  <option value="">Аккаунт…</option>
                  {accounts.map((a, i) => (
                    <option key={i} value={a.email}>
                      {a.email}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            );

          const sz =
            name === 'promocode' || name === 'referalLink'
              ? smallStyle
              : mediumStyle;

          if (type === 'boolean')
            return (
              <Col xs="auto" key={name}>
                <Form.Check
                  size="sm"
                  type="checkbox"
                  label={name}
                  checked={!!form[name]}
                  onChange={(e) => setVal(name, e.target.checked)}
                />
              </Col>
            );

          if (type === 'object') {
            if (name === 'captureOrders')
              return (
                <Col xs={12} key={name} className="mb-2">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setShowCapture((v) => !v)}
                  >
                    {`captureOrders ${showCapture ? '▲' : '▼'}`}
                  </Button>
                  {showCapture && (
                    <div className="mt-2">
                      <Dropdown
                        show={capDropdown}
                        onToggle={(s) => {
                          setCapDropdown(s);
                          if (!s)
                            setVal('captureOrders', {
                              ...(form.captureOrders || {}),
                              clients: Array.from(capClients)
                            });
                        }}
                      >
                        <Dropdown.Toggle
                          variant="secondary"
                          size="sm"
                        >
                          {capClients.size
                            ? `Клиенты (${capClients.size})`
                            : 'Выбрать клиентов'}
                        </Dropdown.Toggle>
                        <Dropdown.Menu style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {clients.map((c) => (
                            <Dropdown.Item as="span" key={c.clientId} className="px-3">
                              <Form.Check
                                type="checkbox"
                                label={c.name}
                                checked={capClients.has(c.name)}
                                onChange={(e) => {
                                  const set = new Set(capClients);
                                  e.target.checked ? set.add(c.name) : set.delete(c.name);
                                  setCapClients(set);
                                }}
                              />
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>
                  )}
                </Col>
              );
            return (
              <Col xs={12} key={name}>
                <Form.Group className="mb-2">
                  <Form.Label>{name}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={JSON.stringify(form[name] || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        setVal(name, JSON.parse(e.target.value));
                      } catch {
                        setVal(name, e.target.value);
                      }
                    }}
                  />
                </Form.Group>
              </Col>
            );
          }

          return (
            <Col xs="auto" key={name}>
              <InputGroup size="sm">
                <Form.Control
                  placeholder={name}
                  value={form[name] || ''}
                  style={sz}
                  onChange={(e) => setVal(name, e.target.value)}
                  list={`${name}-list`}
                />
                <datalist id={`${name}-list`}>
                  {(suggest[name] || []).map((v, i) => (
                    <option key={i} value={v} />
                  ))}
                </datalist>
              </InputGroup>
            </Col>
          );
        })}

        <Col xs="auto">
          <Button size="sm" type="submit">
            Добавить
          </Button>
        </Col>
      </Row>
    </Form>
  );
}
