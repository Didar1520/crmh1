// File: UI/src/components/Orders/ExecutedOrders/AddExecutedOrderModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, InputGroup } from 'react-bootstrap';

/**
 * Модалка для добавления нового исполненного заказа
 * ------------------------------------------------
 * – Парсинг текста iHerb (кнопка «Извлечь информацию»).  
 * – Рассчёт RUB по курсу и total (rub + %).  
 * – Сохранение нового заказа в ordersData.  
 * – При статусе «не оплачен» — добавление долга клиенту
 *   (balance.debt + notPaidOrders на уровне клиента).  
 * – При статусе «agent» — обновление safekeepingMoney агента.
 */
export default function AddExecutedOrderModal({ onClose, onOrderAdded }) {
  const [show, setShow] = useState(true);
  const [iherbText, setIherbText] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [trackCode, setTrackCode] = useState('');
  const [date, setDate] = useState(() => getTodayString());
  const [rub, setRub] = useState('');
  const [usd, setUsd] = useState('');
  const [commission, setCommission] = useState('');
  const [total, setTotal] = useState('');
  const [rate, setRate] = useState('');
  const [bybitRate, setBybitRate] = useState('');
  const [clientId, setClientId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('notPaid');
  const [agentId, setAgentId] = useState('');
  const [cartLink, setCartLink] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [promoCodeUsed, setPromoCodeUsed] = useState('');
  const [referralCodeUsed, setReferralCodeUsed] = useState('');
  const [rewardsUsed, setRewardsUsed] = useState('');
  const [orderAccount, setOrderAccount] = useState('');

  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    fetchClients();
    fetchAccounts();
  }, []);

// при смене клиента подтягиваем его комиссию
useEffect(() => {
  if (!clientId) {
    setCommission('');
    return;
  }
  const c = clients.find(x => x.clientId === +clientId);
  // сначала пробуем ordersComission, иначе fallback на старое comission
  const comm = c?.ordersComission ?? c?.comission;
  setCommission(comm != null ? String(comm) : '');
}, [clientId, clients]);


useEffect(() => {
  const r = parseFloat(rub) || 0;
  const c = parseFloat(commission) || 0;
  const sum = r + (r * c) / 100;
  setTotal(sum ? sum.toFixed(2) : '');
}, [rub, commission]);


  function handleExtract() {
    if (!iherbText.trim()) return;
    const orderMatch = iherbText.match(/заказ\s*№\s*(\d+)/i);
    const emailMatch = iherbText.match(/на\s+адрес\s+(\S+@\S+)/i);
    const usdMatch = iherbText.match(/итого:\s*\$(\d+(\.\d+)?)/i);
    if (orderMatch) setOrderNumber(orderMatch[1]);
    if (emailMatch)  setOrderAccount(emailMatch[1]);
    if (usdMatch)    setUsd(usdMatch[1]);
  }

  function handleCalculateRub() {
    const u = parseFloat(usd) || 0;
    const r = parseFloat(rate) || 0;
    if (u && r) setRub((u * r).toFixed(2));
  }

  function handleCalculateTotal() {
    const r = parseFloat(rub) || 0;
    const c = parseFloat(commission) || 0;
    setTotal((r + r * c / 100).toFixed(2));
  }

  async function handleSaveOrder() {
    const newOrder = {
      orderNumber: parseInt(orderNumber, 10) || 0,
      trackCode: trackCode ? parseInt(trackCode, 10) : null,
      clientId: clientId ? parseInt(clientId, 10) : null,
      date,
      commission: parseFloat(commission) || 0,
      rate: parseFloat(rate) || 0,
      bybitRate: parseFloat(bybitRate) || 0,
      paymentStatus,
      ...(paymentStatus === 'agent' && agentId ? { agentId: parseInt(agentId, 10) } : {}),
      cartLink: cartLink.trim(),
      deliveryAddress: deliveryAddress.trim(),
      promoCodeUsed: promoCodeUsed.trim(),
      referralCodeUsed: referralCodeUsed.trim(),
      rewardsUsed: parseFloat(rewardsUsed) || 0,
      orderAccount: orderAccount.trim(),
      price: {
        rub: parseFloat(rub) || 0,
        usd: parseFloat(usd) || 0,
        total: parseFloat(total) || 0
      }
    };

    console.log('[handleSaveOrder] newOrder.price =', newOrder.price);

    // ► Добавляем имя клиента по clientId
    if (newOrder.clientId) {
      const clientObj = clients.find(c => c.clientId === newOrder.clientId);
      newOrder.client = clientObj?.name || '';
    }

    try {
      if (paymentStatus === 'notPaid' && newOrder.clientId) {
        // const forcedTotal = parseFloat(rub) + (parseFloat(rub) * parseFloat(commission) / 100);
        // newOrder.price.total = forcedTotal.toFixed(2);
        await addDebtToClient(newOrder);
      }
      if (paymentStatus === 'agent' && agentId) {
        await updateAgentProfile(agentId, newOrder.price.total, newOrder);
      }
    } catch (error) {
      console.error('Ошибка обновления clientData:', error);
    }

    onOrderAdded(newOrder);
    setShow(false);
    onClose();
  }

  async function addDebtToClient(order) {
    try {
      console.log('[addDebtToClient] incoming order:', order);
      console.log('[addDebtToClient] price.rub =', order.price.rub, 'price.total =', order.price.total);
      const resp = await fetch('/clientData');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const clientsArr = await resp.json();
      const idx = clientsArr.findIndex(c => c.clientId === order.clientId);
      if (idx === -1) return;
      const client = { ...clientsArr[idx] };
      if (!client.balance) client.balance = { positiveBalance: 0, debt: 0 };
      const sumTotal = parseFloat(order.price.total) || 0;
      console.log('[addDebtToClient] computed sumTotal =', sumTotal);
      client.balance.debt += sumTotal;
      if (!client.notPaidOrders) client.notPaidOrders = {};
      client.notPaidOrders[order.orderNumber] = {
        sum: sumTotal,
        date: order.date || new Date().toLocaleString()
      };
      clientsArr[idx] = client;
      await fetch('/saveClientData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientsArr)
      });
    } catch (error) {
      console.error('[addDebtToClient] ошибка:', error);
    }
  }

  async function updateAgentProfile(agentId, totalAmount, order) {
    try {
      const res = await fetch('/clientData');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let clientsArray = await res.json();
      const agentIndex = clientsArray.findIndex(a => a.clientId === parseInt(agentId, 10));
      if (agentIndex === -1) return;
      const agent = { ...clientsArray[agentIndex] };
      if (!agent.safekeepingMoney) agent.safekeepingMoney = { totalCollected: 0, transfers: [] };
      const commissionAmount = parseFloat(totalAmount) || 0;
      agent.safekeepingMoney.totalCollected += commissionAmount;
      const now = new Date();

      const clientObj = clients.find(c => c.clientId === order.clientId);
      const senderName = clientObj?.name || `Клиент #${order.clientId}`;
      agent.safekeepingMoney.transfers.push({
        sender: senderName,
        amount: commissionAmount,
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString()
      });
      clientsArray[agentIndex] = agent;
      await fetch('/saveClientData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientsArray)
      });
    } catch (error) {
      console.error('updateAgentProfile error:', error);
    }
  }

  async function fetchClients() {
    try {
      const resp = await fetch('/clientData');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setClients(data);
      setAgents(data.filter(c => c.transferAgent));
    } catch (err) {
      console.error('fetchClients error:', err);
    }
  }

  async function fetchAccounts() {
    try {
      const resp = await fetch('/accData');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('fetchAccounts error:', err);
    }
  }

  function handleClose() {
    setShow(false);
    onClose();
  }

  return (
    <Modal show={show} onHide={handleClose} size="md" centered>
      <Modal.Header closeButton>
        <Modal.Title>Добавить исполненный заказ</Modal.Title>
      </Modal.Header>
      <Modal.Body>

        {/* ------- Поле текста iHerb ------- */}
        <Form.Group className="mb-2">
          <Form.Label>Вставьте сообщение iHerb (необязательно)</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={iherbText}
            onChange={e => setIherbText(e.target.value)}
            placeholder="Сюда можно вставить текст от iHerb..."
          />
          <Button
            variant="outline-secondary"
            size="sm"
            className="mt-2"
            onClick={handleExtract}
          >
            Извлечь информацию
          </Button>
        </Form.Group>

        {/* ------- Номер заказа / трек ------- */}
        <Row className="g-2">
          <Col xs={12} md={6}>
            <Form.Group className="mb-2">
              <Form.Label>Номер заказа</Form.Label>
              <Form.Control
                type="number"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12} md={6}>
            <Form.Group className="mb-2">
              <Form.Label>Трек-код</Form.Label>
              <Form.Control
                type="number"
                value={trackCode}
                onChange={e => setTrackCode(e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>

        {/* ------- Дата / клиент ------- */}
        <Row className="g-2">
          <Col xs={12} md={6}>
            <Form.Group className="mb-2">
              <Form.Label>Дата</Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setDate(getTodayString())}
                >
                  Текущая
                </Button>
              </InputGroup>
            </Form.Group>
          </Col>
          <Col xs={12} md={6}>
            <Form.Group className="mb-2">
              <Form.Label>Клиент</Form.Label>
              <Form.Select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
              >
                <option value="">(не выбрано)</option>
                {clients.map(cl => (
                  <option key={cl.clientId} value={cl.clientId}>
                    {`#${cl.clientId} — ${cl.name || cl.email || 'Без имени'}`}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>

        {/* ------- USD / курс / RUB ------- */}
        <Row className="g-2">
          <Col xs={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>Цена (USD)</Form.Label>
              <Form.Control
                type="number"
                value={usd}
                onChange={e => setUsd(e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>Курс iHerb</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                />
                <Button variant="outline-secondary" onClick={handleCalculateRub}>
                  Рассчитать RUB
                </Button>
              </InputGroup>
            </Form.Group>
          </Col>
          <Col xs={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>Цена в RUB</Form.Label>
              <Form.Control
                type="number"
                value={rub}
                onChange={e => setRub(e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>

        {/* ------- Комиссия / total / Bybit ------- */}
        <Row className="g-2">
        <Col xs={12} md={6}>
  <Form.Group className="mb-2">
    <Form.Label>Итог (RUB с комиссией)</Form.Label>
    <Form.Control
      type="number"
      value={total}
      readOnly
    />
  </Form.Group>
</Col>
      
          <Col xs={6} md={3}>
            <Form.Group className="mb-2">
              <Form.Label>Курс Bybit</Form.Label>
              <Form.Control
                type="number"
                value={bybitRate}
                onChange={e => setBybitRate(e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>

        {/* ------- Статус оплаты / агент ------- */}
        <Row className="g-2">
          <Col xs={12} md={6}>
            <Form.Group className="mb-2">
              <Form.Label>Статус оплаты</Form.Label>
              <Form.Select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value)}
              >
                <option value="paid">Оплачен</option>
                <option value="notPaid">Не оплачен</option>
                <option value="agent">Передан агенту</option>
              </Form.Select>
            </Form.Group>
          </Col>
          {paymentStatus === 'agent' && (
            <Col xs={12} md={6}>
              <Form.Group className="mb-2">
                <Form.Label>Агент</Form.Label>
                <Form.Select
                  value={agentId}
                  onChange={e => setAgentId(e.target.value)}
                >
                  <option value="">(не выбрано)</option>
                  {agents.map(a => (
                    <option key={a.clientId} value={a.clientId}>
                      {`#${a.clientId} — ${a.name || 'Без имени'}`}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          )}
        </Row>

        {/* ------- Аккаунт / ссылка ------- */}
        <Row className="g-2">
          <Col xs={12} md={6}>
            <Form.Group className="mb-2">
              <Form.Label>Аккаунт заказа</Form.Label>
              <Form.Select
                value={orderAccount}
                onChange={e => setOrderAccount(e.target.value)}
              >
                <option value="">(не выбрано)</option>
                {accounts.map(acc => (
                  <option key={acc.email} value={acc.email}>
                    {acc.email}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col xs={12} md={6}>
            <Form.Group className="mb-2">
              <Form.Label>Ссылка на корзину</Form.Label>
              <Form.Control
                type="text"
                value={cartLink}
                onChange={e => setCartLink(e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>

        {/* ------- Адрес ------- */}
        <Form.Group className="mb-2">
          <Form.Label>Адрес доставки</Form.Label>
          <Form.Control
            type="text"
            value={deliveryAddress}
            onChange={e => setDeliveryAddress(e.target.value)}
          />
        </Form.Group>

        {/* ------- Промокод / рефкод ------- */}
        <Row className="g-2">
          <Col xs={12} md={6}>
            <Form.Group className="mb-2">
              <Form.Label>Промокод</Form.Label>
              <Form.Control
                type="text"
                value={promoCodeUsed}
                onChange={e => setPromoCodeUsed(e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12} md={6}>
            <Form.Group className="mb-2">
              <Form.Label>Реферальный код</Form.Label>
              <Form.Control
                type="text"
                value={referralCodeUsed}
                onChange={e => setReferralCodeUsed(e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>

        {/* ------- Вознаграждения ------- */}
        <Form.Group className="mb-2">
          <Form.Label>Использованные вознаграждения</Form.Label>
          <Form.Control
            type="number"
            value={rewardsUsed}
            onChange={e => setRewardsUsed(e.target.value)}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Отмена
        </Button>
        <Button variant="success" onClick={handleSaveOrder}>
          Добавить заказ
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

/* -------------------------
   getTodayString()
   Формат "DD-MM-YYYY HH:MM"
------------------------- */

function getTodayString() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}
