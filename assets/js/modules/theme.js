/**
 * theme.js — Gestion du thème clair/sombre.
 * Persiste le choix via localStorage.
 */

const THEME_KEY = 'portal-theme';
const DEFAULT_THEME = 'dark';

/** Initialise le thème au chargement de la page. */
export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
  applyTheme(saved);

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }
}

/** Bascule entre thème sombre et clair. */
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/** Applique un thème donné et met à jour le bouton. */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const label = theme === 'dark' ? 'sombre' : 'clair';
    btn.setAttribute('aria-label', `Thème actuel : ${label} — appuyer pour changer (t)`);
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
    btn.textContent = theme === 'dark' ? '☀' : '◐';
  }

  return theme;
}

/** Retourne le thème actif. */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
}
