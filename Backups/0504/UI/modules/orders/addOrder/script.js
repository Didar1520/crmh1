document.addEventListener("DOMContentLoaded", () => {
  // Кнопка "Назад"
  const backBtn = document.getElementById("backBtn");
  backBtn.addEventListener("click", () => {
    window.location.href = "../index.html";
  });

  // Заполнение datalist для клиентов, аккаунтов и адресов
  function populateDatalist(endpoint, datalistId, fieldName, transformFn) {
    fetch(endpoint)
      .then(response => {
        if (!response.ok) throw new Error(`Ошибка загрузки данных с ${endpoint}`);
        return response.json();
      })
      .then(data => {
        const datalist = document.getElementById(datalistId);
        datalist.innerHTML = "";
        let items = [];
        // Если данные уже в виде массива или внутри объекта
        if (Array.isArray(data)) {
          items = data;
        } else {
          // Для clients и accounts у нас объекты, где массив хранится в свойстве
          items = data[ fieldName ] || [];
        }
        items.forEach(item => {
          let value = "";
          if (typeof item === "string") {
            value = item;
          } else {
            value = item.email || item.name || item.FullName || item.Name || "";
          }
          // Если поле адреса – убрать отчество, если ФИО содержит более двух слов
          if (datalistId === "addressList" && value.trim().split(" ").length > 2) {
            const parts = value.trim().split(" ");
            value = parts[0]; // Берём только первое слово
          }
          const option = document.createElement("option");
          option.value = value;
          datalist.appendChild(option);
        });
      })
      .catch(error => console.error("Ошибка при заполнении datalist:", error));
  }

  // Заполняем дропдауны для клиентов, аккаунтов и адресов
  populateDatalist("/clientData", "clientList", "clients");
  populateDatalist("/accData", "orderAccountList", "accounts");
  populateDatalist("/adressList", "addressList");

  // Кнопка извлечь информацию из сообщения iHerb
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

  // Кнопка для установки текущей даты и времени
  const nowBtn = document.getElementById("nowBtn");
  nowBtn.addEventListener("click", () => {
    const now = new Date();
    const formatted = now.toISOString().slice(0, 16);
    document.getElementById("orderDate").value = formatted;
  });

  // Кнопка для расчёта цены по курсу (calculatedPrice = priceUsd * rate)
  const calcPriceBtn = document.getElementById("calcPriceBtn");
  calcPriceBtn.addEventListener("click", () => {
    const priceUsd = parseFloat(document.getElementById("priceUsd").value);
    const rate = parseFloat(document.getElementById("rate").value);
    if (isNaN(priceUsd) || isNaN(rate)) {
      alert("Введите корректное значение для цены USD и курса");
      return;
    }
    const calculated = priceUsd * rate;
    document.getElementById("calculatedPrice").value = calculated.toFixed(2);
  });

  // Обработка формы "Добавить заказ"
  const addOrderForm = document.getElementById("addOrderForm");
  addOrderForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(addOrderForm);
    
    const newOrder = {
      orderNumber: formData.get("orderNumber"),
      trackCode: formData.get("trackCode"),
      date: formData.get("orderDate"),
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
      orderId: parseInt(formData.get("orderId")) || 0,
      client: formData.get("client"),
      paymentMethod: formData.get("paymentMethod"),
      paymentStatus: formData.get("paymentStatus"),
      orderAccount: formData.get("orderAccount"),
      cartLink: formData.get("cartLink"),
      deliveryAddress: formData.get("deliveryAddress"),
      promoCodeUsed: formData.get("promoCodeUsed"),
      referralCodeUsed: formData.get("referralCodeUsed"),
      cardUsed: formData.get("cardUsed"),
      rewardsUsed: parseFloat(formData.get("rewardsUsed")) || 0
    };

    console.log("Новый заказ:", newOrder);
    
    // Загружаем существующие исполненные заказы из /ordersData, добавляем новый и сохраняем через /saveOrdersData
    fetch("/ordersData")
      .then(response => {
        if (!response.ok) {
          throw new Error("Ошибка загрузки существующих заказов");
        }
        return response.json();
      })
      .then(data => {
        if (!data.orders || !Array.isArray(data.orders)) {
          data.orders = [];
        }
        data.orders.push(newOrder);
        return fetch("/saveOrdersData", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.orders)
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
      })
      .catch(error => {
        console.error("Ошибка при добавлении заказа:", error);
        document.getElementById("formMessage").textContent = "Ошибка: " + error.message;
      });
  });
});
