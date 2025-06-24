document.addEventListener("DOMContentLoaded", () => {
    const menuItems = document.querySelectorAll(".menu ul li");
    menuItems.forEach(item => {
      item.addEventListener("click", () => {
        const page = item.getAttribute("data-page");
        console.log("Переход на страницу:", page);
        // Здесь можно реализовать логику загрузки модулей
        // Например, динамически подгружать HTML-контент для выбранной страницы
        document.querySelector(".content").innerHTML = `<h1>${item.textContent}</h1><p>Контент для модуля "${item.textContent}".</p>`;
      });
    });
  });
  