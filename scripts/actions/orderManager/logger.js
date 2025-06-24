const { execSync } = require('child_process');

// ─── гарантируем корректную кодировку ─────────────────────
if (process.platform === 'win32') {
  try { execSync('chcp 65001 > nul'); } catch (_) {/* игнор */}
}

const RESET = '[0m';
const COLORS = { green: '[32m', blue: '[34m', red: '[31m', yellow: '[33m' };

function supportsColor() {
  if (process.env.NO_COLOR) return false;
  if (process.platform === 'win32') return false; // отключаем ANSI — кракозябры пропадут (теперь кодировка UTF‑8)
  return process.stdout.isTTY;
}

function out(color, msg) {
  if (supportsColor() && COLORS[color]) {
    console.log(COLORS[color] + msg + RESET);
  } else {
    console.log(msg);
  }
}

module.exports = {
  info:  msg => out('blue',   msg),
  ok:    msg => out('green',  msg),
  warn:  msg => out('yellow', msg),
  error: msg => out('red',    msg),
};