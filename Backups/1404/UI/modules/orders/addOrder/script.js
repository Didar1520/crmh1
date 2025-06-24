/* File: CRM/UI/modules/orders/addOrder/script.js */
document.addEventListener("DOMContentLoaded", () => {
  // Кнопка "Назад"
  const backBtn = document.getElementById("backBtn");
  backBtn.addEventListener("click", () => {
    window.location.href = "../../../index.html";
  });

  // Заполнение datalist для клиентов, аккаунтов и адресов
  function populateDatalist(endpoint, datalistId, fieldName) {
    fetch(endpoint)
      .then(response => {
        if (!response.ok) throw new Error(`Ошибка загрузки данных с ${endpoint}`);
        return response.json();
      })
      .then(data => {
        const datalist = document.getElementById(datalistId);
        datalist.innerHTML = "";
        let items = [];
        if (Array.isArray(data)) {
          items = data;
        } else {
          items = data[fieldName] || [];
        }
        items.forEach(item => {
          let value = "";
          if (typeof item === "string") {
            value = item;
          } else {
            value = item.email || item.name || item.FullName || item.Name || "";
          }
          if (datalistId === "addressList" && value.trim().split(" ").length > 2) {
            const parts = value.trim().split(" ");
            value = parts[0];
          }
          const option = document.createElement("option");
          option.value = value;
          datalist.appendChild(option);
        });
      })
      .catch(error => console.error("Ошибка при заполнении datalist:", error));
  }

  populateDatalist("/clientData", "clientList", "clients");
  populateDatalist("/accData", "orderAccountList", "accounts");
  populateDatalist("/adressList", "addressList");

  // Загрузка данных способов оплаты и статусов из файла paymentData.json
  // Файл находится по следующему пути относительно корневой папки CRM:
  // CRM/UI/modules/orders/addOrder/Data/paymentData.json
  // Поэтому используем относительный путь "Data/paymentData.json"
  fetch("Data/paymentData.json")
    .then(response => {
      if (!response.ok) throw new Error("Ошибка загрузки paymentData.json");
      return response.json();
    })
    .then(data => {
      const paymentMethodContainer = document.getElementById("paymentMethodContainer");
      const paymentStatusContainer = document.getElementById("paymentStatusContainer");

      // Создаем радиокнопки для способов оплаты
      data.paymentMethods.forEach(method => {
        const label = document.createElement("label");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "paymentMethod";
        radio.value = method;
        label.appendChild(radio);
        label.appendChild(document.createTextNode(" " + method));
        paymentMethodContainer.appendChild(label);
      });

      // Создаем радиокнопки для статусов оплаты
      data.paymentStatuses.forEach(status => {
        const label = document.createElement("label");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "paymentStatus";
        radio.value = status;
        label.appendChild(radio);
        label.appendChild(document.createTextNode(" " + status));
        paymentStatusContainer.appendChild(label);
      });
    })
    .catch(error => console.error("Ошибка при загрузке данных способов оплаты:", error));

  // Извлечение информации из сообщения iHerb
  const extractBtn = document.getElementById("extractBtn");
  extractBtn.addEventListener("click", () => {
    const rawText = document.getElementById("rawMessage").value;
    const orderNumberMatch = rawText.match(/Ваш заказ\s*№\s*(\d+)/i);
    const emailMatch = rawText.match(/подтверждением на адрес\s*([\w.-]+@[\w.-]+\.[A-Za-z]{2,6})/i);
    const usdMatch = rawText.match(/\$\s*([\d.,]+)/);
    
    if (orderNumberMatch) {
      document.getElementById("orderNumber").value = orderNumberMatch[1];
    }
    if (emailMatch) {
      document.getElementById("orderAccount").value = emailMatch[1];
    }
    if (usdMatch) {
      document.getElementById("priceUsd").value = usdMatch[1].replace(',', '.');
    }
  });

  // Установка текущей даты и времени
  const nowBtn = document.getElementById("nowBtn");
  nowBtn.addEventListener("click", () => {
    const now = new Date();
    const isoString = now.toISOString();
    const formatted = isoString.slice(0,16);
    document.getElementById("orderDate").value = formatted;
  });

  // Функция для преобразования даты из "YYYY-MM-DDTHH:mm" в "DD-MM-YYYY HH:mm"
  function formatDate(inputDate) {
    const dateObj = new Date(inputDate);
    const day = ("0" + dateObj.getDate()).slice(-2);
    const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
    const year = dateObj.getFullYear();
    const hours = ("0" + dateObj.getHours()).slice(-2);
    const minutes = ("0" + dateObj.getMinutes()).slice(-2);
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  // Предзаполнение формы данными из последнего заказа и вычисление нового orderId
  fetch("/ordersData")
    .then(response => {
      if (!response.ok) throw new Error("Ошибка загрузки существующих заказов");
      return response.json();
    })
    .then(data => {
      let orders = [];
      if (data.orders && Array.isArray(data.orders)) {
        orders = data.orders;
      }
      // Вычисляем новый orderId как max(orderId)+1 или 0, если заказов нет
      let newOrderId = 0;
      if (orders.length > 0) {
        newOrderId = Math.max(...orders.map(o => o.orderId)) + 1;
        // Предзаполняем поля из последнего заказа
        const lastOrder = orders.reduce((prev, curr) => (curr.orderId > prev.orderId ? curr : prev), orders[0]);
        const fieldsToPrefill = ["client", "orderAccount", "commissionPercent", "promoCodeUsed", "referralCodeUsed", "cardUsed", "rewardsUsed"];
        fieldsToPrefill.forEach(field => {
          const element = document.getElementById(field);
          if (element && lastOrder[field] !== undefined) {
            element.value = lastOrder[field];
            element.classList.add("prefilled");
          }
        });
        // Для радиокнопок (paymentMethod и paymentStatus)
        if (lastOrder.paymentMethod) {
          const paymentRadios = document.getElementsByName("paymentMethod");
          paymentRadios.forEach(radio => {
            if (radio.value === lastOrder.paymentMethod) {
              radio.checked = true;
              radio.parentElement.classList.add("prefilled");
            }
          });
        }
        if (lastOrder.paymentStatus) {
          const statusRadios = document.getElementsByName("paymentStatus");
          statusRadios.forEach(radio => {
            if (radio.value === lastOrder.paymentStatus) {
              radio.checked = true;
              radio.parentElement.classList.add("prefilled");
            }
          });
        }
      }
      // Отображаем вычисленный orderId
      document.getElementById("orderIdDisplay").value = newOrderId;
    })
    .catch(error => {
      console.error("Ошибка при предварительном заполнении данных:", error);
      document.getElementById("orderIdDisplay").value = 0;
    });

  // Обработка отправки формы
  const addOrderForm = document.getElementById("addOrderForm");
  addOrderForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(addOrderForm);

    // Получаем вычисленный orderId
    const orderId = parseInt(document.getElementById("orderIdDisplay").value) || 0;

    // Преобразуем дату заказа в требуемый формат, если указана
    let orderDateFormatted = "";
    const orderDateValue = formData.get("orderDate");
    if (orderDateValue) {
      orderDateFormatted = formatDate(orderDateValue);
    }

    const newOrder = {
      orderNumber: formData.get("orderNumber"),
      trackCode: formData.get("trackCode"),
      date: orderDateFormatted,
      price: {
        rub: parseFloat(formData.get("priceRub")) || 0,
        commission: (() => {
          const rub = parseFloat(formData.get("priceRub")) || 0;
          const percent = parseFloat(formData.get("commissionPercent")) || 0;
          return +(rub * (1 + percent / 100)).toFixed(2);
        })(),
        usd: parseFloat(formData.get("priceUsd")) || 0
      },
      calculatedPrice: parseFloat(document.getElementById("calculatedPrice").value) || 0,
      rate: parseFloat(formData.get("rate")) || 0,
      bybitRate: parseFloat(formData.get("bybitRate")) || 0,
      orderId: orderId,
      client: formData.get("client"),
      paymentMethod: formData.get("paymentMethod") || "",
      paymentStatus: formData.get("paymentStatus") || "",
      orderAccount: formData.get("orderAccount"),
      cartLink: formData.get("cartLink"),
      deliveryAddress: formData.get("deliveryAddress"),
      promoCodeUsed: formData.get("promoCodeUsed"),
      referralCodeUsed: formData.get("referralCodeUsed"),
      cardUsed: formData.get("cardUsed"),
      rewardsUsed: parseFloat(formData.get("rewardsUsed")) || 0
    };

    console.log("Новый заказ:", newOrder);
    
    // Загружаем существующие заказы, добавляем новый и сохраняем их
    fetch("/ordersData")
      .then(response => {
        if (!response.ok) {
          throw new Error("Ошибка загрузки существующих заказов");
        }
        return response.json();
      })
      .then(data => {
        let orders = [];
        if (data.orders && Array.isArray(data.orders)) {
          orders = data.orders;
        }
        orders.push(newOrder);
        return fetch("/saveOrdersData", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orders)
        });
      })
      .then(response => {
        if (!response.ok) {
          throw new Error("Ошибка сохранения нового заказа");
        }
        return response.json();
      })
      .then(result => {
        console.log("Заказ успешно сохранён:", result);
        document.getElementById("formMessage").textContent = "Заказ успешно добавлен!";
        addOrderForm.reset();
        // Удаляем класс prefilled
        document.querySelectorAll(".prefilled").forEach(el => el.classList.remove("prefilled"));
      })
      .catch(error => {
        console.error("Ошибка при добавлении заказа:", error);
        document.getElementById("formMessage").textContent = "Ошибка: " + error.message;
      });
  });

  // Обработчик кнопки сброса – очищает все поля
  const resetBtn = document.getElementById("resetBtn");
  resetBtn.addEventListener("click", () => {
    addOrderForm.reset();
    document.querySelectorAll(".prefilled").forEach(el => el.classList.remove("prefilled"));
  });
});
