// 📁 UI/src/components/Accounts/index.jsx
// Логика: загрузка, фильтр, сортировка, управление состоянием
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, Form, Button } from 'react-bootstrap';
import ColumnSettings from './ColumnSettings'; // ← отдельный компонент только для аккаунтов
import AccountsTable from './AccountsTable';
import AddAccountModal from './AddAccountModal';
import { COLS, HEAD } from './columnDefinitions';
import { get, mailDomain } from './helpers';

const STORAGE_KEY = 'crmAccCols';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'email', dir: 'asc' });

  // ── load ──
  const load = useCallback(async () => {
    const r = await fetch('/accData');
    const data = await r.json();
    setAccounts(data.accounts || []);

    // настройки столбцов
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const s = JSON.parse(saved);
      // убираем удалённые/добавляем новые ключи
      const validOrder = s.columnsOrder.filter((k) => COLS.includes(k));
      const missing = COLS.filter((k) => !validOrder.includes(k));
      setSettings({
        columnsOrder: [...validOrder, ...missing],
        columnsVisibility: {
          ...COLS.reduce((o, k) => ({ ...o, [k]: true }), {}),
          ...s.columnsVisibility,
        },
      });
    } else {
      setSettings({
        columnsOrder: [...COLS],
        columnsVisibility: COLS.reduce((o, k) => ({ ...o, [k]: true }), {}),
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── save ──
  const save = async (list) => {
    setAccounts(list);
    await fetch('/saveAccData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts: list }),
    });
  };

  const updateOne = (up) => save(accounts.map((a) => (a.email === up.email ? up : a)));

  // ── фильтр ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts.filter((a) =>
      [a.email, a.refCode, mailDomain(a.email)].join(' ').toLowerCase().includes(q)
    );
  }, [accounts, search]);

  // ── сортировка ──
  const sorted = useMemo(() => {
    const val = (acc, k) => {
      if (k === 'mailDomain') return mailDomain(acc.email);
      return get(acc, k);
    };
    const dirMul = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = val(a, sort.key);
      const bv = val(b, sort.key);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sort.key.endsWith('DateExpired')) return (new Date(av) - new Date(bv)) * dirMul;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dirMul;
      return String(av).localeCompare(String(bv)) * dirMul;
    });
  }, [filtered, sort]);

  if (!settings) return null;

  return (
    <Container fluid className="py-4 bg-light min-vh-100">
      <Container className="bg-white p-4 shadow-sm rounded">
        <div className="d-flex justify-content-between mb-3">
          <h2 className="text-primary">Аккаунты</h2>
          <Button variant="success" onClick={() => setAddOpen(true)}>
            Добавить аккаунт
          </Button>
        </div>

        <Form.Control
          className="mb-3"
          placeholder="Поиск…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ColumnSettings
          key={STORAGE_KEY}
          settings={settings}
          setSettings={setSettings}
          storageKey={STORAGE_KEY}
          headMap={HEAD}
          onSaveToStorage={(s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s))}
        />

        <AccountsTable
          accounts={sorted}
          settings={settings}
          sort={sort}
          setSort={setSort}
          updateOne={updateOne}
        />

        {addOpen && (
          <AddAccountModal
            onClose={() => setAddOpen(false)}
            onSave={(a) => save([...accounts, a])}
          />
        )}
      </Container>
    </Container>
  );
}
