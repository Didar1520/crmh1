// utils.js
async function waitForFullPageLoad(page) {
    console.log('[preOrderPage] -> Ждем полной загрузки страницы...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  
  module.exports = { waitForFullPageLoad };
  