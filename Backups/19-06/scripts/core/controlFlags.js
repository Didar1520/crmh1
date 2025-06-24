let paused = false;
let abort  = false;

async function waitIfPaused() {
  while (paused) await new Promise(r => setTimeout(r, 200));
}

module.exports = {
  waitIfPaused,
  setPause  : () => (paused = true),
  setResume : () => (paused = false),
  setAbort  : () => (abort  = true),
  get shouldAbort() { return abort; }
};
