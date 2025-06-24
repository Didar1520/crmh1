/**
 * setAdressPage.js
 * ------------------------------------------------
 * Назначение:
 *  - Установка адреса по умолчанию / добавление адреса, если не найден.
 *  - Перед поиском адреса ждём, чтобы страница полноценно загрузилась (без спиннеров).
 *  - Если появляется капча – решаем, ждём ещё раз загрузку.
 */

const addNewAddress = require('./addNewAdress.js');
const config = require('../../config.js');
const { checkAndSolveCaptchaInPlace } = require('../../captcha.js');



/**
 * Преобразуем ФИО пример: "Ибраева Шинарай Абдрахмановна" -> "ибраева шинарай"
 */
function processName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 2) {
    return parts.slice(0, 2).join(' ').toLowerCase();
  }
  return fullName.trim().toLowerCase();
}

/** 
 * Пример функции ожидания исчезновения «спиннера» на странице адресной книги.
 * Замените селектор spinnerSelector на реальный.
 */
async function waitForSpinnerOnAddressBook(page, maxWait = 5000) {
  const spinnerSelector = 'svg[data-qa-element="loading-spinner"]'; // пример!
  const start = Date.now();
  let spinnerAppeared = false;

  // 1) Ждём появления спиннера (до 1 сек)
  try {
    await page.waitForSelector(spinnerSelector, { timeout: 1000 });
    spinnerAppeared = true;
    console.log('[setAdressPage] -> Спиннер появился, ждём исчезновения...');
  } catch {
    // не появился
  }

  if (spinnerAppeared) {
    // 2) Ждём скрытия
    try {
      await page.waitForSelector(spinnerSelector, { hidden: true, timeout: maxWait - (Date.now() - start) });
      console.log('[setAdressPage] -> Спиннер исчез.');
    } catch {
      console.log('[setAdressPage] -> Спиннер не исчез за 5 сек.');
      return false;
    }
  }
  return true;
}

/**
 * Точка входа: setDefaultAddress
 */
async function setDefaultAddress(page) {
  const defaultAdressFull = config.defaultAdress?.trim() || '';
  const desiredName = processName(defaultAdressFull);
  console.log(`[setAdressPage] -> Искомое имя: "${desiredName}"`);

  const addressBookUrl = 'https://checkout12.iherb.com/users/address-book';

  // Переход на страницу
  let reloadAttempts = 0;
  while (reloadAttempts < 3) {
    try {
      await page.goto(addressBookUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      console.log('[setAdressPage] -> Перешли на address-book');

      // Решаем капчу (если есть)
      try {
        await checkAndSolveCaptchaInPlace(page, null, 15000);
      } catch (err) {
        console.log('[setAdressPage] -> Ошибка checkAndSolveCaptchaInPlace:', err);
      }

      // // Ждём, чтобы спиннер исчез
      // const spinnerOk = await waitForSpinnerOnAddressBook(page, 5000);
      // if (!spinnerOk) {
      //   console.log('[setAdressPage] -> Спиннер завис, перезагружаем...');
      //   reloadAttempts++;
      //   continue; // while
      // }

      // Ждём список адресов или пустую книгу
      await page.waitForSelector('.address_item, .empty-address-book', { timeout: 15000 });
      console.log('[setAdressPage] -> Адресная книга видна, начинаем искать...');

      // let addressFound = false;
      // let currentPageNumber = 1;
      // let totalPages = Infinity;

      // while (true) {
      //   // Собираем адреса
      //   const addresses = await page.$$('.address_item');
      //   console.log(`[setAdressPage] -> Найдено адресов: ${addresses.length} (page=${currentPageNumber})`);

      //   for (const addr of addresses) {
      //     const nameElement = await addr.$('.address_no');
      //     if (!nameElement) continue;
      //     const nameText = (await page.evaluate(el => el.textContent.trim(), nameElement)).toLowerCase();
      //     console.log(`[setAdressPage] -> Имя адреса: "${nameText}"`);

      //     if (nameText === desiredName) {
      //       // Проверяем, уже ли он default
      //       const defaultDiv = await addr.$('.default');
      //       if (!defaultDiv) {
      //         // нажимаем "SetAsDefault"
      //         const setDefaultBtn = await addr.$('.set_default_btn[data-name="SetAsDefault"]');
      //         if (setDefaultBtn) {
      //           await setDefaultBtn.click();
      //           console.log(`[setAdressPage] -> Сделали адрес "${nameText}" основным.`);

      //           // Ждём появления .default
      //           await page.waitForFunction(
      //             (addrSel, nm) => {
      //               const items = document.querySelectorAll(addrSel);
      //               for (const it of items) {
      //                 const nEl = it.querySelector('.address_no');
      //                 if (nEl && nEl.textContent.trim().toLowerCase() === nm) {
      //                   return !!it.querySelector('.default');
      //                 }
      //               }
      //               return false;
      //             },
      //             { timeout: 10000 },
      //             '.address_item',
      //             nameText
      //           );
      //         }
      //       } else {
      //         console.log(`[setAdressPage] -> Адрес "${nameText}" уже основной.`);
      //       }
      //       addressFound = true;
      //       return true; // => setDefaultAddress завершён
      //     }
      //   }

        // Пагинация
        // Попробуем узнать кол-во страниц
//         if (currentPageNumber === 1) {
//           const totalEl = await page.$('.pagination-container .total-pages');
//           if (totalEl) {
//             const tText = await page.evaluate(el => el.textContent.trim(), totalEl);
//             totalPages = parseInt(tText, 10) || currentPageNumber;
//             console.log(`[setAdressPage] -> totalPages=${totalPages}`);
//           }
//         }

//         if (currentPageNumber >= totalPages) {
//           console.log(`[setAdressPage] -> Больше страниц нет, адрес "${desiredName}" не найден.`);
//           break;
//         }

//         // Идём на след. страницу
//         const nextPageBtnSel = `button[aria-label="Go to page ${currentPageNumber + 1}"]`;
//         const nextPageBtn = await page.$(nextPageBtnSel);
//         if (!nextPageBtn) {
//           console.log(`[setAdressPage] -> Кнопка для стр. ${currentPageNumber + 1} не найдена, завершаем.`);
//           break;
//         }
//         await nextPageBtn.click();
//         await page.waitForFunction(
//           (sel, exp) => {
//             const btn = document.querySelector(sel);
//             return btn && parseInt(btn.textContent.trim(), 10) === exp;
//           },
//           { timeout: 10000 },
//           'button.Mui-selected',
//           currentPageNumber + 1
//         );
//         currentPageNumber++;
//       }

//       if (!addressFound) {
//         console.log(`[setAdressPage] -> Адрес "${desiredName}" не найден.`);
//       }
//       return addressFound; // false
    } catch (err) {
      console.log('[setAdressPage] -> Ошибка при setDefaultAddress:', err);
      reloadAttempts++;
      if (reloadAttempts >= 3) {
        console.log('[setAdressPage] -> Превысили лимит перезагрузок.');
        throw err;
      }
      console.log('[setAdressPage] -> Пробуем ещё раз...');
      await page.reload({ waitUntil: 'networkidle2' });
    }
  }
}

/**
 * handleAddressSetPage(page, addressData)
 * - Если setDefaultAddress(...) вернул false => добавляем новый
 */
// async function handleAddressSetPage(page, addressData) {
//   try {
//     const addressSet = await setDefaultAddress(page);
//     if (!addressSet) {
//       console.log('[setAdressPage] -> Адрес не найден => добавляем.');
//       await addNewAddress(page, addressData);
//     }
//   } catch (error) {
//     console.error(`[setAdressPage] -> handleAddressSetPage: ${error.message}`);
//     throw error;
//   }
// }
    
module.exports = handleAddressSetPage;
