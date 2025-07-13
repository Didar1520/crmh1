const fs = require('fs');
const path = require('path');

// Простейший парсер аргументов вида --key value
function parseArgs() {
  const args = process.argv.slice(2);
  const res = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    res[key] = args[i + 1];
  }
  return res;
}

const opts = parseArgs();

const clients = opts.clients ? opts.clients.split(',') : [];
const range = opts.from && opts.to ? { type: 'between', from: opts.from, to: opts.to } : null;
const tasks = opts.tasks ? opts.tasks.split(',') : ['screenshot', 'trackSave'];

const cfg = {
  captureOrders: {
    ...(clients.length ? { clients } : {}),
    ...(range ? { range } : {}),
    tasks
  }
};

const file = path.join(__dirname, '..', 'inputConfig.json');
fs.writeFileSync(file, JSON.stringify([cfg], null, 2), 'utf8');
console.log('inputConfig.json обновлён');
