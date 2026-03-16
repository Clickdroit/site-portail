/**
 * terminal.js — Terminal simulé avec historique localStorage et auto-complétion.
 * Commandes disponibles : help, list, open <n>, theme <dark|light>, clear.
 */

import { applyTheme, getTheme } from './theme.js';
import { getProjects, openProject } from './projects.js';

const HISTORY_KEY = 'portal-terminal-history';
const MAX_HISTORY = 50;

let history = [];
let historyIndex = -1;

const COMMANDS = ['help', 'list', 'open', 'theme', 'clear'];

/** Initialise le terminal. */
export function initTerminal() {
  history = loadHistory();

  const input = document.getElementById('terminal-input');
  const output = document.getElementById('terminal-output');

  if (!input || !output) return;

  printWelcome(output);

  input.addEventListener('keydown', e => handleKey(e, input, output));
  input.addEventListener('input', handleAutocomplete);
}

/** Gère les touches clavier du terminal. */
function handleKey(e, input, output) {
  if (e.key === 'Enter') {
    const cmd = input.value.trim();
    if (cmd) {
      pushHistory(cmd);
      historyIndex = -1;
      printLine(output, `<span class="t-prompt">❯</span> <span class="t-cmd">${escapeHtml(cmd)}</span>`);
      const result = execute(cmd);
      if (result) printLine(output, result);
    }
    input.value = '';
    output.scrollTop = output.scrollHeight;
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex < history.length - 1) {
      historyIndex++;
      input.value = history[history.length - 1 - historyIndex];
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      input.value = history[history.length - 1 - historyIndex];
    } else {
      historyIndex = -1;
      input.value = '';
    }
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    const partial = input.value.trim();
    const match = COMMANDS.find(c => c.startsWith(partial) && c !== partial);
    if (match) input.value = match + ' ';
  }
}

/** Placeholder pour l'auto-complétion visuelle (extension possible). */
function handleAutocomplete() {}

/** Exécute une commande et retourne la sortie HTML. */
function execute(raw) {
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      return cmdHelp();
    case 'list':
      return cmdList();
    case 'open':
      return cmdOpen(args);
    case 'theme':
      return cmdTheme(args);
    case 'clear':
      cmdClear();
      return null;
    default:
      return `<span class="t-error">Commande inconnue : <strong>${escapeHtml(cmd)}</strong>. Tapez <em>help</em> pour l'aide.</span>`;
  }
}

function cmdHelp() {
  return `<span class="t-output">
  <strong>Commandes disponibles :</strong><br>
  &nbsp;&nbsp;<em>help</em>         — affiche cette aide<br>
  &nbsp;&nbsp;<em>list</em>         — liste les projets<br>
  &nbsp;&nbsp;<em>open &lt;n&gt;</em>    — ouvre le projet n°n<br>
  &nbsp;&nbsp;<em>theme &lt;dark|light&gt;</em> — change le thème<br>
  &nbsp;&nbsp;<em>clear</em>        — vide le terminal<br>
  <span class="t-muted">Raccourcis: ↑/↓ historique · Tab complétion</span>
</span>`;
}

function cmdList() {
  const projects = getProjects();
  if (!projects.length) return '<span class="t-error">Aucun projet chargé.</span>';

  const STATUS_ICON = { UP: '●', DEGRADED: '◐', DOWN: '○' };
  const STATUS_CLASS = { UP: 't-up', DEGRADED: 't-degraded', DOWN: 't-down' };

  const rows = projects
    .map(p => {
      const icon = STATUS_ICON[p.status] || '?';
      const cls = STATUS_CLASS[p.status] || '';
      return `  <span class="${cls}">${icon}</span> [${String(p.id).padStart(2, '0')}] ${escapeHtml(p.name)} <span class="t-muted">(${p.tags.join(', ')})</span>`;
    })
    .join('<br>');

  return `<span class="t-output"><strong>Projets :</strong><br>${rows}</span>`;
}

function cmdOpen(args) {
  const n = parseInt(args[0], 10);
  if (isNaN(n) || n < 1) {
    return '<span class="t-error">Usage : open &lt;numéro&gt; (ex: open 1)</span>';
  }
  const project = openProject(n);
  if (!project) {
    return `<span class="t-error">Projet n°${n} introuvable. Utilisez <em>list</em> pour voir les projets.</span>`;
  }
  return `<span class="t-output">Ouverture de <strong>${escapeHtml(project.name)}</strong>…</span>`;
}

function cmdTheme(args) {
  const theme = args[0] ? args[0].toLowerCase() : null;
  if (!theme || !['dark', 'light'].includes(theme)) {
    return `<span class="t-error">Usage : theme &lt;dark|light&gt; — actuel : <strong>${getTheme()}</strong></span>`;
  }
  applyTheme(theme);
  return `<span class="t-output">Thème changé : <strong>${theme}</strong></span>`;
}

function cmdClear() {
  const output = document.getElementById('terminal-output');
  if (output) output.innerHTML = '';
}

/** Affiche le message de bienvenue. */
function printWelcome(output) {
  printLine(output, `<span class="t-output t-muted">Terminal prêt. Tapez <em>help</em> pour l'aide.</span>`);
}

/** Ajoute une ligne dans l'output. */
function printLine(output, html) {
  const div = document.createElement('div');
  div.className = 't-line';
  div.innerHTML = html;
  output.appendChild(div);
}

/** Charge l'historique depuis localStorage. */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Ajoute une entrée dans l'historique et persiste. */
function pushHistory(cmd) {
  history = history.filter(c => c !== cmd);
  history.push(cmd);
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // localStorage indisponible : continuer sans persistance
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
