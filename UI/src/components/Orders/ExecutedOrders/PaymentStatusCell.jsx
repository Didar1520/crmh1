/* File: D:\Didar1520\CRM\UI\src\components\Orders\ExecutedOrders\PaymentStatusCell.jsx */
import React, { useState, useEffect } from 'react';
import { Badge, Form, Button } from 'react-bootstrap';

export default function PaymentStatusCell({ order, onPaymentStatusChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState(order.paymentStatus || 'not paid');
  const [selectedAgent, setSelectedAgent] = useState(order.agent || '');
  const [agents, setAgents] = useState([]);

  // При выборе статуса "agent" загружаем список агентов
  useEffect(() => {
    if (status === 'agent') {
      async function fetchAgents() {
        try {
          console.log('Fetching agents from: http://localhost:8080/clientData');
          const response = await fetch('http://localhost:8080/clientData', { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`Ошибка загрузки данных клиентов: ${response.status}`);
          }
          const data = await response.json();
          // data ожидается как массив клиентов; фильтруем тех, у кого transferAgent === true
          const transferAgents = Array.isArray(data)
            ? data.filter(client => client.transferAgent === true)
            : [];
          console.log('Fetched transfer agents:', transferAgents);
          setAgents(transferAgents);
        } catch (error) {
          console.error('Ошибка загрузки агентов:', error);
        }
      }
      fetchAgents();
    }
  }, [status]);

  // Функция для обновления профиля агента в файле clientData.json
  async function updateAgentProfile(agentName, commission, order) {
    try {
      // Получаем актуальные данные агентов
      const res = await fetch('http://localhost:8080/clientData', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Ошибка при чтении данных агентов: ${res.status}`);
      }
      let agentsArray = await res.json(); // ожидается, что это массив
      // Ищем агента по имени
      const agentIndex = agentsArray.findIndex(a => a.name === agentName);
      if (agentIndex === -1) {
        console.error(`Агент с именем "${agentName}" не найден!`);
        return;
      }
      let agent = agentsArray[agentIndex];
      // Если safekeepingMoney отсутствует, инициируем его
      if (!agent.safekeepingMoney) {
        agent.safekeepingMoney = {
          totalCollected: 0,
          transfers: []
        };
      }
      const commissionAmount = Number(commission) || 0;
      // Добавляем сумму комиссии к totalCollected
      agent.safekeepingMoney.totalCollected += commissionAmount;
      // Формируем запись о переводе. Используем имя клиента и дату заказа.
      const transferRecord = {
        sender: order.client || 'Неизвестный',
        amount: commissionAmount,
        date: order.date || new Date().toLocaleDateString()
      };
      // Добавляем новую запись в историю переводов
      agent.safekeepingMoney.transfers.push(transferRecord);
      // Обновляем агента в массиве
      agentsArray[agentIndex] = agent;
      // Сохраняем обновленные данные агентов через POST /saveClientData
      const saveRes = await fetch('http://localhost:8080/saveClientData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentsArray)
      });
      if (!saveRes.ok) {
        throw new Error(`Ошибка при сохранении данных агентов: ${saveRes.status}`);
      }
    } catch (error) {
      console.error("Ошибка при обновлении профиля агента:", error);
    }
  }

  // Обработка нажатия на кнопку "Сохранить"
  const handleSave = async () => {
    const updatedOrder = { ...order, paymentStatus: status };
    if (status === 'agent' && selectedAgent) {
      updatedOrder.agent = selectedAgent;
    } else {
      delete updatedOrder.agent;
    }
    // Обновляем заказ через внешний обработчик
    onPaymentStatusChange(updatedOrder);
    // Если статус "agent", обновляем профиль агента
    if (status === 'agent' && selectedAgent) {
      await updateAgentProfile(selectedAgent, order.price?.commission, order);
    }
    setIsEditing(false);
  };

  // Определяем внешний вид статуса
  let badgeVariant = 'secondary';
  let label = '';
  switch (status) {
    case 'paid':
      badgeVariant = 'success';
      label = 'Оплачен';
      break;
    case 'not paid':
      badgeVariant = 'danger';
      label = 'Не оплачен';
      break;
    case 'agent':
      badgeVariant = 'warning';
      label = 'Передан агенту';
      break;
    default:
      badgeVariant = 'secondary';
      label = status;
  }

  if (!isEditing) {
    return (
      <div onDoubleClick={() => setIsEditing(true)} style={{ cursor: 'pointer' }}>
        <Badge bg={badgeVariant}>{label}</Badge>
      </div>
    );
  }

  return (
    <div>
      <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="paid">Оплачен</option>
        <option value="notPaid">Не оплачен</option>
        <option value="agent">Передан агенту</option>
      </Form.Select>
      {status === 'agent' && (
        <Form.Select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="mt-2"
        >
          <option value="">Выберите агента</option>
          {agents.map((agent) => (
            <option key={agent.clientId} value={agent.name}>
              {agent.name}
            </option>
          ))}
        </Form.Select>
      )}
      <div className="mt-2">
        <Button variant="primary" size="sm" onClick={handleSave}>
          Сохранить
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)} className="ms-2">
          Отмена
        </Button>
      </div>
    </div>
  );
}
