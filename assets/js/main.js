/**
 * main.js — Point d'entrée principal.
 * Initialise les modules, les métriques mockées, la timeline et les raccourcis clavier.
 */

import { initTheme, toggleTheme } from './modules/theme.js';
import { initTerminal } from './modules/terminal.js';
import { initProjects, openProject } from './modules/projects.js';

// ── Initialisation ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await initProjects();
  initTerminal();
  initMetrics();
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

// ── Métriques simulées ────────────────────────────────────────────────────────

function initMetrics() {
  updateMetric('metric-uptime', () => (99.9 + Math.random() * 0.09).toFixed(2) + '%');
  updateMetric('metric-latency', () => Math.floor(8 + Math.random() * 20) + ' ms');
  updateMetric('metric-requests', () => Math.floor(1200 + Math.random() * 400) + '/min');

  // Rafraîchissement toutes les 5 s
  setInterval(() => {
    updateMetric('metric-uptime', () => (99.9 + Math.random() * 0.09).toFixed(2) + '%');
    updateMetric('metric-latency', () => Math.floor(8 + Math.random() * 20) + ' ms');
    updateMetric('metric-requests', () => Math.floor(1200 + Math.random() * 400) + '/min');
  }, 5000);
}

function updateMetric(id, valueFn) {
  const el = document.getElementById(id);
  if (el) el.textContent = valueFn();
}

// ── Timeline d'événements simulés ────────────────────────────────────────────

const LOG_EVENTS = [
  { level: 'INFO', msg: 'Portail démarré avec succès.' },
  { level: 'INFO', msg: 'Données projets chargées depuis data/projects.json.' },
  { level: 'WARN', msg: 'Site 2 : latence élevée détectée (>200ms).' },
  { level: 'ERROR', msg: 'Site 3 : health-check échoué — statut DOWN.' },
  { level: 'INFO', msg: 'Thème initialisé depuis localStorage.' },
  { level: 'INFO', msg: 'Terminal prêt.' },
];

let logIndex = 0;

function initTimeline() {
  const container = document.getElementById('timeline');
  if (!container) return;

  // Affichage progressif des logs simulés
  function addNextLog() {
    if (logIndex >= LOG_EVENTS.length) return;
    const { level, msg } = LOG_EVENTS[logIndex++];
    addLogEntry(container, level, msg);
    const delay = 600 + Math.random() * 800;
    setTimeout(addNextLog, delay);
  }

  addNextLog();
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
