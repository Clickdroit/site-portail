/**
 * routes/projects.js — Project API routes.
 */

const express = require('express');
const { getAllProjects, getProjectById, getProjectHistory } = require('../db');

const router = express.Router();

/** GET /api/v1/projects — List all projects with latest status. */
router.get('/', (req, res) => {
  try {
    const projects = getAllProjects();
    res.json(projects);
  } catch (err) {
    console.error('[api] Error fetching projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/v1/projects/:id — Single project detail. */
router.get('/:id', (req, res) => {
  try {
    const project = getProjectById(parseInt(req.params.id, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    console.error('[api] Error fetching project:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/v1/projects/:id/history — Latency/status history (for charts). */
router.get('/:id/history', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const hours = parseInt(req.query.hours, 10) || 24;
    const project = getProjectById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const history = getProjectHistory(id, hours);
    res.json({
      project: { id: project.id, name: project.name },
      hours,
      data: history.map(row => ({
        status: row.status,
        latencyMs: row.latency_ms,
        checkedAt: row.checked_at
      }))
    });
  } catch (err) {
    console.error('[api] Error fetching history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
