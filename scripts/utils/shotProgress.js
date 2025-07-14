const fs = require('fs');

const path = require('path');

// Base directory for data. Can be overridden with the CRM_ROOT env var
const CRM_ROOT = process.env.CRM_ROOT || path.join(__dirname, '..', '..');
const PROG = path.join(CRM_ROOT, 'data', 'OrdersData', 'shot_progress.json');


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
