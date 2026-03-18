/**
 * api-prefixes.test.js — Ensure both API prefixes remain available.
 */

const path = require('path');
const { spawn } = require('child_process');

const TEST_PORT = 3800 + Math.floor(Math.random() * 200);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const SERVER_START_TIMEOUT_MS = 20000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/health`);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await sleep(200);
  }

  throw new Error('Server did not start in time for API prefix tests.');
}

describe('API route prefixes', () => {
  let serverProcess;

  beforeAll(async () => {
    serverProcess = spawn(process.execPath, ['index.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        NODE_ENV: 'test',
        JWT_SECRET: process.env.JWT_SECRET || 'test-secret'
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

  test('serves health endpoint on /api/v1', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toHaveProperty('status', 'ok');
    expect(Array.isArray(payload.services)).toBe(true);
  });

  test('serves legacy health endpoint on /portal/api', async () => {
    const res = await fetch(`${BASE_URL}/portal/api/health`);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toHaveProperty('status', 'ok');
    expect(Array.isArray(payload.services)).toBe(true);
  });
});
