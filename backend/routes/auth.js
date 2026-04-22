// backend/routes/auth.js
// Thin wrapper around Supabase Auth — the frontend can also call Supabase directly,
// but proxying through the backend keeps your Supabase URL hidden from the client.

const express  = require("express");
const router   = express.Router();
const { supabase } = require("../services/supabase");

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || "" } },
  });

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ user: data.user, session: data.session });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  await supabase.auth.signOut();
  res.json({ success: true });
});

// GET /api/auth/me  — returns current user from token
router.get("/me", async (req, res) => {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid token" });
  res.json({ user: data.user });
});

module.exports = router;
