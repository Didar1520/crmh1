// 📁 UI/src/components/Accounts/helpers.js
export const get = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);

export const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
};

export const mailDomain = (email) => (email.includes('@') ? email.split('@')[1] : '');
