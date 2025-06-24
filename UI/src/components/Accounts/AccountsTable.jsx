// 📁 UI/src/components/Accounts/AccountsTable.jsx
import React from 'react';
import { Table } from 'react-bootstrap';
import InlineEditableCell from '../Clients/InlineEditableCell';
import { columnValue, HEAD } from './columnDefinitions';
import { formatDate, get } from './helpers';

export default function AccountsTable({ accounts, settings, sort, setSort, updateOne }) {
  const arrow = (k) => (sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <Table striped bordered hover responsive>
      <thead className="bg-primary text-white">
        <tr>
          {settings.columnsOrder.map(
            (k) =>
              settings.columnsVisibility[k] && (
                <th
                  key={k}
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    setSort({ key: k, dir: sort.key === k && sort.dir === 'asc' ? 'desc' : 'asc' })
                  }
                >
                  {HEAD[k] || k}
                  {arrow(k)}
                </th>
              )
          )}
        </tr>
      </thead>
      <tbody>
        {accounts.map((acc) => (
          <tr key={acc.email}>
            {settings.columnsOrder.map((k) => {
              if (!settings.columnsVisibility[k]) return null;

              // инлайн‑редактируемые поля
              if (k === 'email' || k === 'pass' || k === 'refCode') {
                return (
                  <td key={k}>
                    <InlineEditableCell order={acc} colKey={k} onSave={updateOne} />
                  </td>
                );
              }

              const val = columnValue(acc, k, { get, formatDate });

        
              if (typeof val === 'number') {
                return (
                  <td key={k}>
                   <td key={k}>{val}</td>
                  </td>
                );
              }
              return <td key={k}>{val}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
