const fs        = require('fs');
const path      = require('path');
const { fmtDate } = require('./utils.js');
const logger    = require('./logger.js');

module.exports = function makeReport(state) {
  const totalUsd = state.usdCompletedSum + state.usdBookedSum;

  let report = `Отчёт ${fmtDate()}\n` +
               `Обработано шагов: ${state.totalOrders}\n` +
               `Успешных заказов: ${state.completedCnt}\n` +
               `Заказов забронировано: ${state.bookedCnt}\n` +
               `Заказов с ошибками: ${state.errorCnt}\n` +
               `Сумма заказанных корзин: ${state.usdCompletedSum.toFixed(2)} USD\n` +
               `Сумма заказов в брони: ${state.usdBookedSum.toFixed(2)} USD\n` +
               `Общая сумма: ${totalUsd.toFixed(2)} USD\n\n` +
               `\nОтчёт по шагам (для админа):\n`;

  state.stepLines.forEach(l => { report += `  ${l}\n`; });

  report += '\nСтроки для клиента (скопировать и отправить):\n';
  state.clientLines.forEach(l => { report += `  ${l}\n`; });

  if (state.failedOrders.length) {
    report += '\nОшибки и скриншоты:\n';
    state.failedOrders.forEach(f => {
      report += `  Шаг ${f.idx}: ${f.reason}\n           скрин → ${f.screenshot}\n`;
    });
  }

  const logsDir = 'D:\\Didar1520\\CRM\\logs';
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const repFile = path.join(logsDir, `report_${new Date().toISOString().replace(/[:.]/g,'-')}.txt`);
  fs.writeFileSync(repFile, report, 'utf8');
  logger.ok(`[reporter] -> Итоговый отчёт сохранён в ${repFile}`);
};