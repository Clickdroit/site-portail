/**
 * health.test.js — Basic tests for backend utilities and API responses.
 */

// Mock dotenv
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_USER = 'testadmin';
process.env.ADMIN_PASS = 'testpass';

describe('Backend Utilities', () => {
  test('checkUrl handles invalid URLs gracefully', async () => {
    const { checkUrl } = require('../worker');
    const result = await checkUrl('http://localhost:99999/definitely-not-running');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('latencyMs');
    expect(['UP', 'DEGRADED', 'DOWN']).toContain(result.status);
    expect(typeof result.latencyMs).toBe('number');
  });

  test('checkUrl returns DOWN for unreachable host', async () => {
    const { checkUrl } = require('../worker');
    const result = await checkUrl('http://192.0.2.1:9999/unreachable');
    expect(result.status).toBe('DOWN');
  }, 15000);
});

describe('JWT Auth', () => {
  const jwt = require('jsonwebtoken');

  test('can create and verify a JWT token', () => {
    const payload = { id: 1, username: 'admin', role: 'admin' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('admin');
  });

  test('fails with wrong secret', () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});

describe('Password Hashing', () => {
  const bcrypt = require('bcryptjs');

  test('hashed password matches original', () => {
    const hash = bcrypt.hashSync('testpass', 10);
    expect(bcrypt.compareSync('testpass', hash)).toBe(true);
    expect(bcrypt.compareSync('wrongpass', hash)).toBe(false);
  });
});
