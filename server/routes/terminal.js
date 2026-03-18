/**
 * routes/terminal.js — WebSocket terminal command handlers.
 * Handles commands received via Socket.io from the frontend terminal.
 */

const { exec } = require('child_process');
const { getAllProjects, getProjectById } = require('../db');
const { checkUrl } = require('../worker');

/**
 * Register Socket.io event handlers for the terminal.
 * @param {import('socket.io').Server} io
 */
function registerTerminalHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.handshake.auth || { role: 'guest', username: 'anonymous' };
    console.log(`[ws] Terminal connected: ${user.username} (${user.role})`);

    socket.on('terminal:command', async (data) => {
      const { command, args = [] } = data;
      const role = user.role || 'guest';

      try {
        switch (command) {
          case 'status':
            await handleStatus(socket);
            break;
          case 'ping':
            await handlePing(socket, args);
            break;
          case 'restart':
            await handleRestart(socket, args, role);
            break;
          case 'deploy':
            await handleDeploy(socket, args, role);
            break;
          case 'logs':
            await handleLogs(socket, args, role);
            break;
          default:
            socket.emit('terminal:output', {
              type: 'error',
              text: `Unknown server command: ${command}. Server commands: status, ping, restart, deploy, logs.`
            });
        }
      } catch (err) {
        socket.emit('terminal:output', {
          type: 'error',
          text: `Error executing command: ${err.message}`
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[ws] Terminal disconnected: ${user.username}`);
    });
  });
}

// ── Command handlers ──────────────────────────────────────

async function handleStatus(socket) {
  const projects = getAllProjects();
  socket.emit('terminal:output', {
    type: 'info',
    text: `── Service Status (${projects.length} projects) ──`
  });

  for (const p of projects) {
    const icon = p.status === 'UP' ? '●' : p.status === 'DEGRADED' ? '◐' : '○';
    socket.emit('terminal:output', {
      type: p.status === 'UP' ? 'success' : p.status === 'DEGRADED' ? 'warn' : 'error',
      text: `  ${icon} [${String(p.id).padStart(2, '0')}] ${p.name} — ${p.status} (${p.url})`
    });
  }
}

async function handlePing(socket, args) {
  const id = parseInt(args[0], 10);
  if (!id) {
    socket.emit('terminal:output', { type: 'error', text: 'Usage: ping <project_id>' });
    return;
  }

  const project = getProjectById(id);
  if (!project) {
    socket.emit('terminal:output', { type: 'error', text: `Project #${id} not found.` });
    return;
  }

  socket.emit('terminal:output', { type: 'info', text: `Pinging ${project.name} (${project.url})...` });

  const result = await checkUrl(project.url);
  socket.emit('terminal:output', {
    type: result.status === 'UP' ? 'success' : 'error',
    text: `${project.name}: ${result.status} — ${result.latencyMs}ms`
  });
}

async function handleRestart(socket, args, role) {
  if (role !== 'admin' && role !== 'devops') {
    socket.emit('terminal:output', {
      type: 'error',
      text: '✗ Permission denied. Required role: admin or devops.'
    });
    return;
  }

  const id = parseInt(args[0], 10);
  if (!id) {
    socket.emit('terminal:output', { type: 'error', text: 'Usage: restart <project_id>' });
    return;
  }

  const project = getProjectById(id);
  if (!project) {
    socket.emit('terminal:output', { type: 'error', text: `Project #${id} not found.` });
    return;
  }

  // Attempt Docker restart if DOCKER_SOCKET is configured
  const dockerSocket = process.env.DOCKER_SOCKET;
  if (!dockerSocket) {
    socket.emit('terminal:output', {
      type: 'warn',
      text: `⚠ Docker socket not configured. Simulating restart for "${project.name}"...`
    });
    await delay(1500);
    socket.emit('terminal:output', {
      type: 'success',
      text: `✓ "${project.name}" restart simulated. Configure DOCKER_SOCKET in .env for real restarts.`
    });
    return;
  }

  socket.emit('terminal:output', { type: 'info', text: `Restarting container for "${project.name}"...` });

  const containerName = project.name.toLowerCase().replace(/\s+/g, '-');
  exec(`docker restart ${containerName}`, { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      socket.emit('terminal:output', { type: 'error', text: `✗ Restart failed: ${err.message}` });
      return;
    }
    socket.emit('terminal:output', {
      type: 'success',
      text: `✓ Container "${containerName}" restarted successfully.`
    });
    if (stdout.trim()) {
      socket.emit('terminal:output', { type: 'info', text: stdout.trim() });
    }
  });
}

async function handleDeploy(socket, args, role) {
  if (role !== 'admin' && role !== 'devops') {
    socket.emit('terminal:output', {
      type: 'error',
      text: '✗ Permission denied. Required role: admin or devops.'
    });
    return;
  }

  const id = parseInt(args[0], 10);
  if (!id) {
    socket.emit('terminal:output', { type: 'error', text: 'Usage: deploy <project_id>' });
    return;
  }

  const project = getProjectById(id);
  if (!project) {
    socket.emit('terminal:output', { type: 'error', text: `Project #${id} not found.` });
    return;
  }

  const webhookUrl = process.env.DEPLOY_WEBHOOK_URL;
  if (!webhookUrl) {
    socket.emit('terminal:output', {
      type: 'warn',
      text: `⚠ Deploy webhook not configured. Simulating deployment for "${project.name}"...`
    });
    await delay(2000);
    socket.emit('terminal:output', { type: 'info', text: '  → Pulling latest changes...' });
    await delay(1000);
    socket.emit('terminal:output', { type: 'info', text: '  → Building image...' });
    await delay(1500);
    socket.emit('terminal:output', { type: 'info', text: '  → Restarting services...' });
    await delay(1000);
    socket.emit('terminal:output', {
      type: 'success',
      text: `✓ "${project.name}" deployment simulated. Configure DEPLOY_WEBHOOK_URL in .env for real deploys.`
    });
    return;
  }

  socket.emit('terminal:output', { type: 'info', text: `Triggering deploy for "${project.name}"...` });

  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project.name, projectId: project.id })
    });

    if (res.ok) {
      socket.emit('terminal:output', {
        type: 'success',
        text: `✓ Deploy triggered for "${project.name}" (HTTP ${res.status}).`
      });
    } else {
      socket.emit('terminal:output', {
        type: 'error',
        text: `✗ Deploy webhook returned HTTP ${res.status}.`
      });
    }
  } catch (err) {
    socket.emit('terminal:output', {
      type: 'error',
      text: `✗ Deploy failed: ${err.message}`
    });
  }
}

async function handleLogs(socket, args, role) {
  if (role !== 'admin' && role !== 'devops') {
    socket.emit('terminal:output', {
      type: 'error',
      text: '✗ Permission denied. Required role: admin or devops.'
    });
    return;
  }

  const id = parseInt(args[0], 10);
  if (!id) {
    socket.emit('terminal:output', { type: 'error', text: 'Usage: logs <project_id>' });
    return;
  }

  const project = getProjectById(id);
  if (!project) {
    socket.emit('terminal:output', { type: 'error', text: `Project #${id} not found.` });
    return;
  }

  const dockerSocket = process.env.DOCKER_SOCKET;
  if (!dockerSocket) {
    // Simulated logs
    socket.emit('terminal:output', {
      type: 'warn',
      text: `⚠ Docker not configured. Showing simulated logs for "${project.name}":`
    });

    const mockLogs = [
      `[${new Date().toISOString()}] Server started on port 3000`,
      `[${new Date().toISOString()}] Connected to database`,
      `[${new Date().toISOString()}] Health check: OK`,
      `[${new Date().toISOString()}] GET / 200 12ms`,
      `[${new Date().toISOString()}] GET /api/health 200 3ms`,
    ];

    for (const line of mockLogs) {
      await delay(300);
      socket.emit('terminal:output', { type: 'log', text: `  ${line}` });
    }

    socket.emit('terminal:output', {
      type: 'info',
      text: `Configure DOCKER_SOCKET in .env for real container logs.`
    });
    return;
  }

  const containerName = project.name.toLowerCase().replace(/\s+/g, '-');
  socket.emit('terminal:output', {
    type: 'info',
    text: `Streaming logs for "${project.name}" (${containerName})... Ctrl+C to stop.`
  });

  const child = exec(`docker logs --tail 50 -f ${containerName}`, { timeout: 60000 });

  child.stdout?.on('data', (data) => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      socket.emit('terminal:output', { type: 'log', text: `  ${line}` });
    }
  });

  child.stderr?.on('data', (data) => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      socket.emit('terminal:output', { type: 'warn', text: `  ${line}` });
    }
  });

  child.on('error', (err) => {
    socket.emit('terminal:output', { type: 'error', text: `✗ Log stream error: ${err.message}` });
  });

  child.on('close', () => {
    socket.emit('terminal:output', { type: 'info', text: '── Log stream ended ──' });
  });

  // Stop on disconnect
  socket.on('disconnect', () => {
    child.kill();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { registerTerminalHandlers };
