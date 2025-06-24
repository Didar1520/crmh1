// customsInfo.js
// -----------------------------------------------------------------------------
//  Изменения (⏩ ускоряем работу):
//  1) Введена константа TYPE_DELAY_MS — регулирует скорость печати (по умолч. 50 мс).
//  2) Быстрый ран-чек для всех инпутов: если элемент уже в DOM, не ждём 10 000 мс.
//  3) Тайм-ауты ожидания сокращены (10 000 → 6 000 мс).
//  4) Логи «инпут найден» убраны — чтобы не засорять вывод без нужды.

const fs = require('fs');
const path = require('path');

// -------------------- настройка скорости печати --------------------
const TYPE_DELAY_MS = 25;   // ← менять здесь (мс между символами)

// -------------------- загрузка адресной книги ----------------------
const addressListPath = path.resolve(
  __dirname,
  '../../../data/adressBook/adressList.JSON'
);
let addressList;
try {
  addressList = JSON.parse(fs.readFileSync(addressListPath, 'utf8'));
  console.log('[customsInfo] -> Адресная книга успешно загружена.');
} catch (error) {
  throw new Error(
    `[customsInfo] -> Ошибка загрузки адресной книги: ${error.message}`
  );
}

// --------------------- вспомогательные функции ---------------------
function areNamesEquivalent(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const arrA = nameA.trim().split(/\s+/).map(s => s.toLowerCase()).sort();
  const arrB = nameB.trim().split(/\s+/).map(s => s.toLowerCase()).sort();
  return arrA.join(' ') === arrB.join(' ');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------- основная логика ----------------------------
async function fillCustomsInfo(page) {
  console.log('[customsInfo] -> Старт.');

  /* 0) Уже совпадает? */
  try {
    const [customsName, deliveryName] = await Promise.all([
      page.$eval(
        'div.CustomsPanelInfo__Container-sc-16g5b4g-0.hDGCAU div[data-testid="customs-name"]',
        el => el.textContent.trim()
      ),
      page.$eval(
        'div.DeliveryAddress__CustomerInfo-sc-vtw4ic-4.kYzWze div.DeliveryAddress__FirstName-sc-vtw4ic-3.ktFtbM',
        el => el.textContent.trim()
      ),
    ]);

    if (areNamesEquivalent(customsName, deliveryName)) {
      console.log('[customsInfo] -> Уже заполнено, выходим.');
      return;
    }
  } catch (_) {
    /* если не нашли элементы — продолжим заполнение */
  }

  /* 1) Открываем панель таможни */
  try {
    await page.waitForSelector('#customs-panel-toggle-button > #collapse-label', {
      visible: true,
      timeout: 6000,
    });
    await page.click('#customs-panel-toggle-button > #collapse-label');
  } catch (err) {
    throw new Error(`[customsInfo] -> Не удалось открыть панель: ${err.message}`);
  }

  /* 2) Ждём инпуты (быстрый ран-чек) */
  const selectors = {
    identificationNumber: 'input[name="identificationNumber"]',
    firstName: 'input[id="firstName"]',
    midName: 'input[name="midName"]',
    lastName: 'input[name="lastName"]',
    mobileNumber: 'input#mobileNumber',
  };
  
for (const key in selectors) {
  const sel = selectors[key];
  await page.waitForSelector(sel, { visible: true, timeout: 10000 });
}


  /* 3) Имя доставки → ищем запись */
  let displayedName;
  try {
    displayedName = await page.$eval(
      'div.DeliveryAddress__CustomerInfo-sc-vtw4ic-4.kYzWze div.DeliveryAddress__FirstName-sc-vtw4ic-3.ktFtbM',
      el => el.textContent.trim()
    );
  } catch (err) {
    throw new Error(`[customsInfo] -> Не удалось получить имя доставки: ${err.message}`);
  }

  const userRecord = addressList.find(r =>
    r.FullName.trim().toLowerCase().includes(displayedName.toLowerCase())
  );
  if (!userRecord) {
    throw new Error(`[customsInfo] -> "${displayedName}" отсутствует в адресной книге.`);
  }

  /* 4) Заполняем инпуты */
  async function fillInput(selector, value) {
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(selector, String(value), { delay: TYPE_DELAY_MS });
  }

  await fillInput(selectors.identificationNumber, userRecord.Pasport);
  await fillInput(selectors.firstName, userRecord.Name);
  await fillInput(selectors.midName, userRecord.MiddleName);
  await fillInput(selectors.lastName, userRecord.Surname);

  let phone = String(userRecord.Number);
  if (!phone.startsWith('+')) phone = `+${phone}`;
  await fillInput(selectors.mobileNumber, phone);

  /* 5) Кнопка «Продолжить» */
  try {
    await page.waitForSelector(
      'button.MuiButton-disableElevation:nth-child(2)',
      { visible: true, timeout: 6000 }
    );
    await page.click('button.MuiButton-disableElevation:nth-child(2)');
  } catch (err) {
    throw new Error(`[customsInfo] -> Не нажалась «Продолжить»: ${err.message}`);
  }

  /* 6) Спиннер */
  const spin = 'div.ConnectedLoading__SpinnerWrapper-sc-1245kmi-0.dFApI';
  try {
    await page.waitForSelector(spin, { hidden: true, timeout: 10000 });
  } catch (_) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector(spin, { hidden: true, timeout: 10000 }).catch(() => {});
  }

  /* 7) API-ответ (не критично, без throw) */
  try {
    const resp = await page.waitForResponse(
      r =>
        r.url().includes(
          'https://checkout12.iherb.com/api/customs/v1/EMEXDelivery?countryCode=KZ'
        ) && r.status() === 200,
      { timeout: 3000 }
    );
    console.log('[customsInfo] -> API ok:', await resp.json());
  } catch (_) {
    console.log('[customsInfo] -> API ответа не дождались (не критично).');
  }

  console.log('[customsInfo] -> Готово.');
}

module.exports = { fillCustomsInfo };



 