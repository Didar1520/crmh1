document.addEventListener("DOMContentLoaded", () => {
    const orderForm = document.getElementById("orderForm");
    const orderListDiv = document.getElementById("orderList");
    const backBtn = document.getElementById("backBtn");
    const selectAllBtn = document.getElementById("selectAllBtn");
    const deselectAllBtn = document.getElementById("deselectAllBtn");
    const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
  
    let orders = [];
    let nextOrderID = 1;
    // Для сохранения предыдущих значений, чтобы не очищать поля: Account, Promocode, rederalLink, client.
    let lastStaticValues = {
      Account: "",
      Promocode: "",
      rederalLink: "",
      client: ""
    };
  
    // Функция загрузки заказов из inputConfig.json
    function loadOrders() {
      fetch("/inputConfig")
        .then(response => {
          if (!response.ok) throw new Error(`Ошибка загрузки: статус ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            orders = data;
            // Определяем следующий orderID как max(existing orderIDs)+1
            nextOrderID = orders.reduce((max, order) => Math.max(max, parseInt(order.orderID) || 0), 0) + 1;
            renderOrders();
            prepopulateForm();
          }
        })
        .catch(error => {
          console.error("Ошибка при загрузке заказов:", error);
          orderListDiv.textContent = "Ошибка загрузки заказов: " + error.message;
        });
    }
  
    // Функция сохранения заказов в inputConfig.json
    function saveOrders() {
      fetch("/saveConfig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orders)
      })
        .then(response => {
          if (!response.ok) throw new Error(`Ошибка сохранения: статус ${response.status}`);
          return response.json();
        })
        .then(result => {
          console.log("Заказы успешно сохранены:", result);
          renderOrders();
        })
        .catch(error => {
          console.error("Ошибка сохранения заказов:", error);
          alert("Ошибка сохранения заказов: " + error.message);
        });
    }
  
    // Функция рендеринга списка заказов
    function renderOrders() {
      orderListDiv.innerHTML = "";
      orders.forEach((order, index) => {
        const div = document.createElement("div");
        div.className = "order-item";
        div.innerHTML = `
          <div class="order-details">
            <input type="checkbox" class="select-order" data-index="${index}">
            <strong>ID:</strong> ${order.orderID} | <strong>Клиент:</strong> ${order.client} | 
            <strong>Аккаунт:</strong> ${order.Account} | <strong>Промокод:</strong> ${order.Promocode}
          </div>
          <div class="order-actions">
            <button class="editBtn" data-index="${index}">Редактировать</button>
            <button class="deleteBtn" data-index="${index}">Удалить</button>
          </div>
        `;
        orderListDiv.appendChild(div);
      });
    }
  
    // Функция предзаполнения формы при загрузке (с сохранением предыдущих значений)
    function prepopulateForm() {
      orderForm.orderID.value = nextOrderID;
      orderForm.Account.value = lastStaticValues.Account;
      orderForm.Promocode.value = lastStaticValues.Promocode;
      orderForm.rederalLink.value = lastStaticValues.rederalLink;
      orderForm.client.value = lastStaticValues.client;
      // Очистить поля CartLink
      orderForm.CartLink.value = "";
    }
  
    // Обработка отправки формы для добавления нового заказа
    orderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(orderForm);
      const newOrder = {
        Account: formData.get("Account"),
        Promocode: formData.get("Promocode"),
        rederalLink: formData.get("rederalLink"),
        orderID: parseInt(formData.get("orderID")) || nextOrderID,
        CartLink: formData.get("CartLink"),
        client: formData.get("client"),
        setAdressPage: orderForm.setAdressPage.checked,
        syncOrders: orderForm.syncOrders.checked,
        syncReviews: orderForm.syncReviews.checked,
        reviewManager: orderForm.reviewManager.checked,
        syncRewards: orderForm.syncRewards.checked
      };
  
      // Сохранить статические значения для следующих заказов
      lastStaticValues.Account = newOrder.Account;
      lastStaticValues.Promocode = newOrder.Promocode;
      lastStaticValues.rederalLink = newOrder.rederalLink;
      lastStaticValues.client = newOrder.client;
  
      orders.push(newOrder);
      nextOrderID++;
      saveOrders();
      prepopulateForm();
    });
  
    // Обработка кликов по кнопкам редактирования и удаления в списке заказов
    orderListDiv.addEventListener("click", (e) => {
      const index = e.target.getAttribute("data-index");
      if (e.target.classList.contains("deleteBtn")) {
        orders.splice(index, 1);
        saveOrders();
      }
      if (e.target.classList.contains("editBtn")) {
        // Заполнить форму данными выбранного заказа для редактирования
        const order = orders[index];
        orderForm.Account.value = order.Account;
        orderForm.Promocode.value = order.Promocode;
        orderForm.rederalLink.value = order.rederalLink;
        orderForm.CartLink.value = order.CartLink;
        orderForm.client.value = order.client;
        orderForm.orderID.value = order.orderID;
        orderForm.setAdressPage.checked = order.setAdressPage;
        orderForm.syncOrders.checked = order.syncOrders;
        orderForm.syncReviews.checked = order.syncReviews;
        orderForm.reviewManager.checked = order.reviewManager;
        orderForm.syncRewards.checked = order.syncRewards;
        // Удалить старую запись, чтобы при сохранении изменённая запись добавилась как новая
        orders.splice(index, 1);
        saveOrders();
      }
    });
  
    // Обработка кнопок массовых действий
    selectAllBtn.addEventListener("click", () => {
      document.querySelectorAll(".select-order").forEach(checkbox => {
        checkbox.checked = true;
      });
    });
  
    deselectAllBtn.addEventListener("click", () => {
      document.querySelectorAll(".select-order").forEach(checkbox => {
        checkbox.checked = false;
      });
    });
  
    deleteSelectedBtn.addEventListener("click", () => {
      const toDelete = [];
      document.querySelectorAll(".select-order").forEach((checkbox, idx) => {
        if (checkbox.checked) {
          toDelete.push(idx);
        }
      });
      // Удаляем записи в обратном порядке, чтобы не нарушить индексы
      toDelete.sort((a, b) => b - a);
      toDelete.forEach(idx => orders.splice(idx, 1));
      saveOrders();
    });
  
    // Кнопка "Назад"
    backBtn.addEventListener("click", () => {
      window.location.href = "../../index.html";
    });
  
    // Первичная загрузка заказов
    loadOrders();
  });
  