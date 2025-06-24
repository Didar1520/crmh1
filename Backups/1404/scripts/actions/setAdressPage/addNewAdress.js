/**
 * addNewAdress.js
 * ------------------------------------------------
 * Добавление нового адреса. Перед заполнением формы убеждаемся,
 * что страница действительно готова (нет спиннеров) и решаем капчу,
 * если она появилась.
 */

const selectors = {
  addAddressUrl: 'https://checkout12.iherb.com/users/address-book/add-new-address',
  fullNameInput: 'input[name="FullName"]',
  addressLine1Input: 'input[name="AddressLine1"]',
  cityInput: 'input[name="City"]',
  regionInput: 'input[name="RegionName"]',
  postalCodeInput: 'input[name="PostalCode"]',
  phoneNumberInput: 'input[name="PhoneNumber"]',
  defaultAddressCheckbox: 'input.PrivateSwitchBase-input',
  saveAddressButton: 'a.css-1nai84k',
  // Укажите реальный селектор спиннера, если он отличается
  spinnerSelector: 'div.spinner-wrapper'
};

async function waitForSpinnerToDisappear(page, maxWait = 5000) {
  const start = Date.now();
  let spinnerAppeared = false;
  try {
    await page.waitForSelector(selectors.spinnerSelector, { timeout: 1000 });
    spinnerAppeared = true;
    console.log('[addNewAdress] -> Спиннер появился, ждём исчезновения...');
  } catch {
    // Спиннер не появился за 1 сек
  }
  if (spinnerAppeared) {
    try {
      await page.waitForSelector(selectors.spinnerSelector, { hidden: true, timeout: maxWait - (Date.now() - start) });
      console.log('[addNewAdress] -> Спиннер исчез, можно работать.');
    } catch {
      console.log('[addNewAdress] -> Спиннер не исчез за 5 сек...');
      return false;
    }
  }
  return true;
}

async function addNewAddress(page, addressData) {
  let reloadAttempts = 0;

  while (reloadAttempts < 3) {
    try {
      // 1) Переход на страницу добавления нового адреса
      await page.goto(selectors.addAddressUrl, { waitUntil: 'networkidle2' });
      console.log('[addNewAdress] -> Переход на страницу add-new-address');

      // 2) (Опционально) Если у вас есть своя утилита ожидания полной загрузки страницы,
      // вызовите её здесь, например:
      // await myWaitForPageLoad(page);

      // 3) Решаем капчу, если она появилась, и ждём полной загрузки страницы
      try {
        await checkAndSolveCaptchaInPlace(page, null, 15000);
      } catch (err) {
        console.log('[addNewAdress] -> Ошибка checkAndSolveCaptchaInPlace:', err);
      }
      
      // 4) Ждём, пока не зависнет спиннер (или не появится)
      const spinnerOk = await waitForSpinnerToDisappear(page, 5000);
      if (!spinnerOk) {
        console.log('[addNewAdress] -> Спиннер завис, пробуем перезагрузить страницу...');
        reloadAttempts++;
        continue;
      }

      // 5) Проверяем, что URL правильный
      const currentURL = page.url();
      console.log(`[addNewAdress] -> currentURL=${currentURL}`);
      if (!currentURL.includes('/users/address-book/add-new-address')) {
        throw new Error(`[addNewAdress] -> Неправильная страница! URL=${currentURL}`);
      }

      // 6) Ждём появления формы
      await page.waitForSelector(selectors.fullNameInput, { timeout: 10000 });
      console.log('[addNewAdress] -> Форма добавления адреса загружена.');

      // Проверяем наличие всех необходимых полей
      const fields = [
        selectors.fullNameInput,
        selectors.addressLine1Input,
        selectors.cityInput,
        selectors.regionInput,
        selectors.postalCodeInput,
        selectors.phoneNumberInput,
        selectors.defaultAddressCheckbox,
        selectors.saveAddressButton
      ];
      for (const field of fields) {
        const exists = await page.$(field);
        if (!exists) {
          throw new Error(`[addNewAdress] -> "${field}" не найден!`);
        }
      }
      console.log('[addNewAdress] -> Все необходимые поля присутствуют.');

      // 7) Заполняем форму
      // Из addressData используются поля: FullName, Street, City, Region, Post, Number.
      // Остальные поля (Name, MiddleName, Surname, Pasport) не используются.
      const parts = addressData.FullName.trim().split(/\s+/);
      const fullName = parts.length > 2 ? parts.slice(0, 2).join(' ') : addressData.FullName.trim();

      await page.type(selectors.fullNameInput, fullName);
      await page.type(selectors.addressLine1Input, addressData.Street);
      await page.type(selectors.cityInput, addressData.City);
      await page.type(selectors.regionInput, addressData.Region);

      // Приводим значение почтового индекса к строке
      const postString = addressData.Post ? addressData.Post.toString() : '';
      await page.type(selectors.postalCodeInput, postString);

      // Формируем строку телефона (например, добавляя +)
      const phoneString = addressData.Number ? `+${addressData.Number.toString()}` : '+';
      await page.type(selectors.phoneNumberInput, phoneString);
      console.log('[addNewAdress] -> Форма заполнена.');

      // 8) Устанавливаем адрес как "по умолчанию"
      await page.click(selectors.defaultAddressCheckbox);
      console.log('[addNewAdress] -> Адрес по умолчанию установлен.');

      // 9) Сохраняем адрес (ожидаем навигации)
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click(selectors.saveAddressButton)
      ]);
      console.log('[addNewAdress] -> Новый адрес сохранён!');

      // Если успешно, выходим из цикла
      return;
    } catch (err) {
      console.log('[addNewAdress] -> Ошибка:', err.message);
      reloadAttempts++;
      if (reloadAttempts >= 3) {
        console.log('[addNewAdress] -> Превышен лимит перезагрузок. Бросаем ошибку.');
        throw err;
      }
      console.log('[addNewAdress] -> Пробуем ещё раз (reloadAttempt=' + reloadAttempts + ')...');
      await page.reload({ waitUntil: 'networkidle2' });
    }
  }
}

module.exports = addNewAddress;
