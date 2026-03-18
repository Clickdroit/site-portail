/**
 * db.js — SQLite database initialization and helpers.
 * Uses sql.js (pure JavaScript, no native deps).
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'portal.db');

let db = null;

/** Initialize the database: create tables and seed if needed. */
async function initDB() {
  const SQL = await initSqlJs();

  // Load existing DB file or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT DEFAULT 'web',
      description TEXT DEFAULT '',
      url         TEXT NOT NULL,
      tags        TEXT DEFAULT '[]',
      status      TEXT DEFAULT 'DOWN',
      updated_at  TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS health_checks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL,
      status      TEXT NOT NULL,
      latency_ms  INTEGER DEFAULT 0,
      checked_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_health_project
      ON health_checks(project_id, checked_at)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      username  TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      role      TEXT DEFAULT 'guest'
    )
  `);

  seedProjects();
  seedDefaultAdmin();
  saveDB();

  return db;
}

/** Persist DB to disk. */
function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/** Seed projects from data/projects.json if the table is empty. */
function seedProjects() {
  const rows = db.exec('SELECT COUNT(*) as c FROM projects');
  const count = rows[0]?.values[0]?.[0] || 0;
  if (count > 0) return;

  const jsonPath = path.join(__dirname, '..', 'data', 'projects.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn('[db] data/projects.json not found, skipping seed.');
    return;
  }

  const projects = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO projects (id, name, type, description, url, tags, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const p of projects) {
    stmt.run([
      p.id,
      p.name,
      p.type || 'web',
      p.description || '',
      p.url,
      JSON.stringify(p.tags || []),
      p.status || 'DOWN',
      p.updatedAt || ''
    ]);
  }

  stmt.free();
  console.log(`[db] Seeded ${projects.length} projects from projects.json.`);
}

/** Create default admin user if none exists. */
function seedDefaultAdmin() {
  const bcrypt = require('bcryptjs');
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin';

  const rows = db.exec("SELECT COUNT(*) as c FROM users WHERE role = 'admin'");
  const exists = rows[0]?.values[0]?.[0] || 0;
  if (exists > 0) return;

  const hash = bcrypt.hashSync(adminPass, 10);
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [adminUser, hash, 'admin']);
  console.log(`[db] Default admin user "${adminUser}" created.`);
}

/** Get the database instance. */
function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

// ── Query helpers ──────────────────────────────────────────

/** Run a SELECT query and return rows as objects. */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** Run a SELECT query and return the first row as object, or null. */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function getAllProjects() {
  const rows = queryAll('SELECT * FROM projects ORDER BY id');
  return rows.map(formatProject);
}

function getProjectById(id) {
  const row = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
  return row ? formatProject(row) : null;
}

function updateProjectStatus(projectId, status, latencyMs) {
  db.run('UPDATE projects SET status = ? WHERE id = ?', [status, projectId]);
  db.run(
    "INSERT INTO health_checks (project_id, status, latency_ms, checked_at) VALUES (?, ?, ?, datetime('now'))",
    [projectId, status, latencyMs]
  );
  saveDB();
}

function getProjectHistory(projectId, hours = 24) {
  return queryAll(
    `SELECT status, latency_ms, checked_at
     FROM health_checks
     WHERE project_id = ?
       AND checked_at >= datetime('now', ? || ' hours')
     ORDER BY checked_at ASC`,
    [projectId, -hours]
  );
}

function getGlobalMetrics() {
  const projects = queryAll('SELECT * FROM projects');
  const totalProjects = projects.length;
  const upCount = projects.filter(p => p.status === 'UP').length;
  const uptimePercent = totalProjects > 0 ? ((upCount / totalProjects) * 100) : 0;

  const latencyRow = queryOne(
    `SELECT AVG(latency_ms) as avg_latency, COUNT(*) as total_checks
     FROM health_checks
     WHERE checked_at >= datetime('now', '-1 hour')`
  );

  return {
    uptime: uptimePercent,
    latency: Math.round(latencyRow?.avg_latency || 0),
    requestsPerMin: Math.round((latencyRow?.total_checks || 0) / 60),
    totalProjects,
    upCount
  };
}

function getUserByUsername(username) {
  return queryOne('SELECT * FROM users WHERE username = ?', [username]);
}

/** Format a raw DB row into the API shape. */
function formatProject(row) {
  let tags = [];
  try {
    tags = JSON.parse(row.tags || '[]');
  } catch {
    tags = [];
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    url: row.url,
    tags,
    status: row.status,
    updatedAt: row.updated_at
  };
}

module.exports = {
  initDB,
  getDB,
  saveDB,
  getAllProjects,
  getProjectById,
  updateProjectStatus,
  getProjectHistory,
  getGlobalMetrics,
  getUserByUsername
};
