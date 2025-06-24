const fs     = require('fs');
const path   = require('path');
const logger = require('./logger.js');

module.exports = function loadInputConfig() {
  const cfgPath = path.join(__dirname, '..', '..', 'inputConfig.json');
  try {
    const raw    = fs.readFileSync(cfgPath, 'utf8');
    logger.info('[loadInputConfig] -> файл прочитан');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [];
    return parsed;
  } catch (err) {
    logger.error(`[loadInputConfig] -> Ошибка: ${err.message}`);
    return [];
  }
};