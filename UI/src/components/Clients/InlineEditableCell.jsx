/* ───────────────── InlineEditableCell.jsx ───────────────── */
import React, { useState } from "react";

/* helpers: get / set for nested paths, e.g. balance.debt */
const get = (o, p) => p.split(".").reduce((x, k) => (x ? x[k] : undefined), o);
const set = (o, p, v) => {
  const ks = p.split(".");
  const last = ks.pop();
  let cur = o;
  ks.forEach((k) => {
    if (!cur[k]) cur[k] = {};
    cur = cur[k];
  });
  cur[last] = v;
};

export default function InlineEditableCell({ order, colKey, onSave, display }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(
    colKey.includes(".") ? get(order, colKey) ?? "" : order[colKey] ?? ""
  );

  const save = () => {
    const up = { ...order };
    if (colKey.includes(".")) set(up, colKey, isNaN(val) ? val : Number(val));
    else up[colKey] = isNaN(val) ? val : Number(val);
    onSave(up);
    setEdit(false);
  };

  if (!edit)
    return (
      <span onDoubleClick={() => setEdit(true)} style={{ cursor: "pointer" }}>
        {display ?? String(val)}
      </span>
    );

  return (
    <input
      autoFocus
      className="form-control"
      style={{ background: "#fffae6" }}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setEdit(false);
      }}
    />
  );
}
