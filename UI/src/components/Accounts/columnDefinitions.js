// 📁 UI/src/components/Accounts/columnDefinitions.js
import { mailDomain } from './helpers';

// Список колонок (ключи данных или вычисляемые поля)
export const COLS = [
  'email',
  'pass',
  'refCode',
  'cards.creditCards',
  'mailDomain',
  'reviews.productsWithoutReviews',
  'reviews.productsWithReviews',
  'reviews.totalProducts',
  'rewards.availableRewardsSummary.totalAvailableAmount',
  'rewards.availableRewardsSummary.pendingAmount',
  'rewards.availableRewardsSummary.availableRewardsDateExpired',
  'rewards.availableRewardsSummary.allTimeEarnedAmount',
  'lastSyncReviewsDate',
  'lastSyncRewardsDate',
];

// Человекочитаемые заголовки
export const HEAD = {
  email: 'Аккаунт',
  pass: 'Пароль',
  refCode: 'Рефкод',
  'cards.creditCards': 'Карты',
  mailDomain: 'Домен почты',
  'reviews.productsWithoutReviews': 'Без отзывов',
  'reviews.productsWithReviews': 'Отзывы написаны',
  'reviews.totalProducts': 'Всего товаров',
  'rewards.availableRewardsSummary.totalAvailableAmount': 'Готовые бонусы',
  'rewards.availableRewardsSummary.pendingAmount': 'Бонусы в ожидании',
  'rewards.availableRewardsSummary.availableRewardsDateExpired': 'Срок бонусов',
  'rewards.availableRewardsSummary.allTimeEarnedAmount': 'Заработано бонусов',
  'lastSyncReviewsDate': 'Дата послед синх. отзывов',
  'lastSyncRewardsDate': 'Дата послед синх. бонусов',
};

// Возврат функции, обеспечивающей вывод значения в ячейке, если нужно что‑то вычислить
export const columnValue = (acc, key, helpers) => {
  const { get, formatDate } = helpers;
  switch (key) {
    case 'mailDomain':
      return mailDomain(acc.email);
    case 'cards.creditCards':
      return (acc.cards?.creditCards || []).join(', ');
    case 'rewards.availableRewardsSummary.availableRewardsDateExpired':
      return formatDate(get(acc, key));
    default:
      return get(acc, key);
       case 'lastSyncReviewsDate':
    case 'lastSyncRewardsDate':
      return formatDate(get(acc, key));
  }
};
