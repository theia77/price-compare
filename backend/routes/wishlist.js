// backend/routes/wishlist.js
const express = require("express");
const router  = express.Router();
const { requireAuth } = require("../middleware/auth");
const {
  getUserWishlists,
  createWishlist,
  addToWishlist,
  removeFromWishlist,
  getWishlistItems,
} = require("../services/supabase");

// All wishlist routes require auth
router.use(requireAuth);

// GET /api/wishlist — list all wishlists
router.get("/", async (req, res) => {
  const lists = await getUserWishlists(req.user.id);
  res.json({ wishlists: lists });
});

// POST /api/wishlist — create a wishlist
router.post("/", async (req, res) => {
  const { name } = req.body;
  try {
    const list = await createWishlist(req.user.id, name);
    res.status(201).json({ wishlist: list });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/wishlist/:id/items — get items in a wishlist
router.get("/:id/items", async (req, res) => {
  const items = await getWishlistItems(req.user.id, req.params.id);
  res.json({ items });
});

// POST /api/wishlist/:id/items — add a product to wishlist
// Body: { platform, title, price, image, url }
router.post("/:id/items", async (req, res) => {
  try {
    const item = await addToWishlist(req.user.id, req.params.id, req.body);
    res.status(201).json({ item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/wishlist/items/:itemId — remove an item
router.delete("/items/:itemId", async (req, res) => {
  try {
    await removeFromWishlist(req.user.id, req.params.itemId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
