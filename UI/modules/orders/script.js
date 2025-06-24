document.addEventListener("DOMContentLoaded", () => {
  const tabContent = document.getElementById("tabContent");
  const tabLinks = document.querySelectorAll(".tab-link");

  // Проверяем, нет ли в URL параметра tab=...
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "statistics"; 
  // Если ?tab не передан, по умолчанию статистика

  loadTabContent(initialTab); // Грузим ту вкладку, которая указана в параметре

  // Вешаем обработчики на пункты меню
  tabLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      const tab = link.getAttribute("data-tab");
      if (tab) {
        loadTabContent(tab);
      }
    });
  });

  function loadTabContent(tab) {
    switch(tab) {
      case "statistics":
        if (typeof window.loadStatistics === "function") {
          window.loadStatistics(tabContent);
        } else {
          console.error("Функция loadStatistics не найдена!");
        }
        break;

      case "outgoing":
        loadOutgoingOrders();
        break;

      case "completed":
        loadCompletedOrders();
        break;

      case "addCompleted":
        // Переходим на страницу добавления заказа
        window.location.href = "addOrder/index.html";
        break;

      case "action":
        tabContent.innerHTML = `
          <h2>Выполнить действие</h2>
          <p>Здесь можно запустить скрипты Puppeteer или другие операции.</p>
        `;
        break;

      default:
        tabContent.innerHTML = "<h2>Выберите пункт меню</h2>";
    }
  }

  // Исходящие заказы
  function loadOutgoingOrders() {
    tabContent.innerHTML = "<h2>Исходящие заказы</h2><p>Загрузка...</p>";
    fetch("/inputConfig")
      .then(response => {
        if (!response.ok) {
          throw new Error(`Ошибка загрузки: статус ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) {
          tabContent.innerHTML = "<p>Неверный формат inputConfig.json</p>";
          return;
        }
        let html = "<h2>Исходящие заказы</h2>";
        html += `<table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Account</th>
              <th>Promocode</th>
              <th>Client</th>
            </tr>
          </thead>
          <tbody>`;
        data.forEach(order => {
          html += `
            <tr>
              <td>${order.orderID || ""}</td>
              <td>${order.Account || ""}</td>
              <td>${order.Promocode || ""}</td>
              <td>${order.client || ""}</td>
            </tr>`;
        });
        html += "</tbody></table>";
        tabContent.innerHTML = html;
      })
      .catch(error => {
        console.error("Ошибка загрузки исходящих заказов:", error);
        tabContent.innerHTML = `<p>Ошибка: ${error.message}</p>`;
      });
  }

  // Исполненные заказы
  function loadCompletedOrders() {
    tabContent.innerHTML = "<h2>Исполненные заказы</h2><p>Загрузка...</p>";
    fetch("/OrdersData/ordersData.json")
      .then(response => {
        if (!response.ok) {
          throw new Error(`Ошибка загрузки: статус ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) {
          tabContent.innerHTML = "<p>Неверный формат ordersData.json</p>";
          return;
        }
        let html = "<h2>Исполненные заказы</h2>";
        html += `<table>
          <thead>
            <tr>
              <th>Номер заказа</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Сумма (USD)</th>
              <th>Сумма (RUB)</th>
              <th>Аккаунт</th>
              <th>Метод оплаты</th>
              <th>Статус оплаты</th>
            </tr>
          </thead>
          <tbody>`;
        data.forEach(order => {
          const usd = order.price && order.price.usd ? order.price.usd : "";
          const rub = order.price && order.price.rub ? order.price.rub : "";
          html += `
            <tr>
              <td>${order.orderNumber || ""}</td>
              <td>${order.date || ""}</td>
              <td>${order.client || ""}</td>
              <td>${usd}</td>
              <td>${rub}</td>
              <td>${order.orderAccount || ""}</td>
              <td>${order.paymentMethod || ""}</td>
              <td>${order.paymentStatus ? "Оплачено" : "Не оплачено"}</td>
            </tr>`;
        });
        html += "</tbody></table>";
        tabContent.innerHTML = html;
      })
      .catch(error => {
        console.error("Ошибка загрузки исполненных заказов:", error);
        tabContent.innerHTML = `<p>Ошибка: ${error.message}</p>`;
      });
  }
});
