// backend/middleware/auth.js
// Attach user to req.user if a valid JWT is present.
// Routes can then decide if user is required or optional.

const { getUserFromToken } = require("../services/supabase");

/**
 * Optional auth — attaches user if token present, continues either way.
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  req.user = await getUserFromToken(token);
  next();
}

/**
 * Required auth — returns 401 if no valid token.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  const user   = await getUserFromToken(token);

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = user;
  next();
}

module.exports = { optionalAuth, requireAuth };
