// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:5000/api";

const PLATFORM_META = {
  amazon:          { label: "Amazon",          icon: "🛒" },
  flipkart:        { label: "Flipkart",        icon: "🛍️" },
  ebay:            { label: "eBay",            icon: "🏷️" },
  google_shopping: { label: "Google Shopping", icon: "🔍" },
};

const ALL_PLATFORMS = Object.keys(PLATFORM_META);

// ── State ────────────────────────────────────────────────────────────────────
let state = {
  query:     "",
  results:   {},
  activeTab: "all",
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const searchForm   = document.getElementById("searchForm");
const queryInput   = document.getElementById("queryInput");
const searchBtn    = document.getElementById("searchBtn");
const btnText      = searchBtn.querySelector(".btn-text");
const btnLoader    = searchBtn.querySelector(".btn-loader");
const stepResults  = document.getElementById("step-results");
const resultsQuery = document.getElementById("resultsQuery");
const tabs         = document.getElementById("tabs");
const cardsGrid    = document.getElementById("cardsGrid");
const bestDeal     = document.getElementById("bestDeal");
const bestDealText = document.getElementById("bestDealText");
const resetBtn     = document.getElementById("resetBtn");
const errorToast   = document.getElementById("errorToast");

// ── Search — searches ALL platforms automatically ─────────────────────────────
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = queryInput.value.trim();
  if (!q) return;
  state.query = q;

  hideSection(stepResults);
  await runComparison();
});

function setSearchLoading(loading) {
  btnText.classList.toggle("hidden", loading);
  btnLoader.classList.toggle("hidden", !loading);
  searchBtn.disabled = loading;
}

// ── Comparison ────────────────────────────────────────────────────────────────
async function runComparison() {
  setSearchLoading(true);

  try {
    const res = await fetch(`${API_BASE}/search`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query:     state.query,
        platforms: ALL_PLATFORMS,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${res.status}`);
    }
    const data = await res.json();
    state.results = data.results || {};

    renderResults();
    showSection(stepResults);
  } catch (err) {
    showError("Failed to fetch results. Is the backend server running?");
    console.error(err);
  } finally {
    setSearchLoading(false);
  }
}

// ── Results ───────────────────────────────────────────────────────────────────
function renderResults() {
  state.activeTab = "all";
  resultsQuery.textContent = `"${state.query}"`;
  renderTabs();
  renderCards("all");
  renderBestDeal();
}

function renderTabs() {
  tabs.innerHTML = "";
  const platforms = Object.keys(state.results);

  const allBtn = makeTabBtn("all", "All");
  tabs.appendChild(allBtn);

  platforms.forEach((p) => {
    const meta  = PLATFORM_META[p] || { label: p, icon: "" };
    const count = (state.results[p] || []).length;
    const btn   = makeTabBtn(p, `${meta.icon} ${meta.label} (${count})`);
    tabs.appendChild(btn);
  });
}

function makeTabBtn(key, label) {
  const btn = document.createElement("button");
  btn.className = `tab-btn ${key === state.activeTab ? "active" : ""}`;
  btn.textContent = label;
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.activeTab = key;
    renderCards(key);
  });
  return btn;
}

function renderCards(platformKey) {
  cardsGrid.innerHTML = "";

  let items = [];
  if (platformKey === "all") {
    Object.entries(state.results).forEach(([p, products]) => {
      products.forEach(prod => items.push({ ...prod, _platform: p }));
    });
  } else {
    items = (state.results[platformKey] || []).map(prod => ({
      ...prod, _platform: platformKey,
    }));
  }

  if (items.length === 0) {
    cardsGrid.innerHTML = `<div class="no-results">No results found.</div>`;
    return;
  }

  items.forEach((item, i) => {
    const card = buildCard(item, i);
    cardsGrid.appendChild(card);
  });

  // Attach wishlist buttons after cards render (defined in auth.js)
  if (typeof attachWishlistButtons === "function") attachWishlistButtons();
}

function buildCard(item, index) {
  const card = document.createElement("div");
  card.className = "card";
  card.style.animationDelay = `${index * 40}ms`;

  const imgEl = item.image
    ? `<img class="card-img" src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'card-img-placeholder\\'>🖼️</div>'" />`
    : `<div class="card-img-placeholder">🖼️</div>`;

  const meta   = PLATFORM_META[item._platform] || { label: item.platform || item._platform };
  const badge  = item.badge         ? `<span class="card-badge">${escapeHtml(item.badge)}</span>` : "";
  const orig   = item.originalPrice ? `<span class="card-orig">${escapeHtml(item.originalPrice)}</span>` : "";
  const rating = item.rating        ? `<div class="card-rating">⭐ ${item.rating}</div>` : "";

  card.innerHTML = `
    ${imgEl}
    <div class="card-body">
      <div class="card-platform">${escapeHtml(meta.label)}</div>
      <div class="card-title">${escapeHtml(item.title || "—")}</div>
      <div class="card-price-row">
        <span class="card-price">${escapeHtml(item.price || "N/A")}</span>
        ${orig}
      </div>
      ${rating}
      ${badge}
      ${item.url ? `<a class="card-link" href="${item.url}" target="_blank" rel="noopener">View on ${escapeHtml(meta.label)} ↗</a>` : ""}
    </div>
  `;
  return card;
}

function renderBestDeal() {
  let best    = null;
  let bestVal = Infinity;

  Object.entries(state.results).forEach(([platform, products]) => {
    products.forEach((p) => {
      const num = parsePrice(p.price);
      if (num && num < bestVal) {
        bestVal = num;
        best = { ...p, _platform: platform };
      }
    });
  });

  if (best) {
    bestDeal.classList.remove("hidden");
    const meta = PLATFORM_META[best._platform] || { label: best._platform };
    bestDealText.innerHTML = `
      <strong>${escapeHtml(best.title || "Unknown product")}</strong> at
      <strong>${escapeHtml(best.price)}</strong> on ${escapeHtml(meta.label)}
    `;
  } else {
    bestDeal.classList.add("hidden");
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────
resetBtn.addEventListener("click", () => {
  queryInput.value = "";
  state.query   = "";
  state.results = {};
  hideSection(stepResults);
  queryInput.focus();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function showSection(el) { el.classList.remove("hidden"); }
function hideSection(el) { el.classList.add("hidden"); }

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const match = priceStr.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

let errorTimer;
function showError(msg) {
  errorToast.textContent = msg;
  errorToast.classList.remove("hidden");
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => errorToast.classList.add("hidden"), 4000);
}
