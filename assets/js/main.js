/**
 * main.js — Point d'entrée principal.
 * Initialise les modules, l'authentification, les métriques, la timeline et les raccourcis.
 */

import { initTheme, toggleTheme } from './modules/theme.js';
import { initTerminal } from './modules/terminal.js';
import { getProjects, initProjects, openProject, updateProjectHealth } from './modules/projects.js';
import { initCharts } from './modules/charts.js';

// ── Initialisation ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Soft auth check — no redirect, dashboard is public
  await checkAuth();

  initTheme();
  await initProjects();
  initTerminal();
  initCharts();
  initHealthMonitoring();
  initTimeline();
  initKeyboardShortcuts();
  initYear();
  initClipboard();
  initAuthUI();
  showUserInfo();

  // Listen for WebSocket health updates
  window.addEventListener('health:update', (e) => {
    if (e.detail) {
      updateProjectHealth(e.detail);
      pushStatusChangeLogs();
    }
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

async function checkAuth() {
  const token = localStorage.getItem('portal-token');
  if (!token) return false;

  try {
    const res = await fetch('/portal/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) {
      localStorage.removeItem('portal-token');
      localStorage.removeItem('portal-user');
      return false;
    }
    const user = await res.json();
    localStorage.setItem('portal-user', JSON.stringify(user));
    return true;
  } catch {
    // Server might be down, allow access with existing token
    return !!localStorage.getItem('portal-user');
  }
}

function showUserInfo() {
  const user = JSON.parse(localStorage.getItem('portal-user') || '{}');
  const container = document.getElementById('header-user');
  const usernameEl = document.getElementById('header-username');
  const roleEl = document.getElementById('header-role');
  const logoutBtn = document.getElementById('logout-btn');
  const loginBtn = document.getElementById('login-btn');

  if (user.username) {
    // Logged in: show user info + logout
    if (container) container.style.display = 'flex';
    if (usernameEl) usernameEl.textContent = user.username;
    if (roleEl) {
      roleEl.textContent = user.role.toUpperCase();
      roleEl.className = `header__role-badge role-${user.role}`;
    }
    if (logoutBtn) logoutBtn.style.display = 'flex';
    if (loginBtn) loginBtn.style.display = 'none';
  } else {
    // Guest: show login button
    if (container) container.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'flex';
  }
}

function initAuthUI() {
  // Login button opens the modal
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => openLoginModal());
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('portal-token');
      localStorage.removeItem('portal-user');
      showUserInfo();
      window.location.reload();
    });
  }

  // Login form submission
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', handleLogin);
  }

  // Close modal
  const closeBtn = document.getElementById('login-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeLoginModal);

  const backdrop = document.getElementById('login-modal');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeLoginModal();
    });
  }
}

function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
    const input = document.getElementById('login-username');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('modal--open');
    document.body.style.overflow = '';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-submit');
  if (errorEl) errorEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = 'Connexion…'; }

  const username = document.getElementById('login-username')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  try {
    const res = await fetch('/portal/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      if (errorEl) errorEl.textContent = data.error || 'Erreur de connexion.';
      if (btn) { btn.disabled = false; btn.textContent = 'Se connecter'; }
      return;
    }

    localStorage.setItem('portal-token', data.token);
    localStorage.setItem('portal-user', JSON.stringify(data.user));
    closeLoginModal();
    showUserInfo();
    window.location.reload();
  } catch {
    if (errorEl) errorEl.textContent = 'Impossible de contacter le serveur.';
    if (btn) { btn.disabled = false; btn.textContent = 'Se connecter'; }
  }
}

// ── Année dans le footer ──────────────────────────────────────────────────────

function initYear() {
  const el = document.getElementById('yr');
  if (el) el.textContent = new Date().getFullYear();
}

// ── Métriques & health-check ──────────────────────────────────────────────────

const HEALTH_POLL_INTERVAL_MS = 10000;
let latestHealth = null;

async function initHealthMonitoring() {
  await refreshHealth();
  setInterval(refreshHealth, HEALTH_POLL_INTERVAL_MS);
}

async function refreshHealth() {
  const startedAt = performance.now();
  const healthData = await fetchHealthData();
  const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));

  if (healthData) {
    latestHealth = healthData;
  }

  const uptime = healthData?.uptime ?? latestHealth?.uptime ?? '—';
  const requests = healthData?.requests ?? latestHealth?.requests ?? '—';
  const latency = healthData?.latency ? `${healthData.latency} ms` : `${elapsedMs} ms`;

  updateMetric('metric-uptime', formatUptime(uptime));
  updateMetric('metric-latency', latency);
  updateMetric('metric-requests', formatRequests(requests));

  const updates = healthData?.services ?? [];
  updateProjectHealth(updates);
  pushStatusChangeLogs();
}

async function fetchHealthData() {
  try {
    const token = localStorage.getItem('portal-token');
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

    const res = await fetch('/portal/api/health', { cache: 'no-store', headers });
    if (!res.ok) return null;
    const data = await res.json();

    const services = Array.isArray(data.services)
      ? data.services.map(service => ({
          id: service.id,
          name: service.name,
          url: service.url || service.path,
          status: normalizeStatus(service.status),
          uptime: service.uptime ?? service.uptimeHuman
        }))
      : [];

    return {
      uptime: data.uptime ?? data.metrics?.uptime,
      latency: toInt(data.latency ?? data.metrics?.latency),
      requests: data.requestsPerMin ?? data.metrics?.requestsPerMin,
      services: services.filter(s => s.status)
    };
  } catch {
    return null;
  }
}

function updateMetric(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent === value) return;
  el.textContent = value;
  el.classList.remove('metric--updated');
  void el.offsetWidth;
  el.classList.add('metric--updated');
}

// ── Timeline d'événements ─────────────────────────────────────────────────────

let timelineContainer = null;
const projectStatusById = new Map();

function initTimeline() {
  timelineContainer = document.getElementById('timeline');
  if (!timelineContainer) return;

  addLogEntry(timelineContainer, 'INFO', 'Portail démarré avec succès.');
  addLogEntry(timelineContainer, 'INFO', 'Backend API connecté.');

  getProjects().forEach(project => {
    projectStatusById.set(project.id, project.status);
    const level = project.status === 'DOWN' ? 'ERROR' : project.status === 'DEGRADED' ? 'WARN' : 'INFO';
    addLogEntry(timelineContainer, level, `${project.name} : statut initial ${project.status}.`);
  });
}

function pushStatusChangeLogs() {
  if (!timelineContainer) return;

  getProjects().forEach(project => {
    const previous = projectStatusById.get(project.id);
    if (!previous) {
      projectStatusById.set(project.id, project.status);
      return;
    }
    if (previous === project.status) return;

    projectStatusById.set(project.id, project.status);
    const level = project.status === 'DOWN' ? 'ERROR' : project.status === 'DEGRADED' ? 'WARN' : 'INFO';
    addLogEntry(
      timelineContainer,
      level,
      `${project.name} : statut ${previous} → ${project.status}.`
    );
  });
}

function addLogEntry(container, level, msg) {
  const now = new Date().toLocaleTimeString('fr-FR', { hour12: false });
  const cls = `log--${level.toLowerCase()}`;
  const div = document.createElement('div');
  div.className = `log-entry ${cls}`;
  div.setAttribute('role', 'listitem');
  div.innerHTML = `<span class="log__time">${now}</span><span class="log__level">${level}</span><span class="log__msg">${escapeHtml(msg)}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ── Raccourcis clavier ────────────────────────────────────────────────────────

let gPressed = false;
let gTimeout = null;

function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === '/' && !inField) {
      e.preventDefault();
      document.getElementById('search')?.focus();
      return;
    }

    if (e.key === 't' && !inField) {
      toggleTheme();
      return;
    }

    if (e.key === 'g' && !inField) {
      gPressed = true;
      clearTimeout(gTimeout);
      gTimeout = setTimeout(() => { gPressed = false; }, 1500);
      return;
    }

    if (gPressed && /^[1-9]$/.test(e.key) && !inField) {
      e.preventDefault();
      gPressed = false;
      clearTimeout(gTimeout);
      openProject(parseInt(e.key, 10));
      return;
    }

    if (e.key === 'Escape' && inField && document.activeElement?.id === 'search') {
      document.activeElement.value = '';
      document.activeElement.dispatchEvent(new Event('input'));
      document.activeElement.blur();
    }
  });
}

// ── Presse-papiers ───────────────────────────────────────────────────────────

function initClipboard() {
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        const orig = btn.textContent;
        btn.textContent = '✓ Copié';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      } catch {
        btn.textContent = 'Erreur';
        setTimeout(() => { btn.textContent = 'Copier'; }, 1500);
      }
    });
  });
}

// ── Utilitaires ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeStatus(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'UP' || value === 'DEGRADED' || value === 'DOWN') return value;
  if (value === 'OK' || value === 'HEALTHY') return 'UP';
  if (value === 'WARNING') return 'DEGRADED';
  if (value === 'KO' || value === 'ERROR' || value === 'UNHEALTHY') return 'DOWN';
  return null;
}

function formatUptime(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return `${value.toFixed(2)}%`;
  return String(value);
}

function formatRequests(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return `${value}/min`;
  return String(value);
}

function toInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}
