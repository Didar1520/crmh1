const { spawn } = require('child_process');
const path = require('path');

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

describe('server.js', () => {
  let serverProcess;

  beforeAll(done => {
    serverProcess = spawn('node', [path.join(__dirname, '..', 'server.js')], {
      env: { ...process.env, PORT: 3001 },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const onData = data => {
      if (data.toString().includes('Сервер запущен')) {
        serverProcess.stdout.off('data', onData);
        done();
      }
    };

    serverProcess.stdout.on('data', onData);
    serverProcess.on('error', err => done(err));
  }, 10000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  test('GET /inputConfig responds with array', async () => {
    const res = await fetch('http://localhost:3001/inputConfig');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
