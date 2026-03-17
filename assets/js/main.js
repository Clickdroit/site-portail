/**
 * main.js — Point d'entrée principal.
 * Initialise les modules, les métriques mockées, la timeline et les raccourcis clavier.
 */

import { initTheme, toggleTheme } from './modules/theme.js';
import { initTerminal } from './modules/terminal.js';
import { getProjects, initProjects, openProject, updateProjectHealth } from './modules/projects.js';

// ── Initialisation ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await initProjects();
  initTerminal();
  initHealthMonitoring();
  initTimeline();
  initKeyboardShortcuts();
  initYear();
  initClipboard();
});

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
  // Évite une latence "0 ms" visuellement trompeuse lors d'une réponse quasi instantanée.
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

  const updates = healthData?.services ?? (await probeProjectUrls());
  updateProjectHealth(updates);
  pushStatusChangeLogs();
}

async function fetchHealthData() {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
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

async function probeProjectUrls() {
  const projects = getProjects();
  if (!projects.length) return [];

  const checks = projects.map(async project => {
    const status = await checkProjectUrl(project.url);
    return {
      id: project.id,
      name: project.name,
      url: project.url,
      status
    };
  });

  return Promise.all(checks);
}

async function checkProjectUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (res.ok) return 'UP';
    if (res.status >= 500) return 'DOWN';
    return 'DEGRADED';
  } catch {
    return 'DOWN';
  }
}

function updateMetric(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent === value) return;
  el.textContent = value;
  el.classList.remove('metric--updated');
  // Force un reflow pour redémarrer l'animation CSS quand la valeur change.
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
  addLogEntry(timelineContainer, 'INFO', 'Données projets chargées depuis data/projects.json.');

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
    // Ne pas intercepter si focus sur input/textarea/select
    const tag = document.activeElement?.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // / — focus recherche
    if (e.key === '/' && !inField) {
      e.preventDefault();
      document.getElementById('search')?.focus();
      return;
    }

    // t — changer thème (hors champs)
    if (e.key === 't' && !inField) {
      toggleTheme();
      return;
    }

    // g suivi de 1-9 — ouvrir projet
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

    // Escape — vider la recherche et retirer le focus
    if (e.key === 'Escape' && inField && document.activeElement?.id === 'search') {
      document.activeElement.value = '';
      document.activeElement.dispatchEvent(new Event('input'));
      document.activeElement.blur();
    }
  });
}

// ── Presse-papiers (avec fallback) ───────────────────────────────────────────

function initClipboard() {
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback : sélection temporaire
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
