document.addEventListener("DOMContentLoaded", () => {
  console.log("[script.js] -> Страница загружена, начинаем выполнение скрипта");

  const addOrderBtn = document.getElementById("addOrderBtn");
  const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
  const deleteAllBtn = document.getElementById("deleteAllBtn");
  const orderFormContainer = document.getElementById("orderFormContainer");
  const orderForm = document.getElementById("orderForm");
  const orderListDiv = document.getElementById("orderList");

  let orders = [];
  let editingIndex = null;

  // Проверка, не открыт ли файл напрямую через file://
  if (window.location.protocol === "file:") {
    const warning = document.createElement("div");
    warning.style.color = "red";
    warning.textContent = "ВНИМАНИЕ: Вы открыли index.html напрямую (file://...). Fetch для локальных файлов может не работать. Запустите сервер.";
    orderListDiv.appendChild(warning);
    console.log("[script.js] -> Предупреждение: Открыт файл через file://. Fetch может не работать.");
  }

  // Загружаем заказы через эндпоинт /inputConfig
  function loadOrders() {
    console.log("[script.js] -> Попытка загрузить заказы с /inputConfig");
    fetch("/inputConfig")
      .then(response => {
        console.log("[script.js] -> Ответ от сервера:", response);
        if (!response.ok) {
          throw new Error(`Ошибка загрузки JSON: статус ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("[script.js] -> Данные из /inputConfig:", data);
        orders = data;
        renderOrders();
        updateDatalists();
      })
      .catch(error => {
        console.error("[script.js] -> Ошибка при загрузке orders:", error);
        orderListDiv.textContent = "Ошибка при загрузке /inputConfig: " + error.message;
      });
  }

  // Функция для сохранения изменений (отправка POST на /saveConfig)
  function saveOrders() {
    console.log("[script.js] -> Сохранение orders:", orders);
    fetch("/saveConfig", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orders)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Ошибка сохранения: статус ${response.status}`);
      }
      return response.json();
    })
    .then(result => {
      console.log("[script.js] -> Сохранено:", result);
    })
    .catch(err => {
      console.error("[script.js] -> Ошибка сохранения:", err);
      alert("Ошибка сохранения: " + err.message);
    });
  }

  // Отрисовка списка заказов
  function renderOrders() {
    console.log("[script.js] -> Отрисовка списка заказов...");
    orderListDiv.innerHTML = "";
    orders.forEach((order, index) => {
      const orderDiv = document.createElement("div");
      orderDiv.className = "orderItem";
      orderDiv.innerHTML = `
        <div class="orderDetails">
          <input type="checkbox" class="selectOrder" data-index="${index}">
          <strong>Order ID:</strong> ${order.orderID} |
          <strong>Account:</strong> ${order.Account} |
          <strong>Promocode:</strong> ${order.Promocode} |
          <strong>Client:</strong> ${order.client}
        </div>
        <div class="orderActions">
          <button data-index="${index}" class="editOrderBtn">Редактировать</button>
          <button data-index="${index}" class="deleteOrderBtn">Удалить</button>
          <button data-index="${index}" class="moveUpOrderBtn">↑</button>
          <button data-index="${index}" class="moveDownOrderBtn">↓</button>
        </div>
      `;
      orderListDiv.appendChild(orderDiv);
    });
    console.log(`[script.js] -> Список заказов отрисован. Всего заказов: ${orders.length}`);
  }

  // Обновление даталистов для автозаполнения
  function updateDatalists() {
    console.log("[script.js] -> Обновление даталистов для автозаполнения...");
    const accountSet = new Set(), promocodeSet = new Set(), rederalLinkSet = new Set(), clientSet = new Set();
    orders.forEach(order => {
      accountSet.add(order.Account);
      promocodeSet.add(order.Promocode);
      rederalLinkSet.add(order.rederalLink);
      clientSet.add(order.client);
    });
    updateDatalist("accountList", accountSet);
    updateDatalist("promocodeList", promocodeSet);
    updateDatalist("rederalLinkList", rederalLinkSet);
    updateDatalist("clientList", clientSet);
  }

  function updateDatalist(listId, dataSet) {
    const datalist = document.getElementById(listId);
    datalist.innerHTML = "";
    dataSet.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      datalist.appendChild(option);
    });
    console.log(`[script.js] -> Даталист '${listId}' обновлен. Значения:`, Array.from(dataSet));
  }

  // Показ формы для добавления/редактирования заказа
  function showOrderForm(order = {}) {
    console.log("[script.js] -> Показ формы заказа с данными:", order);
    orderFormContainer.classList.remove("hidden");
    orderForm.reset();
    orderForm.account.value = order.Account || "";
    orderForm.promocode.value = order.Promocode || "";
    orderForm.rederalLink.value = order.rederalLink || "";
    orderForm.orderID.value = order.orderID || "";
    orderForm.cartLink.value = order.CartLink || "";
    orderForm.client.value = order.client || "";
    orderForm.syncOrders.checked = order.syncOrders || false;
    orderForm.syncReviews.checked = order.syncReviews || false;
    orderForm.reviewManager.checked = order.reviewManager || false;
    orderForm.syncRewards.checked = order.syncRewards || false;
  }

  // Скрытие формы
  function hideOrderForm() {
    console.log("[script.js] -> Скрытие формы заказа");
    orderFormContainer.classList.add("hidden");
    editingIndex = null;
  }

  addOrderBtn.addEventListener("click", () => {
    console.log("[script.js] -> Нажата кнопка 'Добавить заказ'");
    editingIndex = null;
    showOrderForm();
  });

  document.getElementById("cancelOrderBtn").addEventListener("click", hideOrderForm);

  // Обработка сохранения заказа
  orderForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const newOrder = {
      Account: orderForm.account.value,
      Promocode: orderForm.promocode.value,
      rederalLink: orderForm.rederalLink.value,
      orderID: parseInt(orderForm.orderID.value) || 0,
      CartLink: orderForm.cartLink.value,
      client: orderForm.client.value,
      syncOrders: orderForm.syncOrders.checked,
      syncReviews: orderForm.syncReviews.checked,
      reviewManager: orderForm.reviewManager.checked,
      syncRewards: orderForm.syncRewards.checked
    };

    if (editingIndex !== null) {
      console.log("[script.js] -> Редактирование заказа под индексом:", editingIndex, newOrder);
      orders[editingIndex] = newOrder;
    } else {
      console.log("[script.js] -> Добавление нового заказа:", newOrder);
      orders.push(newOrder);
    }
    renderOrders();
    updateDatalists();
    saveOrders();
    hideOrderForm();
  });

  // Обработка событий в списке заказов
  orderListDiv.addEventListener("click", (e) => {
    const target = e.target;
    const index = target.getAttribute("data-index");
    if (target.classList.contains("editOrderBtn")) {
      console.log("[script.js] -> Редактирование заказа с индексом:", index);
      editingIndex = parseInt(index);
      showOrderForm(orders[editingIndex]);
    } else if (target.classList.contains("deleteOrderBtn")) {
      console.log("[script.js] -> Удаление заказа с индексом:", index);
      orders.splice(index, 1);
      renderOrders();
      updateDatalists();
      saveOrders();
    } else if (target.classList.contains("moveUpOrderBtn")) {
      console.log("[script.js] -> Перемещение заказа вверх, индекс:", index);
      if (index > 0) {
        [orders[index - 1], orders[index]] = [orders[index], orders[index - 1]];
        renderOrders();
        saveOrders();
      }
    } else if (target.classList.contains("moveDownOrderBtn")) {
      console.log("[script.js] -> Перемещение заказа вниз, индекс:", index);
      if (parseInt(index) < orders.length - 1) {
        [orders[parseInt(index) + 1], orders[index]] = [orders[index], orders[parseInt(index) + 1]];
        renderOrders();
        saveOrders();
      }
    }
  });

  // Удаление выбранных заказов
  deleteSelectedBtn.addEventListener("click", () => {
    console.log("[script.js] -> Удаление выбранных заказов");
    const checkboxes = document.querySelectorAll(".selectOrder");
    const indexesToDelete = [];
    checkboxes.forEach(checkbox => {
      if (checkbox.checked) {
        indexesToDelete.push(parseInt(checkbox.getAttribute("data-index")));
      }
    });
    console.log("[script.js] -> Индексы для удаления:", indexesToDelete);
    orders = orders.filter((_, idx) => !indexesToDelete.includes(idx));
    renderOrders();
    updateDatalists();
    saveOrders();
  });

  // Удаление всех заказов
  deleteAllBtn.addEventListener("click", () => {
    console.log("[script.js] -> Запрос на удаление всех заказов");
    if (confirm("Удалить все заказы?")) {
      orders = [];
      renderOrders();
      updateDatalists();
      saveOrders();
    }
  });

  // Старт: загружаем заказы
  loadOrders();
});
