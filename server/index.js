/**
 * index.js — Main server entry point.
 * Express + Socket.io + health-check worker.
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const { initDB } = require('./db');
const { startWorker } = require('./worker');
const { registerTerminalHandlers } = require('./routes/terminal');

const projectRoutes = require('./routes/projects');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');

const PORT = parseInt(process.env.PORT, 10) || 3000;

// ── Initialize ──────────────────────────────────────────

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ── Middleware ───────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── API Routes ──────────────────────────────────────────

function mountApiRoutes(prefix) {
  app.use(`${prefix}/projects`, projectRoutes);
  app.use(`${prefix}/health`, healthRoutes);
  app.use(`${prefix}/auth`, authRoutes);
}

// Backward compatibility with older portal frontend URLs
mountApiRoutes('/portal/api');

// ── Serve static frontend ───────────────────────────────

const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath, {
  index: 'index.html',
  extensions: ['html']
}));

// Fallback: serve index.html for SPA-like navigation
app.get('*', (req, res, next) => {
  // Don't intercept API routes
  if (req.path.startsWith('/portal/api/')) return next();

  const filePath = path.join(frontendPath, req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
});

// ── Boot ────────────────────────────────────────────────

(async () => {
  await initDB();
  startWorker(io);
  registerTerminalHandlers(io);

  server.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║   Clickdroit Portal — Server v2.0.0      ║');
    console.log(`  ║   http://localhost:${PORT}               ║`);
    console.log('  ║   API: /portal/api/health                ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
  });
})();
