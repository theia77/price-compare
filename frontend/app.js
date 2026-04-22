// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:5000/api";

// Platform display metadata (icon + label for chips)
const PLATFORM_META = {
  amazon:   { label: "Amazon",   icon: "🛒" },
  flipkart: { label: "Flipkart", icon: "🛍️" },
  google:   { label: "Google",   icon: "🔎" },
  // Add more here as you add APIs in the backend
};

// ── State ────────────────────────────────────────────────────────────────────
let state = {
  query: "",
  availablePlatforms: [],
  selectedPlatforms: new Set(),
  results: {},          // { amazon: [...], flipkart: [...] }
  activeTab: "all",
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const searchForm      = document.getElementById("searchForm");
const queryInput      = document.getElementById("queryInput");
const searchBtn       = document.getElementById("searchBtn");
const btnText         = searchBtn.querySelector(".btn-text");
const btnLoader       = searchBtn.querySelector(".btn-loader");
const stepPlatforms   = document.getElementById("step-platforms");
const platformGrid    = document.getElementById("platformGrid");
const compareBtn      = document.getElementById("compareBtn");
const stepResults     = document.getElementById("step-results");
const resultsQuery    = document.getElementById("resultsQuery");
const tabs            = document.getElementById("tabs");
const cardsGrid       = document.getElementById("cardsGrid");
const bestDeal        = document.getElementById("bestDeal");
const bestDealText    = document.getElementById("bestDealText");
const resetBtn        = document.getElementById("resetBtn");
const errorToast      = document.getElementById("errorToast");

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res  = await fetch(`${API_BASE}/search/platforms`);
    const data = await res.json();
    state.availablePlatforms = data.platforms || [];
  } catch {
    // If backend isn't reachable yet, fall back to defaults
    state.availablePlatforms = ["amazon", "flipkart", "google"];
  }
}
init();

// ── STEP 1: Search ────────────────────────────────────────────────────────────
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = queryInput.value.trim();
  if (!q) return;
  state.query = q;

  setSearchLoading(true);
  hideSection(stepPlatforms);
  hideSection(stepResults);

  // Just render the platform picker — no pre-search needed
  // (search happens after platform selection)
  renderPlatformPicker();
  showSection(stepPlatforms);
  setSearchLoading(false);
});

function setSearchLoading(loading) {
  btnText.classList.toggle("hidden", loading);
  btnLoader.classList.toggle("hidden", !loading);
  searchBtn.disabled = loading;
}

// ── STEP 2: Platform picker ───────────────────────────────────────────────────
function renderPlatformPicker() {
  platformGrid.innerHTML = "";
  state.selectedPlatforms.clear();

  state.availablePlatforms.forEach((key) => {
    const meta   = PLATFORM_META[key] || { label: key, icon: "🔗" };
    const chip   = document.createElement("label");
    chip.className = "platform-chip";
    chip.dataset.key = key;
    chip.innerHTML = `
      <input type="checkbox" value="${key}" />
      <span class="chip-icon">${meta.icon}</span>
      <span class="chip-label">${meta.label}</span>
    `;
    const input = chip.querySelector("input");
    input.addEventListener("change", (e) => {
      if (e.target.checked) {
        state.selectedPlatforms.add(key);
        chip.classList.add("selected");
      } else {
        state.selectedPlatforms.delete(key);
        chip.classList.remove("selected");
      }
    });
    platformGrid.appendChild(chip);
  });
}

compareBtn.addEventListener("click", async () => {
  if (state.selectedPlatforms.size === 0) {
    showError("Please select at least one platform.");
    return;
  }
  await runComparison();
});

// ── STEP 3: Comparison ────────────────────────────────────────────────────────
async function runComparison() {
  compareBtn.textContent = "Fetching prices…";
  compareBtn.disabled = true;

  try {
    const res  = await fetch(`${API_BASE}/search`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query:     state.query,
        platforms: [...state.selectedPlatforms],
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    state.results = data.results || {};

    hideSection(stepPlatforms);
    renderResults();
    showSection(stepResults);
  } catch (err) {
    showError("Failed to fetch results. Is the server running?");
    console.error(err);
  } finally {
    compareBtn.textContent = "Compare Prices →";
    compareBtn.disabled = false;
  }
}

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

  // "All" tab
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
    cardsGrid.innerHTML = `<div class="no-results">No results found for this selection.</div>`;
    return;
  }

  items.forEach((item, i) => {
    const card = buildCard(item, i);
    cardsGrid.appendChild(card);
  });
}

function buildCard(item, index) {
  const card = document.createElement("div");
  card.className = "card";
  card.style.animationDelay = `${index * 40}ms`;

  const imgEl = item.image
    ? `<img class="card-img" src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\'card-img-placeholder\'>🖼️</div>'" />`
    : `<div class="card-img-placeholder">🖼️</div>`;

  const meta  = PLATFORM_META[item._platform] || { label: item.platform };
  const badge = item.badge ? `<span class="card-badge">${escapeHtml(item.badge)}</span>` : "";
  const orig  = item.originalPrice ? `<span class="card-orig">${escapeHtml(item.originalPrice)}</span>` : "";
  const rating = item.rating ? `<div class="card-rating">⭐ ${item.rating}</div>` : "";

  card.innerHTML = `
    ${imgEl}
    <div class="card-body">
      <div class="card-platform">${meta.label}</div>
      <div class="card-title">${escapeHtml(item.title || "—")}</div>
      <div class="card-price-row">
        <span class="card-price">${escapeHtml(item.price || "N/A")}</span>
        ${orig}
      </div>
      ${rating}
      ${badge}
      ${item.url ? `<a class="card-link" href="${item.url}" target="_blank" rel="noopener">View on ${meta.label} ↗</a>` : ""}
    </div>
  `;
  return card;
}

function renderBestDeal() {
  // Find the cheapest item across all results by stripping non-numeric chars
  let best = null;
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
      <strong>${escapeHtml(best.price)}</strong> on ${meta.label}
    `;
  } else {
    bestDeal.classList.add("hidden");
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────
resetBtn.addEventListener("click", () => {
  queryInput.value = "";
  state.query = "";
  state.results = {};
  state.selectedPlatforms.clear();
  hideSection(stepPlatforms);
  hideSection(stepResults);
  queryInput.focus();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function showSection(el)  { el.classList.remove("hidden"); }
function hideSection(el)  { el.classList.add("hidden"); }

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
