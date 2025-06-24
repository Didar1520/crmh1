// config.js (пример)
module.exports = {
  browserConfig: {
    chromiumPath: 'C:\\Users\\Didar1520\\AppData\\Local\\Chromium\\Application\\chrome.exe',
    headless: false,
    userDataBaseDir: 'C:\\Users\\Didar1520\\Docks\\CRM\\userData',
    launchArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  },
  // Здесь указываем, под каким аккаунтом логиниться
  accountForLogin: {
    email: 'Didar2520@proton.me',
    pass: '' 
  },
  syncData: {
    rewards: true,
    cards: false,
    addresses: false,
    orders: false,
    refCode: true,
    orderedProducts: true,
    reviews: false
  },
  actionsEnabled: {
    syncAccount: true,
    makeOrder: false
  }
};
