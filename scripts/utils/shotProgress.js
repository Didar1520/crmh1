const fs = require('fs');
const PROG = 'D:\\Didar1520\\CRM\\data\\OrdersData\\shot_progress.json';

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(PROG, 'utf8'));
    return new Set(data.done || []);
  } catch {
    return new Set();
  }
}

function saveProgress(orderNumber) {
  const set = load();
  set.add(orderNumber);
  fs.writeFileSync(PROG, JSON.stringify({ done: [...set] }, null, 2), 'utf8');
}

module.exports = { loadProgress: load, saveProgress };
