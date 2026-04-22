// backend/routes/search.js
const express = require("express");
const router  = express.Router();

const { searchPlatforms, availablePlatforms } = require("../services/rapidapi");
const {
  getCachedResults,
  setCachedResults,
  logSearch,
  getUserSearchHistory,
} = require("../services/supabase");
const { optionalAuth, requireAuth } = require("../middleware/auth");

// GET /api/search/platforms
router.get("/platforms", (req, res) => {
  res.json({ platforms: availablePlatforms });
});

// GET /api/search/history  — requires login
router.get("/history", requireAuth, async (req, res) => {
  const history = await getUserSearchHistory(req.user.id);
  res.json({ history });
});

// POST /api/search
// Body: { query, platforms }
// Auth: optional — logged-in users get history saved
router.post("/", optionalAuth, async (req, res) => {
  const { query, platforms } = req.body;

  if (!query?.trim()) {
    return res.status(400).json({ error: "query is required" });
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: "at least one platform is required" });
  }

  try {
    // 1. Try cache first
    const cached = await getCachedResults(query, platforms);
    if (cached) {
      logSearch(req.user?.id, query, platforms, countResults(cached));
      return res.json({ query, results: cached, fromCache: true });
    }

    // 2. Hit RapidAPI
    const results = await searchPlatforms(query.trim(), platforms);

    // 3. Save to cache + history (parallel, non-blocking)
    Promise.all([
      setCachedResults(query, platforms, results),
      logSearch(req.user?.id, query, platforms, countResults(results)),
    ]).catch(console.error);

    res.json({ query, results, fromCache: false });
  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

function countResults(results) {
  return Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
}

module.exports = router;
