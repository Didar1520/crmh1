(async function(){
    // Заданные (желательные) настройки
    const DESIRED_COUNTRY = "KZ";
    const DESIRED_LANGUAGE = "ru-RU"; // предполагаем, что "Русский" соответствует ru-RU
    const DESIRED_CURRENCY = "USD";
  
    // Функция случайной паузы от 1 до 3 секунд
    function randomSleep() {
      const ms = 1000 + Math.random() * 2000;
      console.log(`Sleeping for ${ms.toFixed(0)} ms`);
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  
    // Функция ожидания элемента по селектору
    function waitForSelector(selector, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const interval = setInterval(() => {
          const el = document.querySelector(selector);
          if (el) {
            clearInterval(interval);
            resolve(el);
          } else if (Date.now() - start > timeout) {
            clearInterval(interval);
            reject(new Error("Timeout waiting for " + selector));
          }
        }, 100);
      });
    }
  
    // 1. Считываем текущие настройки из шапки (selected-country-wrapper)
    const headerWrapper = document.querySelector('div.iherb-header-ccl .selected-country-wrapper');
    if (!headerWrapper) {
      console.error("Элемент .selected-country-wrapper не найден");
      return;
    }
    const currentCountry = headerWrapper.querySelector('.country-select .country-code-flag')?.textContent.trim();
    const currentLanguageText = headerWrapper.querySelector('.language-select span')?.textContent.trim();
    // Если текст равен "RU", считаем его как ru-RU
    const currentLanguage = (currentLanguageText && currentLanguageText.toLowerCase() === "ru") ? "ru-RU" : currentLanguageText;
    const currentCurrency = headerWrapper.querySelector('.currency-select span')?.textContent.trim();
  
    console.log("Текущие настройки:");
    console.log("Страна:", currentCountry);
    console.log("Язык:", currentLanguage);
    console.log("Валюта:", currentCurrency);
  
    let needChange = false;
    if (currentCountry !== DESIRED_COUNTRY) {
      console.log(`Страна должна быть ${DESIRED_COUNTRY}, а сейчас ${currentCountry}`);
      needChange = true;
    }
    if (currentLanguage !== DESIRED_LANGUAGE) {
      console.log(`Язык должен быть ${DESIRED_LANGUAGE}, а сейчас ${currentLanguage}`);
      needChange = true;
    }
    if (currentCurrency !== DESIRED_CURRENCY) {
      console.log(`Валюта должна быть ${DESIRED_CURRENCY}, а сейчас ${currentCurrency}`);
      needChange = true;
    }
    if (!needChange) {
      console.log("Настройки верны – изменений не требуется");
      return;
    }
  
    // 2. Открываем попап, кликая по headerWrapper
    console.log("Открываем попап настроек...");
    headerWrapper.click();
    await randomSleep();
  
    // Ждем появления попапа (элемент .selection-list-wrapper)
    let popup;
    try {
      popup = await waitForSelector('div.selection-list-wrapper', 10000);
      console.log("Попап появился");
    } catch (e) {
      console.error("Попап не появился:", e);
      return;
    }
  
    // 3. Функция для обновления настройки в попапе
    async function updateSetting(dropdownSelector, desiredValue, settingName) {
      console.log(`Обновляем ${settingName} → желаемое значение: ${desiredValue}`);
      const container = popup.querySelector(dropdownSelector);
      if (!container) {
        console.error(`Контейнер "${dropdownSelector}" для ${settingName} не найден`);
        return false;
      }
      const label = container.querySelector('label.gh-form-control');
      if (!label) {
        console.error(`Label не найден в ${dropdownSelector} для ${settingName}`);
        return false;
      }
      // Двойной клик по label для открытия дропдауна
      label.click();
      await randomSleep();
      label.click();
      await randomSleep();
  
      // Меню должно быть внутри контейнера
      const menu = container.querySelector('.gh-dropdown-menu');
      if (!menu) {
        console.error(`Меню не найдено в ${dropdownSelector} для ${settingName}`);
        return false;
      }
      // Подождем немного, чтобы меню полностью открылось
      await randomSleep();
      // Ищем пункт меню с data-val = desiredValue
      let item = menu.querySelector(`.gh-dropdown-menu-item[data-val="${desiredValue}"]`);
      if (!item) {
        console.error(`Пункт меню с data-val="${desiredValue}" для ${settingName} не найден`);
        return false;
      }
      console.log(`Найден пункт для ${settingName}. Выполняем двойной клик по нему`);
      item.click();
      await randomSleep();
      item.click();
      await randomSleep();
      return true;
    }
  
    let changeMade = false;
    // Обновляем страну, если требуется
    if (currentCountry !== DESIRED_COUNTRY) {
      const res = await updateSetting('div.select-country.gh-dropdown', DESIRED_COUNTRY, "Страна");
      if (res) { console.log("Страна обновлена"); changeMade = true; }
    }
    // Обновляем язык, если требуется
    if (currentLanguage !== DESIRED_LANGUAGE) {
      const res = await updateSetting('div.select-language.gh-dropdown', DESIRED_LANGUAGE, "Язык");
      if (res) { console.log("Язык обновлен"); changeMade = true; }
    }
    // Обновляем валюту, если требуется
    if (currentCurrency !== DESIRED_CURRENCY) {
      const res = await updateSetting('div.select-currency.gh-dropdown', DESIRED_CURRENCY, "Валюта");
      if (res) { console.log("Валюта обновлена"); changeMade = true; }
    }
  
    // 4. Если изменения внесены, кликаем кнопку «Сохранить»
    // if (changeMade) {
    //   console.log("Нажимаем кнопку «Сохранить»");
    //   await randomSleep();
    //   const saveButton = popup.querySelector('button.save-selection.gh-btn.gh-btn-primary');
    //   if (saveButton) {
    //     saveButton.click();
    //     console.log("Кнопка «Сохранить» нажата");
    //   } else {
    //     console.error("Кнопка «Сохранить» не найдена в попапе");
    //   }
    // } else {
    //   console.log("Изменений не внесено – настройки остаются прежними");
    // }
  })();
  