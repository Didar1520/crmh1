import React from 'react';
import styles from './Notifications.module.css';

function Notifications() {
  return (
    <div className={styles.notificationsContainer}>
      <h1>Уведомления</h1>
      <p>Список уведомлений будет здесь.</p>
    </div>
  );
}

export default Notifications;
