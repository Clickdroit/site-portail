/**
 * charts.js — Project detail modal with Apache ECharts graphs.
 * Displays latency and uptime history for a selected project.
 */

let latencyChart = null;
let uptimeChart = null;
let currentProjectId = null;

/** Open the detail modal for a project. */
export async function openProjectDetail(project) {
  currentProjectId = project.id;
  const modal = document.getElementById('project-modal');
  if (!modal) return;

  // Populate project info
  const info = document.getElementById('modal-project-info');
  if (info) {
    const statusClass = `status--${project.status.toLowerCase()}`;
    info.innerHTML = `
      <div class="modal-project-status">
        <span class="status-badge ${statusClass}">${project.status}</span>
        <span class="modal-project-tags">${project.tags.map(t => `<span class="tag">${t}</span>`).join('')}</span>
      </div>
      <p class="modal-project-desc">${escapeHtml(project.description)}</p>
    `;
  }

  // Set title and link
  const title = document.getElementById('modal-title');
  if (title) title.textContent = project.name;

  const link = document.getElementById('modal-visit-link');
  if (link) link.href = project.url;

  // Show modal
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('modal--open');
  document.body.style.overflow = 'hidden';

  // Fetch history and render charts
  await loadCharts(project.id);
}

/** Close the detail modal. */
export function closeProjectDetail() {
  const modal = document.getElementById('project-modal');
  if (!modal) return;

  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('modal--open');
  document.body.style.overflow = '';
  currentProjectId = null;

  // Dispose charts to free memory
  if (latencyChart) { latencyChart.dispose(); latencyChart = null; }
  if (uptimeChart) { uptimeChart.dispose(); uptimeChart = null; }
}

/** Initialize modal close handlers. */
export function initCharts() {
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeProjectDetail);
  }

  const modal = document.getElementById('project-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeProjectDetail();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentProjectId != null) {
      closeProjectDetail();
    }
  });

  // Handle resize for responsive charts
  window.addEventListener('resize', () => {
    if (latencyChart) latencyChart.resize();
    if (uptimeChart) uptimeChart.resize();
  });
}

/** Load history data and render charts. */
async function loadCharts(projectId) {
  const token = localStorage.getItem('portal-token');
  const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

  try {
    const res = await fetch(`/api/v1/projects/${projectId}/history?hours=24`, {
      headers, cache: 'no-store'
    });

    if (!res.ok) {
      showChartError('Impossible de charger l\'historique.');
      return;
    }

    const { data } = await res.json();

    if (!data || data.length === 0) {
      showChartError('Aucune donnée historique disponible. Les données apparaîtront après quelques cycles de vérification.');
      return;
    }

    renderLatencyChart(data);
    renderUptimeChart(data);
  } catch (err) {
    showChartError('Erreur réseau lors du chargement des graphiques.');
  }
}

function showChartError(msg) {
  const latencyEl = document.getElementById('chart-latency');
  const uptimeEl = document.getElementById('chart-uptime');
  const html = `<div class="chart-empty">${escapeHtml(msg)}</div>`;
  if (latencyEl) latencyEl.innerHTML = html;
  if (uptimeEl) uptimeEl.innerHTML = html;
}

/** Render latency line chart. */
function renderLatencyChart(data) {
  const el = document.getElementById('chart-latency');
  if (!el || typeof echarts === 'undefined') return;

  el.innerHTML = '';
  latencyChart = echarts.init(el, null, { renderer: 'canvas' });

  const times = data.map(d => formatTime(d.checkedAt));
  const values = data.map(d => d.latencyMs);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  latencyChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1a1e28' : '#ffffff',
      borderColor: isDark ? '#353c50' : '#d1d9e0',
      textStyle: { color: isDark ? '#cdd6f4' : '#1e2533', fontFamily: 'monospace', fontSize: 12 },
      formatter: (params) => {
        const p = params[0];
        return `<strong>${p.axisValue}</strong><br/>Latence: <strong>${p.value} ms</strong>`;
      }
    },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: { color: isDark ? '#6c7086' : '#6b7a90', fontSize: 10, fontFamily: 'monospace' },
      axisLine: { lineStyle: { color: isDark ? '#252a38' : '#d1d9e0' } }
    },
    yAxis: {
      type: 'value',
      name: 'ms',
      nameTextStyle: { color: isDark ? '#6c7086' : '#6b7a90', fontFamily: 'monospace', fontSize: 10 },
      axisLabel: { color: isDark ? '#6c7086' : '#6b7a90', fontSize: 10, fontFamily: 'monospace' },
      splitLine: { lineStyle: { color: isDark ? '#252a3820' : '#d1d9e040' } }
    },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { color: '#89b4fa', width: 2 },
      itemStyle: { color: '#89b4fa' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(137,180,250,0.3)' },
            { offset: 1, color: 'rgba(137,180,250,0.02)' }
          ]
        }
      }
    }],
    animation: true,
    animationDuration: 600
  });
}

/** Render uptime status chart (scatter/heatmap). */
function renderUptimeChart(data) {
  const el = document.getElementById('chart-uptime');
  if (!el || typeof echarts === 'undefined') return;

  el.innerHTML = '';
  uptimeChart = echarts.init(el, null, { renderer: 'canvas' });

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const times = data.map(d => formatTime(d.checkedAt));
  const statusColors = { UP: '#a6e3a1', DEGRADED: '#f9e2af', DOWN: '#f38ba8' };

  const scatterData = data.map((d, i) => ({
    value: [i, d.status === 'UP' ? 2 : d.status === 'DEGRADED' ? 1 : 0],
    itemStyle: { color: statusColors[d.status] || '#6c7086' }
  }));

  uptimeChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? '#1a1e28' : '#ffffff',
      borderColor: isDark ? '#353c50' : '#d1d9e0',
      textStyle: { color: isDark ? '#cdd6f4' : '#1e2533', fontFamily: 'monospace', fontSize: 12 },
      formatter: (params) => {
        const d = data[params.dataIndex];
        return `<strong>${formatTime(d.checkedAt)}</strong><br/>Statut: <strong>${d.status}</strong><br/>Latence: ${d.latencyMs}ms`;
      }
    },
    grid: { top: 10, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: { color: isDark ? '#6c7086' : '#6b7a90', fontSize: 10, fontFamily: 'monospace' },
      axisLine: { lineStyle: { color: isDark ? '#252a38' : '#d1d9e0' } }
    },
    yAxis: {
      type: 'value',
      min: -0.5,
      max: 2.5,
      interval: 1,
      axisLabel: {
        color: isDark ? '#6c7086' : '#6b7a90',
        fontSize: 10,
        fontFamily: 'monospace',
        formatter: (v) => ['DOWN', 'DEGRADED', 'UP'][v] || ''
      },
      splitLine: { lineStyle: { color: isDark ? '#252a3820' : '#d1d9e040' } }
    },
    series: [{
      type: 'scatter',
      data: scatterData,
      symbolSize: 10,
      symbol: 'circle'
    }],
    animation: true,
    animationDuration: 600
  });
}

function formatTime(dateStr) {
  try {
    const d = new Date(dateStr + 'Z');
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return dateStr;
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
