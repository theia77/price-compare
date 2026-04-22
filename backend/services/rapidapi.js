const axios = require("axios");

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";

if (!RAPIDAPI_KEY) {
  console.warn("WARNING: RAPIDAPI_KEY is not set — search results will be empty.");
}

// ─────────────────────────────────────────────────────────────
// AMAZON  — Real-Time Amazon Data
// host: real-time-amazon-data.p.rapidapi.com
// ─────────────────────────────────────────────────────────────
async function searchAmazon(query) {
  try {
    const response = await axios.get(
      "https://real-time-amazon-data.p.rapidapi.com/search",
      {
        params: {
          query,
          page:                "1",
          country:             "IN",
          sort_by:             "RELEVANCE",
          product_condition:   "ALL",
          is_prime:            "false",
          deals_and_discounts: "NONE",
        },
        headers: {
          "x-rapidapi-key":  RAPIDAPI_KEY,
          "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
          "Content-Type":    "application/json",
        },
      }
    );

    const products = response.data?.data?.products || [];
    return products.slice(0, 6).map((p) => ({
      platform:      "Amazon",
      title:         p.product_title          || "—",
      price:         p.product_price          || "N/A",
      originalPrice: p.product_original_price || null,
      rating:        p.product_star_rating    || null,
      image:         p.product_photo          || null,
      url:           p.product_url            || null,
      badge:         p.is_prime ? "Prime"     : null,
    }));
  } catch (err) {
    console.error("Amazon search error:", err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// FLIPKART  — Real-Time Flipkart Data 2
// host: real-time-flipkart-data2.p.rapidapi.com
// ─────────────────────────────────────────────────────────────
async function searchFlipkart(query) {
  try {
    const response = await axios.get(
      "https://real-time-flipkart-data2.p.rapidapi.com/product-search",
      {
        params: {
          q:       query,
          page:    "1",
          sort_by: "RELEVANCE",
        },
        headers: {
          "x-rapidapi-key":  RAPIDAPI_KEY,
          "x-rapidapi-host": "real-time-flipkart-data2.p.rapidapi.com",
          "Content-Type":    "application/json",
        },
      }
    );

    const products =
      response.data?.products ||
      response.data?.data?.products ||
      response.data?.result ||
      [];

    return products.slice(0, 6).map((p) => ({
      platform:      "Flipkart",
      title:         p.title         || p.name             || "—",
      price:         p.price         ? `₹${p.price}`       : (p.selling_price ? `₹${p.selling_price}` : "N/A"),
      originalPrice: p.mrp           ? `₹${p.mrp}`         : (p.original_price ? `₹${p.original_price}` : null),
      rating:        p.rating        || p.average_rating   || null,
      image:         p.image         || p.thumbnail        || p.image_url || null,
      url:           p.url           || p.product_url      || null,
      badge:         p.assured       ? "F-Assured"         : null,
    }));
  } catch (err) {
    console.error("Flipkart search error:", err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// EBAY  — Real-Time eBay Data
// host: real-time-ebay-data.p.rapidapi.com
// ─────────────────────────────────────────────────────────────
async function searchEbay(query) {
  try {
    const response = await axios.get(
      "https://real-time-ebay-data.p.rapidapi.com/ebay_search",
      {
        params: {
          q:     query,
          limit: "10",
        },
        headers: {
          "x-rapidapi-key":  RAPIDAPI_KEY,
          "x-rapidapi-host": "real-time-ebay-data.p.rapidapi.com",
          "Content-Type":    "application/json",
        },
      }
    );

    const raw = response.data?.result || response.data?.data || response.data?.items || response.data || [];
    const list = Array.isArray(raw) ? raw : [];

    return list.slice(0, 6).map((p) => ({
      platform:      "eBay",
      title:         p.title         || p.name          || "—",
      price:         p.price         || p.current_price || "N/A",
      originalPrice: p.original_price || null,
      rating:        null,
      image:         p.image         || p.thumbnail     || null,
      url:           p.url           || p.link          || null,
      badge:         p.condition     || null,
    }));
  } catch (err) {
    console.error("eBay search error:", err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// GOOGLE SHOPPING  — Real-Time Product Search v2
// host: real-time-product-search.p.rapidapi.com
// Covers: Croma, Myntra, Nykaa, AJIO, Meesho, Snapdeal,
//         JioMart, Reliance Digital + 100s more automatically
// ─────────────────────────────────────────────────────────────
async function searchGoogleShopping(query) {
  try {
    const response = await axios.get(
      "https://real-time-product-search.p.rapidapi.com/search-v2",
      {
        params: {
          q:                 query,
          country:           "in",
          language:          "en",
          page:              "1",
          limit:             "10",
          sort_by:           "BEST_MATCH",
          product_condition: "ANY",
          return_filters:    "false",
        },
        headers: {
          "x-rapidapi-key":  RAPIDAPI_KEY,
          "x-rapidapi-host": "real-time-product-search.p.rapidapi.com",
          "Content-Type":    "application/json",
        },
      }
    );

    const products =
      response.data?.data?.products ||
      response.data?.products       ||
      response.data?.results        ||
      [];

    return products.slice(0, 8).map((p) => {
      const offer     = p.offers?.[0] || {};
      const store     = offer.store_name || p.source || "Online Store";
      const price     = offer.price || p.typical_price_range?.[0] || "N/A";
      const origPrice = offer.original_price || null;

      return {
        platform:      store,
        title:         p.product_title       || p.title || "—",
        price:         typeof price === "number" ? `₹${price}` : price,
        originalPrice: origPrice ? (typeof origPrice === "number" ? `₹${origPrice}` : origPrice) : null,
        rating:        p.product_rating      || null,
        image:         p.product_photos?.[0] || p.thumbnail || null,
        url:           offer.offer_page_url  || p.product_page_url || null,
        badge:         offer.store_name      || null,
      };
    });
  } catch (err) {
    console.error("Google Shopping search error:", err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// PLATFORM REGISTRY
// ─────────────────────────────────────────────────────────────
const PLATFORMS = {
  amazon:          searchAmazon,
  flipkart:        searchFlipkart,
  ebay:            searchEbay,
  google_shopping: searchGoogleShopping,
};

async function searchPlatforms(query, platforms) {
  const valid = platforms.filter((p) => PLATFORMS[p]);

  const results = await Promise.allSettled(
    valid.map((p) => PLATFORMS[p](query))
  );

  const output = {};
  valid.forEach((p, i) => {
    output[p] = results[i].status === "fulfilled" ? results[i].value : [];
  });

  return output;
}

module.exports = {
  searchPlatforms,
  availablePlatforms: Object.keys(PLATFORMS),
};
