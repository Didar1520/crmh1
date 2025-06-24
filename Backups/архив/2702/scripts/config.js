// scripts/config.js

module.exports = {
    account: 'Madara666ikz@proton.me',


    promoCode: 'Gold120',
    referralCode: 'Dua9670',
    cartUrl: '',
    client: '',
    currency: 'USD',
  
    cards: [
      '5457 4567 5474 5647',
      '5474 5474 4571 5477'
    ],
    
    accountManager: false,
    addressManager: false,
    

    actionsEnabled: {
      cartModule: true
    },

    reviewManager: false,
    
    mainInfo: false,
    orders: false,
    reviews: false,
    rewards: false,
    syncData: false,

    defaultAdress: "Сагимбаева Гульнара Амантаевна",             // Пример: какой адрес брать из dataManager
    changeAddressFrequency: 2,   // Менять адрес каждые X заказов
    changeAddressFrequencyByDay: 20,
    changeAccountFrequency: 10,    // Менять аккаунт каждые X заказов
    limitTimePeriodStart: '16.02.2024-11:00 ',
    limitTimePeriodEnd: '20.02.2024-23:00'
  };
  