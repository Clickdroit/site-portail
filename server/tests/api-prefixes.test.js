/**
 * api-prefixes.test.js — Ensure both API prefixes remain available.
 */

const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

const { main: serverMain = 'index.js' } = require('../package.json');
const SERVER_ENTRY = path.join(__dirname, '..', serverMain);
const SERVER_START_TIMEOUT_MS = 20000;
const TEST_JWT_SECRET = crypto.randomBytes(24).toString('hex');

let testPort = null;
let baseUrl = '';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/portal/api/health`);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await sleep(200);
  }

  throw new Error('Server did not start in time for API prefix tests.');
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((err) => {
        if (err) return reject(err);
        if (!port) return reject(new Error('Unable to determine available port.'));
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

describe('API route prefixes', () => {
  let serverProcess;

  beforeAll(async () => {
    testPort = await getAvailablePort();
    baseUrl = `http://127.0.0.1:${testPort}`;

    serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(testPort),
        NODE_ENV: 'test',
        JWT_SECRET: TEST_JWT_SECRET
      },
      stdio: 'ignore'
    });

    await waitForServer();
  }, 30000);

  afterAll(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
    }
  });

  test('serves health endpoint on /portal/api', async () => {
    const res = await fetch(`${baseUrl}/portal/api/health`);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toHaveProperty('status', 'ok');
    expect(Array.isArray(payload.services)).toBe(true);
  });

  test('serves legacy health endpoint on /portal/api', async () => {
    const res = await fetch(`${baseUrl}/portal/api/health`);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toHaveProperty('status', 'ok');
    expect(Array.isArray(payload.services)).toBe(true);
  });
});
