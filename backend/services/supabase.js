// backend/services/supabase.js
// All database interactions live here — import this in routes

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ──────────────────────────────────────────────────────────────
// CACHE
// ──────────────────────────────────────────────────────────────

function makeCacheKey(query, platforms) {
  const normalized = query.trim().toLowerCase();
  const sortedPlats = [...platforms].sort().join(",");
  return crypto
    .createHash("md5")
    .update(`${normalized}::${sortedPlats}`)
    .digest("hex");
}

async function getCachedResults(query, platforms) {
  if (!supabase) return null;
  const key = makeCacheKey(query, platforms);

  const { data, error } = await supabase
    .from("result_cache")
    .select("id, results, hit_count")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) return null;

  // Bump hit count (fire and forget)
  supabase
    .from("result_cache")
    .update({ hit_count: (data.hit_count || 0) + 1 })
    .eq("id", data.id)
    .then(() => {});

  return data.results;
}

async function setCachedResults(query, platforms, results) {
  if (!supabase) return;
  const key = makeCacheKey(query, platforms);
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("result_cache").upsert(
    {
      cache_key:  key,
      query:      query.trim().toLowerCase(),
      platforms,
      results,
      hit_count:  1,
      cached_at:  new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: "cache_key" }
  );

  if (error) console.error("Cache write error:", error.message);
}

// ──────────────────────────────────────────────────────────────
// SEARCH HISTORY
// ──────────────────────────────────────────────────────────────

async function logSearch(userId, query, platforms, resultCount) {
  if (!supabase) return;
  const { error } = await supabase.from("search_history").insert({
    user_id:      userId || null,
    query:        query.trim().toLowerCase(),
    platforms,
    result_count: resultCount,
  });
  if (error) console.error("Search log error:", error.message);
}

async function getUserSearchHistory(userId, limit = 20) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("search_history")
    .select("id, query, platforms, result_count, searched_at")
    .eq("user_id", userId)
    .order("searched_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data;
}

// ──────────────────────────────────────────────────────────────
// WISHLISTS
// ──────────────────────────────────────────────────────────────

async function getUserWishlists(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("wishlists")
    .select("id, name, created_at, wishlist_items(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

async function createWishlist(userId, name = "My Wishlist") {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("wishlists")
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function addToWishlist(userId, wishlistId, product) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({
      wishlist_id: wishlistId,
      user_id:     userId,
      platform:    product.platform,
      title:       product.title,
      price:       product.price,
      image:       product.image || null,
      product_url: product.url || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function removeFromWishlist(userId, itemId) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

async function getWishlistItems(userId, wishlistId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("wishlist_id", wishlistId)
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  if (error) return [];
  return data;
}

// ──────────────────────────────────────────────────────────────
// AUTH HELPERS (used in middleware)
// ──────────────────────────────────────────────────────────────

async function getUserFromToken(token) {
  if (!supabase) return null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

module.exports = {
  supabase,
  getCachedResults,
  setCachedResults,
  logSearch,
  getUserSearchHistory,
  getUserWishlists,
  createWishlist,
  addToWishlist,
  removeFromWishlist,
  getWishlistItems,
  getUserFromToken,
};
