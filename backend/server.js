require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const cookieParser = require("cookie-parser");

const searchRoutes   = require("./routes/search");
const wishlistRoutes = require("./routes/wishlist");
const authRoutes     = require("./routes/auth");
const { checkHealth } = require("./services/supabase");

const app  = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://price-compare-2i4g.vercel.app",
  "https://price-compare-sooty.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // dev: accept all — swap to cb(new Error("Not allowed")) for prod
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth",     authRoutes);
app.use("/api/search",   searchRoutes);
app.use("/api/wishlist", wishlistRoutes);

// Health check — tests Supabase table connectivity and env vars
app.get("/api/health", async (req, res) => {
  const supabaseTables = await checkHealth();
  const allTablesOk    = typeof supabaseTables === "object" && !supabaseTables.error
    && Object.values(supabaseTables).every(t => t.ok);

  res.json({
    server:   "ok",
    rapidapi: {
      ok:   !!process.env.RAPIDAPI_KEY,
      hint: process.env.RAPIDAPI_KEY ? "key set" : "RAPIDAPI_KEY missing in .env",
    },
    supabase: {
      ok:     allTablesOk,
      url:    process.env.SUPABASE_URL ? "set" : "SUPABASE_URL missing in .env",
      tables: supabaseTables,
    },
  });
});

app.get("/", (req, res) => {
  res.json({ message: "PriceScout API running ✅" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
