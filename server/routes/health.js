/**
 * routes/health.js — Health endpoint (compatible with existing frontend).
 */

const express = require('express');
const { getAllProjects, getGlobalMetrics } = require('../db');

const router = express.Router();

/**
 * GET /api/v1/health
 * Returns global metrics + per-service status.
 * Shape matches what the frontend fetchHealthData() expects.
 */
router.get('/', (req, res) => {
  try {
    const metrics = getGlobalMetrics();
    const projects = getAllProjects();

    const services = projects.map(p => ({
      id: p.id,
      name: p.name,
      url: p.url,
      status: p.status,
      uptimeHuman: p.status === 'UP' ? 'running' : p.status === 'DEGRADED' ? 'degraded' : 'down'
    }));

    res.json({
      status: 'ok',
      uptime: metrics.uptime,
      latency: metrics.latency,
      requestsPerMin: metrics.requestsPerMin,
      metrics: {
        uptime: metrics.uptime,
        latency: metrics.latency,
        requestsPerMin: metrics.requestsPerMin,
        totalProjects: metrics.totalProjects,
        upCount: metrics.upCount
      },
      services
    });
  } catch (err) {
    console.error('[api] Error in health endpoint:', err);
    res.status(500).json({ status: 'error', error: 'Internal server error' });
  }
});

module.exports = router;
