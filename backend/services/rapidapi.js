const axios = require("axios");

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "real-time-product-search.p.rapidapi.com";
let warnedMissingKey = false;

const availablePlatforms = ["amazon", "flipkart", "google"];

function rapidHeaders(host = RAPIDAPI_HOST) {
  return {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": host,
  };
}

function pickImage(raw = {}) {
  return (
    raw.product_photo ||
    raw.thumbnail ||
    raw.image ||
    raw.image_url ||
    raw.productImage ||
    null
  );
}

function pickTitle(raw = {}) {
  return raw.product_title || raw.title || raw.name || "Untitled product";
}

function pickPrice(raw = {}) {
  return (
    raw.offer?.price ||
    raw.offer?.displayPrice ||
    raw.product_price ||
    raw.price ||
    raw.current_price ||
    raw.sale_price ||
    "N/A"
  );
}

function pickOriginalPrice(raw = {}) {
  return raw.typical_price || raw.original_price || raw.mrp || raw.strike_price || null;
}

function pickRating(raw = {}) {
  return raw.product_star_rating || raw.rating || raw.stars || null;
}

function pickUrl(raw = {}) {
  return raw.product_url || raw.url || raw.link || raw.product_link || null;
}

function normalizeProduct(raw, platform) {
  return {
    platform,
    title: pickTitle(raw),
    price: pickPrice(raw),
    originalPrice: pickOriginalPrice(raw),
    image: pickImage(raw),
    rating: pickRating(raw),
    badge: raw.offer?.store_name || raw.store || raw.badge || null,
    url: pickUrl(raw),
  };
}

async function searchOnRealTimeProductAPI(query, platform) {
  if (!RAPIDAPI_KEY) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn("RAPIDAPI_KEY is missing; search results will be empty.");
    }
    return [];
  }

  const { data } = await axios.get("https://real-time-product-search.p.rapidapi.com/search", {
    params: {
      q: query,
      country: "in",
      language: "en",
      page: "1",
      limit: "12",
      sort_by: "BEST_MATCH",
      product_condition: "ANY",
      platform,
    },
    headers: rapidHeaders("real-time-product-search.p.rapidapi.com"),
    timeout: 15000,
  });

  const items = data?.data?.products || data?.data || [];
  if (!Array.isArray(items)) return [];
  return items.map((p) => normalizeProduct(p, platform)).filter((p) => p.title && p.price);
}

async function searchOnHost(query, platform) {
  if (!RAPIDAPI_KEY) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn("RAPIDAPI_KEY is missing; search results will be empty.");
    }
    return [];
  }

  const { data } = await axios.get(`https://${RAPIDAPI_HOST}/search`, {
    params: { q: query, platform, limit: 12 },
    headers: rapidHeaders(),
    timeout: 15000,
  });

  const items =
    data?.data?.products ||
    data?.data?.items ||
    data?.products ||
    data?.items ||
    data?.results ||
    [];
  if (!Array.isArray(items)) return [];
  return items.map((p) => normalizeProduct(p, platform)).filter((p) => p.title);
}

async function searchPlatform(query, platform) {
  try {
    const products = await searchOnRealTimeProductAPI(query, platform);
    if (products.length > 0) return products;
  } catch (error) {
    console.warn(`RapidAPI real-time search failed for ${platform}: ${error.message}`);
  }

  try {
    const products = await searchOnHost(query, platform);
    if (products.length > 0) return products;
  } catch (error) {
    console.warn(`RapidAPI host search failed for ${platform}: ${error.message}`);
  }

  return [];
}

async function searchPlatforms(query, platforms = []) {
  const selected = Array.isArray(platforms) ? platforms : [];
  const validPlatforms = selected.filter((p) => availablePlatforms.includes(p));

  const pairs = await Promise.all(
    validPlatforms.map(async (platform) => [platform, await searchPlatform(query, platform)])
  );

  return Object.fromEntries(pairs);
}

module.exports = {
  availablePlatforms,
  searchPlatforms,
};
