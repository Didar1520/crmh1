// scripts/sync/rewards.js

const { logActions, waitForStateChange } = require('../utils');
const { getAccData, saveAccData } = require('../dataManager');
const { checkAndSolveCaptchaInPlace } = require('../captcha');

async function syncRewards(page, ws, syncData) {
  let stateOfRewards = null;
  let stateOfExtendedRewards = null;
  let currentUserEmail = null;

  // Слушаем ответы, чтобы отследить currentUser и данные о вознаграждениях
  page.on('response', async (response) => {
    const url = response.url();

    // 1) Определяем email текущего пользователя
    if (url.includes('catalog.app.iherb.com/catalog/currentUser')) {
      try {
        const content = await response.text();
        const json = JSON.parse(content);
        currentUserEmail = json.email || null;
        console.log(`[syncRewards] currentUserEmail: ${currentUserEmail}`);
      } catch (err) {
        console.log('[syncRewards] Ошибка чтения currentUser:', err);
      }
    }

    // 2) Старый эндпоинт /user/rewards
    if (url.includes('/user/rewards')) {
      try {
        const contentResponse = await response.text();
        const jsonContentResponse = JSON.parse(contentResponse);
        stateOfRewards = {
          availableRewards: jsonContentResponse.availableRewards,
          pendingRewards: jsonContentResponse.pendingRewards
        };
        console.log('[syncRewards] stateOfRewards:', stateOfRewards);
      } catch (err) {
        console.log('[syncRewards] Ошибка чтения ответа rewards:', err);
      }
    }

    // 3) Новый эндпоинт: available-rewards-summary/hyperwallet-user-status
    if (url.includes('available-rewards-summary/hyperwallet-user-status')) {
      try {
        const contentResponse = await response.text();
        const jsonContentResponse = JSON.parse(contentResponse);
        stateOfExtendedRewards = jsonContentResponse.availableRewardsSummary;
        console.log('[syncRewards] availableRewardsSummary:', stateOfExtendedRewards);
      } catch (err) {
        console.log('[syncRewards] Ошибка чтения ответа availableRewardsSummary:', err);
      }
    }
  });

  // Заходим на страницу вознаграждений
  await page.goto('https://secure.iherb.com/rewards/overview', { waitUntil: 'networkidle2' });

  // Если капча возможна, точечно проверим
  await checkAndSolveCaptchaInPlace(page, ws, 10000);

  // Ждём, пока появятся данные о вознаграждениях
  await waitForStateChange(() => stateOfRewards !== null || stateOfExtendedRewards !== null);
  await logActions('Получено состояние вознаграждений', ws, 'in-progress');

  // Теперь пишем в JSON
  if (!currentUserEmail) {
    console.log('[syncRewards] Не удалось определить currentUserEmail => пропускаем запись в JSON');
  } else {
    try {
      // 1) Читаем accData.json
      const accData = await getAccData();
      if (!accData || !accData.accounts) {
        console.log('[syncRewards] accData.json пустой или невалидный');
        return { ...stateOfRewards, extended: stateOfExtendedRewards };
      }

      // 2) Ищем пользователя
      let userIndex = accData.accounts.findIndex(
        (acc) => acc.email.toLowerCase() === currentUserEmail.toLowerCase()
      );

      if (userIndex === -1) {
        // Если не нашли — СОЗДАЁМ новый профиль
        console.log(`[syncRewards] Аккаунт с email="${currentUserEmail}" не найден в accData.json, создаём новый...`);
        const newAcc = {
          // Минимум полей, чтобы в будущем не было ошибок:
          email: currentUserEmail,
          pass: '',           // Можете оставить пустым или задать некий плейсхолдер
          refCode: '',
          typeOfMail: '',
          typeOfAcc: 'autoCreated', // либо как-то иначе
          allow: true,
          // Обязательные поля для структуры:
          cards: { creditCards: [] },
          reviews: {},
          rewards: {}
        };
        accData.accounts.push(newAcc);
        userIndex = accData.accounts.length - 1;
      }

      // 3) Теперь userIndex точно есть
      const user = accData.accounts[userIndex];

      // Обновляем поля в user.rewards
      if (!user.rewards) {
        user.rewards = {};
      }

      if (stateOfRewards) {
        user.rewards.availableRewards = stateOfRewards.availableRewards;
        user.rewards.pendingRewards = stateOfRewards.pendingRewards;
      }
      if (stateOfExtendedRewards) {
        user.rewards.availableRewardsSummary = stateOfExtendedRewards;
      }

      // 4) Сохраняем
      await saveAccData(accData);
      console.log(`[syncRewards] Данные вознаграждений для "${currentUserEmail}" сохранены/обновлены в accData.json`);
    } catch (err) {
      console.log('[syncRewards] Ошибка при сохранении rewards в JSON:', err);
    }
  }

  // Возвращаем итог
  return { ...stateOfRewards, extended: stateOfExtendedRewards };
}

module.exports = { syncRewards };
