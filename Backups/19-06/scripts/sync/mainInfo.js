// scripts/sync/mainInfo.js

const { logActions } = require('../utils');

async function syncMainInfo(page, ws, syncData) {
  let stateOfCards = null;
  let stateOfRefCode = null;
  let stateOfEmail = null;

  // Здесь будет логика получения карточек (cards), реф.кода (refCode), и почты (email) 
  // при условии, что syncData.cards или syncData.refCode включены.
  // Данный код будет добавлен позже, пока оставляем как заглушку.

  await logActions('Синхронизация основной информации...', ws, 'in-progress');

  // Пример заглушки:
  // stateOfCards = [{ cardholder: 'John Doe', last4digits: '1234' }];
  // stateOfRefCode = 'GVT1471';
  // stateOfEmail = 'example_user@domain.com';

  return {
    cards: syncData.cards ? stateOfCards : null,
    refCode: syncData.refCode ? stateOfRefCode : null,
    email: stateOfEmail
  };
}

module.exports = { syncMainInfo };
