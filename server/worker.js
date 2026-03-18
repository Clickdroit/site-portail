/**
 * worker.js — Background health-check worker.
 * Pings each project URL at a configurable interval and records results.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { getAllProjects, updateProjectStatus } = require('./db');

const DEFAULT_TIMEOUT_MS = 10000;
let io = null;
let intervalHandle = null;

/** Start the health-check worker. */
function startWorker(socketIo) {
  io = socketIo;
  const intervalMs = parseInt(process.env.PING_INTERVAL_MS, 10) || 60000;

  console.log(`[worker] Starting health checks every ${intervalMs / 1000}s`);

  // Initial check immediately
  runChecks();

  // Then periodic
  intervalHandle = setInterval(runChecks, intervalMs);
}

function stopWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/** Run health checks for all projects. */
async function runChecks() {
  const projects = getAllProjects();
  const results = [];

  for (const project of projects) {
    const result = await checkUrl(project.url);
    updateProjectStatus(project.id, result.status, result.latencyMs);
    results.push({
      id: project.id,
      name: project.name,
      url: project.url,
      status: result.status,
      latencyMs: result.latencyMs
    });
  }

  // Emit to all connected WebSocket clients
  if (io) {
    io.emit('health:update', results);
  }

  const summary = results.map(r => `${r.name}: ${r.status} (${r.latencyMs}ms)`).join(', ');
  console.log(`[worker] Check complete: ${summary}`);
}

/** Ping a URL and return status + latency. */
function checkUrl(url) {
  return new Promise((resolve) => {
    const start = Date.now();

    try {
      // Handle relative URLs (like /site-ecommerce)
      let fullUrl = url;
      if (url.startsWith('/')) {
        const port = process.env.PORT || 3000;
        fullUrl = `http://127.0.0.1:${port}${url}`;
      }

      const parsed = new URL(fullUrl);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'HEAD',
          timeout: DEFAULT_TIMEOUT_MS,
          // Don't follow redirects for speed
          headers: {
            'User-Agent': 'ClickdroitPortal-HealthChecker/2.0'
          }
        },
        (res) => {
          const latencyMs = Date.now() - start;
          res.resume(); // Consume response

          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve({ status: 'UP', latencyMs });
          } else if (res.statusCode >= 500) {
            resolve({ status: 'DOWN', latencyMs });
          } else {
            resolve({ status: 'DEGRADED', latencyMs });
          }
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'DOWN', latencyMs: DEFAULT_TIMEOUT_MS });
      });

      req.on('error', () => {
        const latencyMs = Date.now() - start;
        resolve({ status: 'DOWN', latencyMs });
      });

      req.end();
    } catch {
      resolve({ status: 'DOWN', latencyMs: Date.now() - start });
    }
  });
}

module.exports = { startWorker, stopWorker, checkUrl };
