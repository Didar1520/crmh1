const state = {
  reset() {
    this.totalOrders      = 0;
    this.completedCnt     = 0;
    this.bookedCnt        = 0;
    this.errorCnt         = 0;
    this.usdCompletedSum  = 0;
    this.usdBookedSum     = 0;
    this.failedOrders     = [];
    this.processedOrders  = [];
    this.clientOrders     = {};
    this.clientLines      = [];  // строки «корзина N…»
    this.stepLines        = [];  // строки для админ‑отчёта
  },
  // значения будут перезаписаны в reset()
};

state.reset();
module.exports = state;