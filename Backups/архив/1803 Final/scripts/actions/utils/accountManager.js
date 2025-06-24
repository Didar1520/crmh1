// scripts/actions/utils/accountManager.js
/**
 * !!!! НИЧЕГО НЕ ТРОГАТЬ !!!!
 * Модуль выбора аккаунта.
 * Функция getRandomAccount возвращает случайный аккаунт из предопределенного списка.
 */

function getRandomAccount() {
  const accounts = [
    'almaty_222kz@proton.me',
    'scorpion1520kz@mail.ru'
  ];
  const randomIndex = Math.floor(Math.random() * accounts.length);
  return accounts[randomIndex];
}

module.exports = { getRandomAccount };
