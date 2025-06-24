const { setTimeout: sleep } = require('timers/promises');

function isEmpty(val) {
  if (!val) return true;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    return lower === '' || lower === 'none';
  }
  return false;
}

function fmtDate() {
  return new Date().toLocaleString('ru-RU', { hour12: false });
}

module.exports = { sleep, isEmpty, fmtDate };