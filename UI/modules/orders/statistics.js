// ==== UI/modules/orders/statistics.js ====

// Глобальная переменная для хранения экземпляра диаграммы
let chartInstance = null;

/**
 * Функция, которая загружает и отображает статистику заказов из ordersData.json.
 * @param {HTMLElement} tabContent - DOM-элемент, куда выводить HTML-контент статистики
 */
function loadStatistics(tabContent) {
  // Если уже есть диаграмма, уничтожаем её (это убирает утечки и повторную инициализацию)
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  // Минимальный контент до загрузки
  tabContent.innerHTML = `
    <h2>Статистика заказов</h2>
    <p>Загрузка...</p>
    <div id="chartContainer" style="width:800px; height:400px; margin-top:20px;">
      <canvas id="ordersChart" style="display:block; width:100%; height:100%;"></canvas>
    </div>
  `;

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

      // Подсчитываем общую статистику
      const totalOrders = data.length;
      let totalSumUSD = 0;
      let totalSumRUB = 0;

      data.forEach(order => {
        if (order.price) {
          if (order.price.usd) totalSumUSD += order.price.usd;
          if (order.price.rub) totalSumRUB += order.price.rub;
        }
      });

      // Счёт за текущий месяц (пример)
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      let monthOrdersCount = 0;
      let monthOrdersSumUSD = 0;

      // Для графика (кол-во заказов по месяцам):
      const monthlyCountMap = {};

      data.forEach(order => {
        if (!order.date) return;
        const dt = new Date(order.date);
        if (dt.toString() === "Invalid Date") return;

        // Если дата в текущем месяце — учитываем
        if (dt.getMonth() === currentMonth && dt.getFullYear() === currentYear) {
          monthOrdersCount++;
          if (order.price && order.price.usd) {
            monthOrdersSumUSD += order.price.usd;
          }
        }

        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyCountMap[key]) {
          monthlyCountMap[key] = 0;
        }
        monthlyCountMap[key]++;
      });

      // Генерируем финальный HTML (шапку)
      tabContent.innerHTML = `
        <h2>Статистика заказов</h2>
        <p>Общее количество исполненных заказов: <strong>${totalOrders}</strong></p>
        <p>Сумма (USD): <strong>${totalSumUSD}</strong></p>
        <p>Сумма (RUB): <strong>${totalSumRUB}</strong></p>
        <hr>
        <p>За текущий месяц (${currentYear}-${currentMonth + 1}):
          <strong>${monthOrdersCount} заказ(ов), на сумму USD ${monthOrdersSumUSD}</strong>
        </p>

        <div id="chartContainer" style="width:800px; height:400px; margin-top:20px;">
          <canvas id="ordersChart" style="display:block; width:100%; height:100%;"></canvas>
        </div>
      `;

      // Теперь ищем canvas заново (после перезаписи innerHTML)
      const canvas = document.getElementById("ordersChart");
      const ctx = canvas.getContext("2d");

      // Сортируем ключи (месяцы) по времени
      const labels = Object.keys(monthlyCountMap).sort();
      const values = labels.map(key => monthlyCountMap[key]);

      // Создаём диаграмму Chart.js
      chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Кол-во заказов по месяцам",
            data: values
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "Кол-во заказов" }
            },
            x: {
              title: { display: true, text: "Месяц" }
            }
          }
        }
      });
    })
    .catch(error => {
      console.error("Ошибка загрузки исполненных заказов:", error);
      tabContent.innerHTML = `<p>Ошибка: ${error.message}</p>`;
    });
}

// Делаем функцию видимой глобально
window.loadStatistics = loadStatistics;
