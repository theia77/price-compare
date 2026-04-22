// backend/routes/auth.js
const express  = require("express");
const router   = express.Router();
const crypto   = require("crypto");
const { supabase } = require("../services/supabase");

// ── PKCE helpers ─────────────────────────────────────────────────────────────
function generatePKCE() {
  const verifier  = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// GET /api/auth/google — redirect browser to Google via Supabase OAuth (PKCE)
router.get("/google", (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Auth service not configured" });

  const { verifier, challenge } = generatePKCE();

  res.cookie("pkce_verifier", verifier, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   10 * 60 * 1000,
  });

  const callbackUrl = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  const authUrl     = new URL(`${process.env.SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set("provider",              "google");
  authUrl.searchParams.set("redirect_to",           callbackUrl);
  authUrl.searchParams.set("code_challenge",        challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  res.redirect(authUrl.toString());
});

// GET /api/auth/google/callback — exchange code, redirect frontend with token
router.get("/google/callback", async (req, res) => {
  const { code }    = req.query;
  const verifier    = req.cookies?.pkce_verifier;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  res.clearCookie("pkce_verifier");

  if (!code || !verifier) {
    return res.redirect(`${frontendUrl}?auth_error=missing_params`);
  }

  try {
    const tokenRes = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`,
      {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey":       process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      }
    );

    const session = await tokenRes.json();
    if (!tokenRes.ok || !session.access_token) {
      throw new Error(session.error_description || "Token exchange failed");
    }

    res.redirect(
      `${frontendUrl}#access_token=${session.access_token}&token_type=bearer`
    );
  } catch (err) {
    console.error("Google callback error:", err.message);
    res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(err.message)}`);
  }
});

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Auth service not configured" });
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
  if (!supabase) return res.status(503).json({ error: "Auth service not configured" });
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
  if (!supabase) return res.json({ success: true });

  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) {
      await supabase.auth.admin.signOut(data.user.id);
    }
  }

  res.json({ success: true });
});

// GET /api/auth/me  — returns current user from token
router.get("/me", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Auth service not configured" });
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid token" });
  res.json({ user: data.user });
});

module.exports = router;
