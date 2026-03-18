/**
 * middleware/auth.js — JWT authentication middleware.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-random-string';

/**
 * Middleware that verifies JWT and attaches user to req.user.
 * If no token, req.user is set to a guest.
 */
function authOptional(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = { id: 0, username: 'guest', role: 'guest' };
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    req.user = { id: 0, username: 'guest', role: 'guest' };
  }

  next();
}

/**
 * Middleware that requires authentication.
 * Returns 401 if no valid token.
 */
function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Middleware factory that requires a specific role.
 * @param  {...string} roles - Allowed roles (e.g. 'admin', 'devops')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission denied. Required role: ' + roles.join(' or ') });
    }
    next();
  };
}

module.exports = { authOptional, authRequired, requireRole };
