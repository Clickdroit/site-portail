/**
 * <status-badge> — Custom element for displaying project status.
 * Usage: <status-badge status="UP"></status-badge>
 */

class StatusBadge extends HTMLElement {
  static get observedAttributes() {
    return ['status'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const status = (this.getAttribute('status') || 'DOWN').toUpperCase();
    const labels = { UP: 'UP', DEGRADED: 'DÉGRADÉ', DOWN: 'DOWN' };
    const label = labels[status] || status;

    const colors = {
      UP: { color: 'var(--up, #a6e3a1)', bg: 'rgba(166,227,161,0.1)' },
      DEGRADED: { color: 'var(--degraded, #f9e2af)', bg: 'rgba(249,226,175,0.1)' },
      DOWN: { color: 'var(--down, #f38ba8)', bg: 'rgba(243,139,168,0.1)' }
    };

    const c = colors[status] || colors.DOWN;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }
        .badge {
          font-family: var(--font-mono, monospace);
          font-size: .65rem;
          font-weight: 700;
          letter-spacing: .1em;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid ${c.color};
          color: ${c.color};
          background: ${c.bg};
          line-height: 1.5;
        }
      </style>
      <span class="badge" role="status" aria-label="Statut : ${label}">${label}</span>
    `;
  }
}

customElements.define('status-badge', StatusBadge);
