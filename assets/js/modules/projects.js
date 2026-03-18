/**
 * projects.js — Chargement et rendu dynamique des projets.
 * Gère la recherche, le filtrage par tag, le tri, et l'ouverture de la modale détail.
 */

import { openProjectDetail } from './charts.js';

let allProjects = [];
let activeFilter = 'all';
let activeSort = 'index';
let searchQuery = '';

const STATUS_LABEL = { UP: 'UP', DEGRADED: 'DÉGRADÉ', DOWN: 'DOWN' };

/** Charge les données depuis l'API backend (fallback: data/projects.json). */
export async function initProjects() {
  try {
    const token = localStorage.getItem('portal-token');
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

    const res = await fetch('/portal/api/projects', { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allProjects = await res.json();
  } catch {
    // Fallback to static JSON
    try {
      const res = await fetch('data/projects.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allProjects = await res.json();
    } catch (err) {
      console.error('[projects] Impossible de charger les projets :', err);
      allProjects = [];
    }
  }

  buildTagFilters();
  renderProjects();
  initSearch();
  initSort();
}

/** Construit les boutons de filtre par tag. */
function buildTagFilters() {
  const tags = new Set();
  allProjects.forEach(p => p.tags.forEach(t => tags.add(t)));

  const container = document.getElementById('tag-filters');
  if (!container) return;

  tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = tag;
    btn.textContent = tag;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => setFilter(tag));
    container.appendChild(btn);
  });
}

/** Active un filtre et re-rend les projets. */
function setFilter(filter) {
  activeFilter = filter;

  document.querySelectorAll('.filter-btn').forEach(btn => {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  renderProjects();
}

/** Initialise le champ de recherche. */
function initSearch() {
  const input = document.getElementById('search');
  if (!input) return;

  input.addEventListener('input', () => {
    searchQuery = input.value.trim().toLowerCase();
    renderProjects();
  });
}

/** Initialise le sélecteur de tri. */
function initSort() {
  const select = document.getElementById('sort-select');
  if (!select) return;

  select.addEventListener('change', () => {
    activeSort = select.value;
    renderProjects();
  });
}

/** Retourne la liste filtrée et triée. */
function getFilteredProjects() {
  let list = allProjects.filter(p => {
    const matchesFilter = activeFilter === 'all' || p.tags.includes(activeFilter);
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery) ||
      p.description.toLowerCase().includes(searchQuery) ||
      p.tags.some(t => t.toLowerCase().includes(searchQuery));
    return matchesFilter && matchesSearch;
  });

  const statusOrder = { UP: 0, DEGRADED: 1, DOWN: 2 };

  list = [...list].sort((a, b) => {
    if (activeSort === 'name') return a.name.localeCompare(b.name, 'fr');
    if (activeSort === 'status') return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (activeSort === 'date') return new Date(b.updatedAt) - new Date(a.updatedAt);
    return a.id - b.id;
  });

  return list;
}

/** Rend les cartes projet dans #projects-grid. */
export function renderProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  const projects = getFilteredProjects();
  grid.innerHTML = '';

  if (projects.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Aucun projet ne correspond à votre recherche.';
    empty.setAttribute('role', 'status');
    grid.appendChild(empty);
    return;
  }

  projects.forEach((project, index) => {
    // Use Web Component if available, otherwise fallback to vanilla
    if (customElements.get('project-card')) {
      const card = document.createElement('project-card');
      card.projectData = project;
      card.style.setProperty('--i', index);
      card.addEventListener('project-click', (e) => {
        e.preventDefault();
        openProjectDetail(e.detail);
      });
      grid.appendChild(card);
    } else {
      grid.appendChild(createCard(project, index));
    }
  });
}

/** Crée une carte projet (fallback vanilla). */
function createCard(project, index) {
  const div = document.createElement('div');
  div.className = 'card';
  div.style.setProperty('--i', index);
  div.setAttribute('role', 'button');
  div.setAttribute('tabindex', '0');
  div.setAttribute('aria-label', `${project.name} — statut : ${STATUS_LABEL[project.status] || project.status}`);
  div.dataset.projectId = project.id;

  const statusClass = `status--${project.status.toLowerCase()}`;
  const statusLabel = STATUS_LABEL[project.status] || project.status;

  const num = String(project.id).padStart(2, '0');
  const tagsHtml = project.tags
    .map(t => `<span class="tag" aria-label="Tag : ${t}">${t}</span>`)
    .join('');

  div.innerHTML = `
    <div class="card__header">
      <span class="card__num" aria-hidden="true">${num}</span>
      <span class="status-badge ${statusClass}" aria-label="Statut : ${statusLabel}">${statusLabel}</span>
    </div>
    <h2 class="card__title">${escapeHtml(project.name)}</h2>
    <p class="card__desc">${escapeHtml(project.description)}</p>
    <div class="card__tags" aria-label="Technologies">${tagsHtml}</div>
    <span class="card__arrow" aria-hidden="true">
      Détails
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </span>
  `;

  // Open modal on click
  div.addEventListener('click', (e) => {
    e.preventDefault();
    openProjectDetail(project);
  });

  div.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openProjectDetail(project);
    }
  });

  return div;
}

/** Retourne les projets chargés (pour le terminal). */
export function getProjects() {
  return allProjects;
}

/** Met à jour dynamiquement les statuts/uptime des projets puis re-rend la grille. */
export function updateProjectHealth(updates = []) {
  if (!Array.isArray(updates) || !updates.length) return;

  const byId = new Map();
  const byName = new Map();
  const byUrl = new Map();

  allProjects.forEach(project => {
    byId.set(String(project.id), project);
    byName.set(project.name.trim().toLowerCase(), project);
    byUrl.set(normalizePath(project.url), project);
  });

  let changed = false;

  updates.forEach(update => {
    const id = update.id != null ? String(update.id) : null;
    const name = update.name ? String(update.name).trim().toLowerCase() : null;
    const url = update.url ? normalizePath(update.url) : null;

    const project = (id && byId.get(id)) || (name && byName.get(name)) || (url && byUrl.get(url));
    if (!project) return;

    if (update.status && project.status !== update.status) {
      project.status = update.status;
      changed = true;
    }

    if (update.uptime) {
      project.runtimeUptime = String(update.uptime);
    }
  });

  if (changed) renderProjects();
}

/** Ouvre le projet par index 1-based (pour les raccourcis clavier et terminal). */
export function openProject(num) {
  const project = allProjects[num - 1];
  if (project) {
    openProjectDetail(project);
    return project;
  }
  return null;
}

/** Échappe les caractères HTML pour éviter l'injection. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePath(value) {
  try {
    const url = new URL(value, window.location.origin);
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return String(value || '').replace(/\/+$/, '') || '/';
  }
}

/** Expose setFilter pour usage externe (terminal, main). */
export { setFilter };
