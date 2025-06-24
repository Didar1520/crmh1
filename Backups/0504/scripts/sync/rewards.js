// scripts/sync/rewards.js

const { logActions, waitForStateChange } = require('../utils');
const { getAccData, saveAccData } = require('../dataManager');
const { checkAndSolveCaptchaInPlace } = require('../captcha');

/**
 * Синхронизация вознаграждений (rewards).
 * ----------------------------------------------------------------
 * Теперь есть checkAndSolveCaptchaInPlace(page, ws, timeout),
 * чтобы ловить капчу "Press & Hold" на любой странице. 
 */
async function syncRewards(page, ws, syncData) {
  let stateOfRewards = null;
  let stateOfExtendedRewards = null;
  let currentUserEmail = null;

  // Ловим ответы
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    if (status !== 200) return;  // пропускаем всё, что не 200

    // Проверим контент-тип (на всякий случай)
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return; // пропускаем не-JSON
    }

    // 1) currentUser
    if (url.includes('catalog.app.iherb.com/catalog/currentUser')) {
      let textBody = '';
      try {
        textBody = await response.text();
      } catch (errRead) {
        console.log('[syncRewards] Ошибка чтения currentUser:', errRead);
        return;
      }
      if (!textBody) return;
      try {
        const json = JSON.parse(textBody);
        currentUserEmail = json.email || null;
        console.log(`[syncRewards] currentUserEmail: ${currentUserEmail}`);
      } catch (errParse) {
        console.log('[syncRewards] Ошибка парсинга currentUser:', errParse);
      }
    }

    // 2) Старый эндпоинт /user/rewards
    if (url.includes('/user/rewards')) {
      let textBody = '';
      try {
        textBody = await response.text();
      } catch (errRead2) {
        console.log('[syncRewards] Ошибка чтения ответа rewards:', errRead2);
        return;
      }
      if (!textBody) return;
      try {
        const jsonContentResponse = JSON.parse(textBody);
        stateOfRewards = {
          availableRewards: jsonContentResponse.availableRewards,
          pendingRewards: jsonContentResponse.pendingRewards
        };
        console.log('[syncRewards] stateOfRewards:', stateOfRewards);
      } catch (errParse2) {
        console.log('[syncRewards] Ошибка чтения ответа rewards:', errParse2);
      }
    }

    // 3) Новый эндпоинт
    if (url.includes('available-rewards-summary/hyperwallet-user-status')) {
      let textBody = '';
      try {
        textBody = await response.text();
      } catch (errRead3) {
        console.log('[syncRewards] Ошибка чтения ответа availableRewardsSummary:', errRead3);
        return;
      }
      if (!textBody) return;
      try {
        const jsonContentResponse = JSON.parse(textBody);
        stateOfExtendedRewards = jsonContentResponse.availableRewardsSummary;
        console.log('[syncRewards] availableRewardsSummary:', stateOfExtendedRewards);
      } catch (errParse3) {
        console.log('[syncRewards] Ошибка чтения ответа availableRewardsSummary:', errParse3);
      }
    }
  });

  // Заходим на страницу Rewards
  await page.goto('https://secure.iherb.com/rewards/overview', { waitUntil: 'networkidle2' });

  // Проверяем капчу:
  console.log('[syncRewards] -> checkAndSolveCaptchaInPlace (rewards) - возможно появится Press&Hold...');
  await checkAndSolveCaptchaInPlace(page, ws, 10000);

  // Ждём, пока появятся данные о вознаграждениях
  await waitForStateChange(() => stateOfRewards !== null || stateOfExtendedRewards !== null);
  await logActions('Получено состояние вознаграждений', ws, 'in-progress');

  // Запись в JSON
  if (!currentUserEmail) {
    console.log('[syncRewards] Не удалось определить currentUserEmail => пропускаем запись в JSON');
  } else {
    try {
      const accData = await getAccData();
      if (!accData || !accData.accounts) {
        console.log('[syncRewards] accData.json пустой или невалидный');
        return { ...stateOfRewards, extended: stateOfExtendedRewards };
      }

      let userIndex = accData.accounts.findIndex(
        (acc) => acc.email.toLowerCase() === currentUserEmail.toLowerCase()
      );

      if (userIndex === -1) {
        console.log(`[syncRewards] Аккаунт "${currentUserEmail}" не найден в accData.json, создаём новый...`);
        const newAcc = {
          email: currentUserEmail,
          pass: '',
          refCode: '',
          typeOfMail: '',
          typeOfAcc: 'autoCreated',
          allow: true,
          cards: { creditCards: [] },
          reviews: {},
          rewards: {}
        };
        accData.accounts.push(newAcc);
        userIndex = accData.accounts.length - 1;
      }

      const user = accData.accounts[userIndex];
      if (!user.rewards) user.rewards = {};

      if (stateOfRewards) {
        user.rewards.availableRewards = stateOfRewards.availableRewards;
        user.rewards.pendingRewards = stateOfRewards.pendingRewards;
      }
      if (stateOfExtendedRewards) {
        user.rewards.availableRewardsSummary = stateOfExtendedRewards;
      }

      await saveAccData(accData);
      console.log(`[syncRewards] Данные вознаграждений для "${currentUserEmail}" сохранены в accData.json`);
    } catch (errSave) {
      console.log('[syncRewards] Ошибка при сохранении rewards в JSON:', errSave);
    }
  }

  return { ...stateOfRewards, extended: stateOfExtendedRewards };
}

module.exports = { syncRewards };
