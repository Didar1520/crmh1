// File: InlineEditableCell.jsx
import React, { useState } from 'react';
import { renderCell } from './helpers';

/**
 * Инлайн-редактирование для любой колонки (кроме paymentStatus).
 * По двойному клику поле становится input. При blur или Enter — сохраняем.
 */
export default function InlineEditableCell({ order, colKey, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(() => getInitialValue(order, colKey));

  // Первичное значение в зависимости от типа поля
  function getInitialValue(orderObj, key) {
    if (key === 'rub') return orderObj.price?.rub || 0;
    if (key === 'usd') return orderObj.price?.usd || 0;
    if (key === 'commission') return orderObj.price?.commission || 0;
    return orderObj[key] || '';
  }

  // Вход в режим редактирования
  function handleDoubleClick() {
    setIsEditing(true);
  }

  // Если пользователь ушёл из поля или нажал Enter — сохраняем
  function handleBlur() {
    saveValue();
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveValue();
    } else if (e.key === 'Escape') {
      // Отменяем изменения
      setValue(getInitialValue(order, colKey));
      setIsEditing(false);
    }
  }

  // Сохраняем значение в общий стейт (через onSave(updatedOrder))
  function saveValue() {
    const updated = { ...order };

    // Для полей rub, usd, commission храним в order.price
    if (colKey === 'rub' || colKey === 'usd' || colKey === 'commission') {
      updated.price = { ...updated.price };
      updated.price[colKey === 'rub' ? 'rub'
                  : colKey === 'usd' ? 'usd'
                  : 'commission'] = parseFloat(value) || 0;
    } else {
      updated[colKey] = value;
    }

    onSave(updated);
    setIsEditing(false);
  }

  // Пока не редактируем, показываем обычный текст (через renderCell).
  if (!isEditing) {
    return (
      <div
        onDoubleClick={handleDoubleClick}
        style={{ cursor: 'pointer' }}
      >
        {renderCell(order, colKey)}
      </div>
    );
  }

  // Режим редактирования: <input>
  return (
    <input
      autoFocus
      className="form-control"
      style={{ backgroundColor: '#fffae6' }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
