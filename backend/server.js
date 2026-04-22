const path = require("path");
const dotenv = require("dotenv");

const envFiles = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "../.env"),
];

for (const envPath of envFiles) {
  dotenv.config({ path: envPath, override: false });
}

const express = require("express");
const cors = require("cors");

const searchRoutes = require("./routes/search");
const wishlistRoutes = require("./routes/wishlist");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/wishlist", wishlistRoutes);

app.get("/", (req, res) => {
  res.json({ message: "PriceScout API running ✅" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
