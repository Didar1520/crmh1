/* ───────────────── index.jsx (Clients) ───────────────── */
import React, { useState, useEffect } from "react";
import {
  Container,
  Form,
  Button,
  Table,
  Badge,
  ButtonGroup,
} from "react-bootstrap";
import { FaPencilAlt, FaTrash } from "react-icons/fa";
import InlineEditableCell from "./InlineEditableCell";
import ColumnSettings from "../ColumnSettings";
import ClientModal from "./ClientModal";
import DebtModal from "./DebtModal";
import TransfersModal from "./TransfersModal";
const STORAGE_KEY_CLIENTS = 'crmClientCols';

/* ─── load data ─── */


const COLS = [
  "name",
  "telegramId",
  "city",
  "clientId",
  "phoneNumbers",
  "ordersComission",
  "registrationDate",
  "balance.positiveBalance",
  "balance.debt",
  "transferAgent",
  "safekeepingMoney.totalCollected",
];
const HEAD = {
  name: "Имя",
  telegramId: "Telegram",
  city: "Город",
  clientId: "ID",
  phoneNumbers: "Телефон",
  ordersComission: "% Комиссия",
  registrationDate: "Регистрация",
  "balance.positiveBalance": "Баланс (+)",
  "balance.debt": "Долг",
  transferAgent: "Агент",
  "safekeepingMoney.totalCollected": "У агента",
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [editCl, setEditCl] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [debtCl, setDebtCl] = useState(null);
  const [transCl, setTransCl] = useState(null);

  /* ─── load data ─── */
  useEffect(() => {
    fetch("/clientData")
      .then((r) => r.json())
      .then(setClients);

    /* настройки колонок ― сначала пробуем localStorage */
    const savedCols = localStorage.getItem(STORAGE_KEY_CLIENTS);
    if (savedCols) setSettings(JSON.parse(savedCols));
    else
      setSettings({
        columnsOrder: [...COLS],
        columnsVisibility: COLS.reduce((o, k) => ({ ...o, [k]: true }), {}),
        pageSize: 20,
        useInfiniteScroll: false,
      });
  }, []);

  /* ─── helpers ─── */
  const save = (list) => {
    setClients(list);
    fetch("/saveClientData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(list),
    });
  };
  const updateOne = (up) => save(clients.map((c) => (c.clientId === up.clientId ? up : c)));
  const get = (o, p) => p.split(".").reduce((x, k) => (x ? x[k] : ""), o);

  const filtered = clients.filter((c) =>
    [c.name, c.telegramId, c.city, c.clientId].join(" ").toLowerCase().includes(search.toLowerCase())
  );
  const sorted =
    !sortCol
      ? filtered
      : [...filtered].sort((a, b) => {
          const A = get(a, sortCol);
          const B = get(b, sortCol);
          return A === B ? 0 : A < B ? (sortDir === "asc" ? -1 : 1) : sortDir === "asc" ? 1 : -1;
        });
  const size = settings?.pageSize || 20;
  const show = settings?.useInfiniteScroll ? sorted.slice(0, page * size) : sorted.slice((page - 1) * size, page * size);

  if (!settings) return null;

  return (
    <Container fluid className="py-4 bg-light min-vh-100">
      <Container className="bg-white p-4 shadow-sm rounded">
        {/* header */}
        <div className="d-flex justify-content-between mb-3">
          <h2 className="text-primary">Клиенты</h2>
          <Button variant="success" onClick={() => setAddOpen(true)}>
            Добавить клиента
          </Button>
        </div>

        {/* поиск */}
        <Form.Control
          className="mb-3"
          placeholder="Поиск…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        {/* настройки колонок */}
        <ColumnSettings
   key={STORAGE_KEY_CLIENTS}
   settings={settings}
   setSettings={setSettings}
   storageKey={STORAGE_KEY_CLIENTS}
/>

        {/* table */}
        <Table striped bordered hover responsive>
          <thead className="bg-primary text-white">
            <tr>
              {settings.columnsOrder.map(
                (k) =>
                  settings.columnsVisibility[k] && (
                    <th
                      key={k}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        if (sortCol !== k) {
                          setSortCol(k);
                          setSortDir("asc");
                        } else setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      }}
                    >
                      {HEAD[k]} {sortCol === k && (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                  )
              )}
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {show.map((cl) => (
              <tr key={cl.clientId}>
                {settings.columnsOrder.map((k) => {
                  if (!settings.columnsVisibility[k]) return null;

                  if (k === "balance.debt")
                    return (
                      <td key={k}>
                        <InlineEditableCell
                          order={cl}
                          colKey={k}
                          onSave={updateOne}
                          display={
                            <span onClick={() => setDebtCl(cl)} style={{ cursor: "pointer" }}>
                              <Badge bg={cl.balance?.debt ? "danger" : "secondary"}>
                                {cl.balance?.debt || 0}
                              </Badge>
                            </span>
                          }
                        />
                      </td>
                    );

                    if (k === "safekeepingMoney.totalCollected")
                        return (
                          <td key={k}>
                            <InlineEditableCell
                              order={cl}
                              colKey={k}
                              onSave={updateOne}
                              display={
                                <span onClick={() => setTransCl(cl)} style={{ cursor: "pointer" }}>
                                  <Badge bg="info">{cl.safekeepingMoney?.totalCollected || 0}</Badge>
                                </span>
                              }
                            />
                          </td>
                        );
                 if (k === "transferAgent")
                    return (
                      <td key={k}>
                        <ButtonGroup size="sm">
                          <Button
                            variant={cl.transferAgent ? "success" : "outline-secondary"}
                            onClick={() => updateOne({ ...cl, transferAgent: true })}
                          >
                            Да
                          </Button>
                          <Button
                            variant={!cl.transferAgent ? "danger" : "outline-secondary"}
                            onClick={() => updateOne({ ...cl, transferAgent: false })}
                          >
                            Нет
                          </Button>
                        </ButtonGroup>
                      </td>
                    );

                  return (
                    <td key={k}>
                      <InlineEditableCell order={cl} colKey={k} onSave={updateOne} />
                    </td>
                  );
                })}
                <td>
                  <Button size="sm" variant="primary" className="me-2" onClick={() => setEditCl(cl)}>
                    <FaPencilAlt />
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      window.confirm("Удалить клиента?") && save(clients.filter((c) => c !== cl))
                    }
                  >
                    <FaTrash />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {/* пагинация / infinite scroll */}
        {!settings.useInfiniteScroll ? (
          <div className="d-flex justify-content-center gap-2">
            <Button size="sm" onClick={() => setPage(1)}>
              «
            </Button>
            <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ‹
            </Button>
            <span className="align-self-center">Стр. {page}</span>
            <Button size="sm" onClick={() => setPage((p) => p + 1)}>
              ›
            </Button>
          </div>
        ) : (
          <div className="text-center">
            {show.length < sorted.length && (
              <Button size="sm" onClick={() => setPage((p) => p + 1)}>
                Загрузить ещё
              </Button>
            )}
          </div>
        )}

        {/* модалки */}
        {addOpen && (
          <ClientModal
            nextId={clients.reduce((m, c) => Math.max(m, c.clientId || 0), 0) + 1}
            onClose={() => setAddOpen(false)}
            onSave={(c) => save([...clients, c])}
          />
        )}
        {editCl && (
          <ClientModal
            client={editCl}
            onClose={() => setEditCl(null)}
            onSave={updateOne}
          />
        )}
        {debtCl && <DebtModal client={debtCl} onClose={() => setDebtCl(null)} onSave={updateOne} />}
        {transCl && (
          <TransfersModal
            client={transCl}
            onClose={() => setTransCl(null)}
            onSave={updateOne}
          />
        )}
      </Container>
    </Container>
  );
}
