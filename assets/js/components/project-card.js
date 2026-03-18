/**
 * <project-card> — Custom element for displaying a project card.
 * Set project data via the `projectData` property.
 * Dispatches 'project-click' custom event when clicked.
 */

class ProjectCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._project = null;
  }

  set projectData(data) {
    this._project = data;
    this.render();
  }

  get projectData() {
    return this._project;
  }

  connectedCallback() {
    if (this._project) this.render();
  }

  render() {
    const p = this._project;
    if (!p) return;

    const statusClass = p.status === 'UP' ? 'up' : p.status === 'DEGRADED' ? 'degraded' : 'down';
    const statusLabel = p.status === 'DEGRADED' ? 'DÉGRADÉ' : p.status;
    const num = String(p.id).padStart(2, '0');
    const tagsHtml = (p.tags || []).map(t => `<span class="tag">${this.esc(t)}</span>`).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          cursor: pointer;
        }

        .card {
          display: flex;
          flex-direction: column;
          background: var(--surface, #13161d);
          border: 1px solid var(--border, #252a38);
          border-radius: var(--radius, 10px);
          padding: 22px 22px 18px;
          text-decoration: none;
          color: inherit;
          box-shadow: var(--shadow, 0 2px 12px rgba(0,0,0,.45));
          transition: transform .22s cubic-bezier(.4,0,.2,1),
                      box-shadow .22s cubic-bezier(.4,0,.2,1),
                      border-color .22s cubic-bezier(.4,0,.2,1);
          height: 100%;
        }

        .card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-h, 0 8px 32px rgba(0,0,0,.65));
          border-color: var(--border-h, #353c50);
        }

        .card:focus-visible {
          outline: 2px solid var(--accent, #89b4fa);
          outline-offset: 3px;
        }

        .card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .card__num {
          font-family: var(--font-mono, monospace);
          font-size: .7rem;
          font-weight: 700;
          letter-spacing: .1em;
          color: var(--accent, #89b4fa);
          background: var(--accent-glow, rgba(137,180,250,.18));
          border: 1px solid var(--accent, #89b4fa);
          border-radius: 4px;
          padding: 2px 8px;
        }

        .card__title {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--heading, #e2e8f0);
          margin: 0 0 8px;
          line-height: 1.3;
        }

        .card__desc {
          font-size: .85rem;
          color: var(--muted, #6c7086);
          line-height: 1.6;
          flex: 1;
          margin: 0;
        }

        .card__tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 14px;
        }

        .tag {
          font-family: var(--font-mono, monospace);
          font-size: .65rem;
          padding: 2px 7px;
          border-radius: 4px;
          background: var(--surface-2, #1a1e28);
          border: 1px solid var(--border, #252a38);
          color: var(--muted, #6c7086);
        }

        .card__arrow {
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: .82rem;
          font-weight: 500;
          color: var(--accent, #89b4fa);
          transition: gap .22s cubic-bezier(.4,0,.2,1);
        }

        .card:hover .card__arrow { gap: 9px; }

        .card__arrow svg {
          width: 14px;
          height: 14px;
          stroke: currentColor;
          stroke-width: 2;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          flex-shrink: 0;
          transition: transform .22s cubic-bezier(.4,0,.2,1);
        }

        .card:hover .card__arrow svg { transform: translateX(3px); }

        /* Status badge */
        .status-badge {
          font-family: var(--font-mono, monospace);
          font-size: .65rem;
          font-weight: 700;
          letter-spacing: .1em;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid;
        }

        .status--up { color: var(--up, #a6e3a1); background: rgba(166,227,161,.1); border-color: var(--up, #a6e3a1); }
        .status--degraded { color: var(--degraded, #f9e2af); background: rgba(249,226,175,.1); border-color: var(--degraded, #f9e2af); }
        .status--down { color: var(--down, #f38ba8); background: rgba(243,139,168,.1); border-color: var(--down, #f38ba8); }
      </style>

      <div class="card" tabindex="0" role="button"
           aria-label="${this.esc(p.name)} — statut : ${statusLabel}">
        <div class="card__header">
          <span class="card__num" aria-hidden="true">${num}</span>
          <span class="status-badge status--${statusClass}" aria-label="Statut : ${statusLabel}">${statusLabel}</span>
        </div>
        <h2 class="card__title">${this.esc(p.name)}</h2>
        <p class="card__desc">${this.esc(p.description)}</p>
        <div class="card__tags" aria-label="Technologies">${tagsHtml}</div>
        <span class="card__arrow" aria-hidden="true">
          Détails
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </div>
    `;

    const card = this.shadowRoot.querySelector('.card');
    card.addEventListener('click', () => this.emitClick());
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.emitClick();
      }
    });
  }

  emitClick() {
    this.dispatchEvent(new CustomEvent('project-click', {
      detail: this._project,
      bubbles: true,
      composed: true
    }));
  }

  esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

customElements.define('project-card', ProjectCard);
