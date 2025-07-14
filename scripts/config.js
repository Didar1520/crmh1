// scripts/config.js

module.exports = {



    promoCode: 'Gold120',
    referralCode: 'KEA1847',
    cartUrl: '',
    client: '',
    currency: 'USD',
  
    cards: [
      '5191702005971261',
      '4628188880881898'
    ],
    
    accountManager: false,
    addressManager: false,
    

    actionsEnabled: {
      cartModule: true,
      setAddress: false
    },

    reviewManager: false,
    
    mainInfo: false,
    orders: false,
    reviews: false,
    rewards: false,
    syncData: false,

    defaultAdress: 24,             // Пример: какой адрес брать из dataManager
    changeAddressFrequency: 3,   // Менять адрес каждые X заказов
    changeAddressFrequencyByDay: 2,
    changeAccountFrequency: 10,    // Менять аккаунт каждые X заказов
    limitTimePeriodStart: '01.05.2025-11:00 ',
    limitTimePeriodEnd: '23.05.2025-23:00'
  };
  



