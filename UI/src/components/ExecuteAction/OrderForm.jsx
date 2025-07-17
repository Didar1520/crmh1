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
  setVal('CartLink', '');

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
            if (name === 'captureOrders') {
const current = {
  clients: [],
  range:  { type: 'between', from: '', to: '' },
  tasks:  [],
  ...form.captureOrders
};


  return (
    <div key="captureOrders" className="border rounded p-2 mb-3">
      <Button
        variant="outline-secondary"
        size="sm"
        className="mb-2"
        onClick={() => setShowCapture(!showCapture)}
      >
        {showCapture ? '▲ Скрыть captureOrders' : '▼ Показать captureOrders'}
      </Button>

      {showCapture && (
        <>
          {/* -- выбор клиентов -- */}
          <Form.Group className="mb-3">
            <Form.Label>Клиенты</Form.Label>
            <div className="ps-2">
              {clients.map((c) => (
                <Form.Check
                  key={c.clientId}
                  type="checkbox"
                  id={`cap-cli-${c.clientId}`}
                  label={`${c.name} (#${c.clientId})`}
                  checked={(current.clients || []).includes(c.name)}

                  onChange={(e) => {
                  const base = Array.isArray(current.clients) ? current.clients : [];
const list = e.target.checked
  ? [...base, c.name]
  : base.filter((n) => n !== c.name);

                    setVal('captureOrders', { ...current, clients: list });
                  }}
                />
              ))}
            </div>
          </Form.Group>

          {/* -- диапазон дат -- */}
          <Form.Group as={Row} className="mb-3">
            <Form.Label column sm={2}>
              С&nbsp;даты
            </Form.Label>
            <Col sm={4}>
              <Form.Control
                type="date"
                value={current.range.from}
                onChange={(e) =>
                  setVal('captureOrders', {
                    ...current,
                    range: { ...current.range, from: e.target.value },
                  })
                }
              />
            </Col>
            <Form.Label column sm={2}>
              По&nbsp;дату
            </Form.Label>
            <Col sm={4}>
              <Form.Control
                type="date"
                value={current.range.to}
                onChange={(e) =>
                  setVal('captureOrders', {
                    ...current,
                    range: { ...current.range, to: e.target.value },
                  })
                }
              />
            </Col>
          </Form.Group>

          {/* -- задачи -- */}
          <Form.Group className="mb-2">
            <Form.Label>Задачи</Form.Label>
            {['screenshot', 'trackSave'].map((t) => (
              <Form.Check
                key={t}
                inline
                id={`cap-task-${t}`}
                type="checkbox"
                label={t}
                checked={(current.tasks || []).includes(t)}
                onChange={(e) => {
                 const baseTasks = Array.isArray(current.tasks) ? current.tasks : [];
const tasks = e.target.checked
  ? [...baseTasks, t]
  : baseTasks.filter((x) => x !== t);

                  setVal('captureOrders', { ...current, tasks });
                }}
              />
            ))}
          </Form.Group>
        </>
      )}
    </div>
  );
}

        
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
