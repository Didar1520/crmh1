// scripts/sync/rewards.js

const { logActions, waitForStateChange } = require('../utils');

async function syncRewards(page, ws, syncData) {
  let stateOfRewards = null;
  let stateOfExtendedRewards = null; // данные из availableRewardsSummary

  if (syncData.rewards) {
    await logActions('Получаем состояние наград...', ws, 'in-progress');

    page.on('response', async response => {
      const url = response.url();

      // Старые данные /user/rewards (можно оставить если нужно)
      if (url.includes('/user/rewards')) {
        try {
          const contentResponse = await response.text();
          const jsonContentResponse = JSON.parse(contentResponse);
          stateOfRewards = {
            availableRewards: jsonContentResponse.availableRewards,
            pendingRewards: jsonContentResponse.pendingRewards
          };
        } catch (err) {
          console.log('Ошибка чтения ответа rewards:', err);
        }
      }

      // Новый эндпоинт с расширенной информацией о вознаграждениях
      if (url.includes('available-rewards-summary/hyperwallet-user-status')) {
        try {
          const contentResponse = await response.text();
          const jsonContentResponse = JSON.parse(contentResponse);

          // Здесь получаем данные из availableRewardsSummary
          stateOfExtendedRewards = jsonContentResponse.availableRewardsSummary;
          console.log('availableRewardsSummary данные:', stateOfExtendedRewards);
        } catch (err) {
          console.log('Ошибка чтения ответа availableRewardsSummary:', err);
        }
      }
    });

    // Переходим на страницу вознаграждений
    await page.goto('https://secure.iherb.com/rewards/overview', {waitUntil:'networkidle2'});

    // Ожидаем появления stateOfRewards или stateOfExtendedRewards (хотя бы одного)
    await waitForStateChange(() => stateOfRewards !== null || stateOfExtendedRewards !== null);

    await logActions('Получено состояние наград', ws, 'in-progress');
  }

  return syncData.rewards ? { ...stateOfRewards, extended: stateOfExtendedRewards } : null;
}

module.exports = { syncRewards };
