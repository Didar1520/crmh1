// customsInfo.js

const fs = require('fs');
const path = require('path');

// Загружаем адресную книгу.
// Файл находится по пути: CRM/data/adressBook/adressList.JSON
const addressListPath = path.resolve(__dirname, '../../../data/adressBook/adressList.JSON');
let addressList;
try {
  addressList = JSON.parse(fs.readFileSync(addressListPath, 'utf8'));
  console.log('[customsInfo] -> Адресная книга успешно загружена.');
} catch (error) {
  throw new Error(`[customsInfo] -> Ошибка загрузки адресной книги: ${error.message}`);
}

/**
 * Функция для заполнения таможенной информации.
 * Если данные таможенной информации уже соответствуют данным адресной книги, заполнение не производится.
 */
async function fillCustomsInfo(page) {
  console.log('[customsInfo] -> Начало заполнения таможенной информации.');

  // Проверяем, заполнены ли уже данные таможенной информации.
  // Сравниваем отображаемое имя из блока Customs с именем из адресной книги.
  try {
    const customsName = await page.$eval(
      'div.CustomsPanelInfo__Container-sc-16g5b4g-0.hDGCAU div[data-testid="customs-name"]',
      el => el.textContent.trim()
    );
    const deliveryName = await page.$eval(
      'div.DeliveryAddress__CustomerInfo-sc-vtw4ic-4.kYzWze div.DeliveryAddress__FirstName-sc-vtw4ic-3.ktFtbM',
      el => el.textContent.trim()
    );
    if (customsName && deliveryName && customsName.toLowerCase().includes(deliveryName.toLowerCase())) {
      console.log('[customsInfo] -> Данные таможенной информации уже соответствуют адресной книге, пропускаем заполнение.');
      return;
    }
  } catch (error) {
    console.log('[customsInfo] -> Не удалось проверить соответствие таможенной информации:', error.message);
    // Если не удалось проверить, продолжаем заполнение.
  }

  // 1) Нажимаем кнопку "Изменить" для открытия панели таможенной информации.
  try {
    await page.waitForSelector('#customs-panel-toggle-button > #collapse-label', { visible: true, timeout: 10000 });
    await page.click('#customs-panel-toggle-button > #collapse-label');
    console.log('[customsInfo] -> Нажата кнопка для открытия панели таможенной информации.');
  } catch (error) {
    throw new Error(`[customsInfo] -> Не удалось нажать кнопку для открытия панели: ${error.message}`);
  }

  // 2) Ждем появления инпутов.
  const selectors = {
    identificationNumber: 'input[name="identificationNumber"]',
    firstName: 'input[id="firstName"]',
    midName: 'input[name="midName"]',
    lastName: 'input[name="lastName"]',
    mobileNumber: 'input#mobileNumber'
  };

  for (const key in selectors) {
    try {
      await page.waitForSelector(selectors[key], { visible: true, timeout: 10000 });
      console.log(`[customsInfo] -> Инпут "${key}" найден.`);
    } catch (error) {
      throw new Error(`[customsInfo] -> Инпут "${key}" не найден: ${error.message}`);
    }
  }

  // 3) Получаем отображаемое имя из блока адресной книги.
  let displayedName;
  try {
    displayedName = await page.$eval(
      'div.DeliveryAddress__CustomerInfo-sc-vtw4ic-4.kYzWze div.DeliveryAddress__FirstName-sc-vtw4ic-3.ktFtbM',
      el => el.textContent.trim()
    );
    console.log(`[customsInfo] -> Отображаемое имя: "${displayedName}"`);
  } catch (error) {
    throw new Error(`[customsInfo] -> Не удалось получить отображаемое имя: ${error.message}`);
  }

  // 4) Ищем запись пользователя в адресной книге по гибкому совпадению (без учета регистра).
  const userRecord = addressList.find(record =>
    record.FullName.trim().toLowerCase().includes(displayedName.toLowerCase())
  );
  if (!userRecord) {
    throw new Error(`[customsInfo] -> Пользователь с именем "${displayedName}" не найден в адресной книге.`);
  }
  console.log(`[customsInfo] -> Найдена запись пользователя: ${JSON.stringify(userRecord)}`);

  // 5) Функция для заполнения одного инпута.
  async function fillInput(selector, value, fieldName) {
    try {
      await page.click(selector, { clickCount: 3 });
      // Очищаем поле (имитируем нажатие Backspace)
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Backspace');
      }
      await page.type(selector, String(value), { delay: 100 });
      console.log(`[customsInfo] -> Поле "${fieldName}" заполнено значением: ${value}`);
    } catch (error) {
      throw new Error(`[customsInfo] -> Ошибка при заполнении поля "${fieldName}": ${error.message}`);
    }
  }

  // 6) Заполняем поля согласно маппингу.
  await fillInput(selectors.identificationNumber, userRecord.Pasport, 'Pasport');
  await fillInput(selectors.firstName, userRecord.Name, 'Name');
  await fillInput(selectors.midName, userRecord.MiddleName, 'MiddleName');
  await fillInput(selectors.lastName, userRecord.Surname, 'Surname');
  // При заполнении номера телефона добавляем символ "+" перед значением, если его нет.
  let phoneValue = String(userRecord.Number);
  if (!phoneValue.startsWith('+')) {
    phoneValue = `+${phoneValue}`;
  }
  await fillInput(selectors.mobileNumber, phoneValue, 'Number');

  // 7) Нажимаем кнопку "Продолжить".
  try {
    await page.waitForSelector('button.MuiButton-disableElevation:nth-child(2)', { visible: true, timeout: 10000 });
    await page.click('button.MuiButton-disableElevation:nth-child(2)');
    console.log('[customsInfo] -> Нажата кнопка "Продолжить".');
  } catch (error) {
    throw new Error(`[customsInfo] -> Ошибка при нажатии кнопки "Продолжить": ${error.message}`);
  }

  // 8) Ждем, пока исчезнет спиннер загрузки.
  try {
    await page.waitForSelector('div.ConnectedLoading__SpinnerWrapper-sc-1245kmi-0.dFApI', { hidden: true, timeout: 15000 });
    console.log('[customsInfo] -> Спиннер исчез, данные загружены.');
  } catch (error) {
    console.log('[customsInfo] -> Спиннер не исчез вовремя или ошибка ожидания:', error.message);
  }

  // 9) Проверяем данные через API.
  try {
    const customsResponse = await page.waitForResponse(response =>
      response.url().includes('https://checkout12.iherb.com/api/customs/v1/EMEXDelivery?countryCode=KZ') &&
      response.status() === 200,
      { timeout: 15000 }
    );
    const customsData = await customsResponse.json();
    console.log('[customsInfo] -> Получен ответ по API:', customsData);
  } catch (error) {
    console.log('[customsInfo] -> Ошибка получения ответа от API:', error.message);
  }

  console.log('[customsInfo] -> Заполнение таможенной информации завершено.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { fillCustomsInfo };
