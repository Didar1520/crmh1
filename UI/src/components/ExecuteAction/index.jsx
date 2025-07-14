// ===== File: UI/src/components/ExecuteAction/index.jsx =====
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Container,
  Stack,
  Row,
  Col,
  Spinner,
  Alert,
  Button
} from 'react-bootstrap';
import OrderForm from './OrderForm';
import OrderList from './OrderList';
import FieldSettingsModal from './FieldSettingsModal';
import BulkActions from './BulkActions';

const ENDPOINT_ORDERS_DATA = '/ordersData';


const DEFAULT_SCHEMA = [
  { name: 'Account',      type: 'text'   },
  { name: 'Promocode',    type: 'text'   },
  { name: 'CartLink',     type: 'url'    },
  { name: 'client',       type: 'text'   },
  { name: 'referalLink',  type: 'text'   },
  { name: 'syncOrders',   type: 'boolean'},
  { name: 'syncReviews',  type: 'boolean'},
  { name: 'reviewManager',type: 'boolean'},
  { name: 'syncRewards',  type: 'boolean'},
  { name: 'captureOrders',type: 'object'}
];


const ENDPOINTS = {
  load: '/inputConfig',
  save: '/saveConfig',
  run: '/runOrders',
  clients: '/clientData',
  accounts: '/accData'
};

const ACTION_FIELDS = [
  'syncOrders',
  'syncReviews',
  'reviewManager',
  'syncRewards',
  'captureOrders'
];

export default function ExecuteAction() {
  const [orders, setOrders] = useState([]);
  const [lastOrderID, setLastOrderID] = useState(0);   // <- новый
  const [currentID,  setCurrentID ]  = useState(0);    // <- для авто-инкремента

  const [schema, setSchema] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastStatic, setLastStatic] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [fieldModal, setFieldModal] = useState(false);
  const [clients, setClients] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const runMapRef = useRef([]);

  useEffect(() => {
    const { io } = require('socket.io-client');
    const sock = io('ws://localhost:8081');
    sock.on('step',  d => {
      const idx = runMapRef.current[d.idx];
      if (idx !== undefined)
        setStatusMap(m => ({ ...m, [idx]: 'успешно' }));
    });
    sock.on('error', d => {
      const idx = runMapRef.current[d.idx];
      if (idx !== undefined)
        setStatusMap(m => ({ ...m, [idx]: 'ошибка' }));
    });
    return () => sock.disconnect();
  }, []);



  /* ---------- справочники ---------- */
  useEffect(() => {
    fetch(ENDPOINTS.clients)
      .then((r) => r.json())
      .then(setClients)
      .catch(() => {});
    fetch(ENDPOINTS.accounts)
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => {});
  }, []);


useEffect(() => {
  fetch(ENDPOINT_ORDERS_DATA)          // читаем OrdersData.json
    .then(r => r.json())
    .then(d => {
      const arr = d.orders || [];
      const lastOrder = arr.length ? arr[arr.length - 1] : null;
      const lastNum = lastOrder
        ? Number(lastOrder.orderID || lastOrder.orderNumber)
        : 0;
      setLastOrderID(lastNum);
      setCurrentID(lastNum + 1);          // первый свободный номер
      if (lastOrder) {
        setLastStatic(ls => ({
          ...ls,
          Account: lastOrder.orderAccount || '',
          Promocode: lastOrder.promoCodeUsed || '',
        }));
      }
    })
    .catch(() => {});
}, []);




// ---------- загрузка заказов ----------
const loadOrders = useCallback(async () => {
  try {
    const res = await fetch(ENDPOINTS.load);
    if (!res.ok) throw new Error();
    const list = await res.json();

    const normalized = (Array.isArray(list) ? list : []).map((o) => {
      if ('rederalLink' in o) {
        o.referalLink = o.rederalLink;
        delete o.rederalLink;
      }
      return o;
    });

    setOrders(normalized);

    const uniq = new Map();
    normalized.forEach(o =>
      Object.entries(o).forEach(([k, v]) => {
        if (k === 'orderID') return;
        if (!uniq.has(k))
          uniq.set(k, {
            name: k,
            type:
              typeof v === 'boolean'
                ? 'boolean'
                : typeof v === 'number'
                  ? 'number'
                  : typeof v === 'object'
                    ? 'object'
                    : 'text'
          });
      })
    );
    if (!uniq.has('referalLink'))
      uniq.set('referalLink', { name: 'referalLink', type: 'text' });

    // ← новый блок
     // гарантируем, что все поля из DEFAULT_SCHEMA присутствуют
   DEFAULT_SCHEMA.forEach(def => {
        if (!uniq.has(def.name)) uniq.set(def.name, def);
     });
      const finalSchema = [...uniq.values()];
    setSchema(finalSchema);

  } catch {
    setError('Не удалось загрузить заказы');
  } finally {
    setLoading(false);
  }
}, []);      // зависимости остаются те же


  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  /* ---------- сохранение ---------- */
  const saveOrders = async (arr) => {
    const r = await fetch(ENDPOINTS.save, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arr)
    });
    if (!r.ok) throw new Error();
    setOrders(arr);
  };

  /* ---------- действия ---------- */
const addOrder = async (data) => {
  // data приходит либо как один объект, либо как массив объектов
  const list = Array.isArray(data) ? data : [data];

  // сохраняем заказы
  await saveOrders([...orders, ...list]);

  // увеличиваем внутренний счётчик orderID
  setCurrentID((id) => id + list.length);

  // запоминаем «статические» поля первого заказа
  const refObj = list[0];
  const stat = {};
  schema
    .filter((f) => f.type !== 'boolean')
    .forEach((f) => (stat[f.name] = refObj[f.name]));
  stat.CartLink = '';
  setLastStatic(stat);
};


  const patchOrder = async (idx, p) => {
    const arr = orders.map((o, i) => (i === idx ? p : o));
    await saveOrders(arr);
  };

  const deleteOrders = async (idxs) => {
    const arr = orders.filter((_, i) => !idxs.includes(i));
    setSelected(new Set());
    await saveOrders(arr);
  };

  const runOrders = async () => {
    try {
      const r = await fetch(ENDPOINTS.run, { method: 'POST' });
      if (!r.ok) throw new Error();
      const j = await r.json();
      alert(j.status ? 'Выполнено!' : 'Ошибка, см. сервер');
    } catch {
      setError('runOrders: ошибка');
    }
  };


  const runOrdersSelected = async () => {
  const idxs = Array.from(selected).sort((a,b) => a-b);
  const toRun = orders.filter((_, i) => selected.has(i));
  if (!toRun.length) {
    alert('Нужно отметить хотя бы один заказ.');
    return;
  }
  runMapRef.current = idxs;
  setStatusMap(m => {
    const copy = { ...m };
    idxs.forEach(i => copy[i] = 'выполняется');
    return copy;
  });
  try {
    const r = await fetch(ENDPOINTS.run, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: toRun })   // на сервер идёт только выбранное
    });
    if (!r.ok) throw new Error();
    const j = await r.json();
    alert(j.status ? 'Выполнено!' : 'Ошибка, см. сервер');
  } catch {
    setError('runOrders: ошибка');
  }
};


  /* ---------- UI ---------- */
  if (loading)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );

  return (
    <Container className="py-4">
      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}

      {/* ---------- форма ---------- */}
      <OrderForm
       orderID={currentID}
        schema={schema}
        lastStatic={lastStatic}
        onAdd={addOrder}
        clients={clients}
        accounts={accounts}
      />

      {/* ---------- панель групповых действий ---------- */}
      <Stack direction="horizontal" gap={2} className="my-3">
        <BulkActions
          total={orders.length}
          selected={selected}
          onSelectAll={() => setSelected(new Set(orders.map((_, i) => i)))}
          onClear={() => setSelected(new Set())}
          onDelete={() =>
            deleteOrders(Array.from(selected).sort((a, b) => a - b))
          }
        />

        <div className="ms-auto">
         <Button size="sm" variant="success" onClick={runOrdersSelected}>
            ▶ Выполнить действие
          </Button>
        </div>
      </Stack>

      {/* ---------- таблица ---------- */}
      <OrderList
        orders={orders}
        schema={schema}
        actionFields={ACTION_FIELDS}
        statuses={statusMap}
        selected={selected}
        onToggleSelect={(i) => {
          const s = new Set(selected);
          s.has(i) ? s.delete(i) : s.add(i);
          setSelected(s);
        }}
        onEdit={patchOrder}
        onDeleteRow={(i) => deleteOrders([i])}
      />

      {/* ---------- модал настроек ---------- */}
      {fieldModal && (
        <FieldSettingsModal
          show
          schema={schema}
          onSave={(s) => {
            setSchema(s);
            setFieldModal(false);
          }}
          onHide={() => setFieldModal(false)}
        />
      )}

      <Button
        size="sm"
        variant="outline-secondary"
        className="mt-3"
        onClick={() => setFieldModal(true)}
      >
        Настроить поля…
      </Button>
    </Container>
  );
}
