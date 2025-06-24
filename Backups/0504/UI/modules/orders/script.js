document.addEventListener("DOMContentLoaded", () => {
    const menuItems = document.querySelectorAll(".orders-menu li");
    const tabContent = document.getElementById("tabContent");
  
    menuItems.forEach(item => {
      item.addEventListener("click", () => {
        const tab = item.getAttribute("data-tab");
        console.log("Переключение на таб:", tab);
        loadTabContent(tab);
      });
    });
  
    function loadTabContent(tab) {
      switch(tab) {
        case "outgoing":
          loadOutgoingOrders();
          break;
        case "completed":
          tabContent.innerHTML = "<h2>Исполненные заказы</h2><p>ordersData.json успешно подключен.</p>";
          break;
        case "add":
          // Перенаправление на модуль добавления заказа
          window.location.href = "addOrder/index.html";
          break;
        case "action":
          tabContent.innerHTML = "<h2>Выполнить действие</h2><p>Выберите действие для выполнения.</p>";
          break;
        default:
          tabContent.innerHTML = "<h2>Выберите пункт меню</h2>";
      }
    }
  
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
          console.log("Исходящие заказы:", data);
          if (!Array.isArray(data)) {
            tabContent.innerHTML = "<p>Неверный формат данных.</p>";
            return;
          }
          let html = `<h2>Исходящие заказы</h2>`;
          html += `<table border="1" cellpadding="5" cellspacing="0">
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
            html += `<tr>
              <td>${order.orderID}</td>
              <td>${order.Account}</td>
              <td>${order.Promocode}</td>
              <td>${order.client}</td>
            </tr>`;
          });
          html += `</tbody></table>`;
          tabContent.innerHTML = html;
        })
        .catch(error => {
          console.error("Ошибка загрузки исходящих заказов:", error);
          tabContent.innerHTML = `<p>Ошибка загрузки исходящих заказов: ${error.message}</p>`;
        });
    }
  });
  