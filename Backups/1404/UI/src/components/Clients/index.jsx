// Файл: CRM\UI\src\components\Clients\index.jsx
import React from 'react';
import styles from './Clients.module.css';

function Clients() {
  return (
    <div className={styles.clientsContainer}>
      <h1>Клиенты</h1>
      <p>Список клиентов будет здесь.</p>
    </div>
  );
}

export default Clients;
