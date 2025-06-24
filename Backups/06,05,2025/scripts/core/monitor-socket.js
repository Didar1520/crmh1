const { Server } = require('socket.io');
const bus = require('./eventBus');

function init(port = 8081) {
  const io = new Server(port, { cors: { origin: '*' } });
  console.log(`[monitor-socket] WebSocket on ${port}`);

  /* пересылаем события из бота в UI */
  bus.on('step',  d => io.emit('step',  d));
  bus.on('log',   d => io.emit('log',   d));
  bus.on('error', d => io.emit('error', d));

  /* получаем команды из UI */
  io.on('connection', sock => {
    sock.on('pause',  () => bus.emit('ctrl', 'pause'));
    sock.on('resume', () => bus.emit('ctrl', 'resume'));
    sock.on('stop',   () => bus.emit('ctrl', 'stop'));
  });
}

module.exports = { init };
