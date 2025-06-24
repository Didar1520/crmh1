// customsInfo.js
async function fillCustomsInfo(page, addressData) {
    console.log('[preOrderPage] -> Заполнение таможенной информации...');
    // Нажимаем на кнопку "изменить" таможенной информации
    await page.waitForSelector('#customs-panel-toggle-button > #collapse-label', { visible: true });
    await page.click('#customs-panel-toggle-button > #collapse-label');
  
    // Ждем появления инпутов
    await page.waitForSelector('input[name="identificationNumber"]', { visible: true });
  
    // Заполняем поля (имитация ввода с использованием Puppeteer)
    await page.click('input[name="identificationNumber"]', { clickCount: 3 });
    await page.type('input[name="identificationNumber"]', String(addressData.Pasport), { delay: 100 });
  
    await page.click('input[id="firstName"]', { clickCount: 3 });
    await page.type('input[id="firstName"]', addressData.Name, { delay: 100 });
  
    await page.click('input[name="midName"]', { clickCount: 3 });
    await page.type('input[name="midName"]', addressData.MiddleName, { delay: 100 });
  
    await page.click('input[name="lastName"]', { clickCount: 3 });
    await page.type('input[name="lastName"]', addressData.Surname, { delay: 100 });
  
    await page.click('input#mobileNumber', { clickCount: 3 });
    await page.type('input#mobileNumber', String(addressData.Number), { delay: 100 });
  
    // После заполнения нажимаем на кнопку "Продолжить"
    await page.waitForSelector('button.MuiButton-disableElevation:nth-child(2)', { visible: true });
    await page.click('button.MuiButton-disableElevation:nth-child(2)');
  
    console.log('[preOrderPage] -> Таможенная информация заполнена и подтверждена.');
  }
  
  module.exports = { fillCustomsInfo };
  