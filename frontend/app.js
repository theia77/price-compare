// ── Config ───────────────────────────────────────────────
const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:5000/api"
  : "https://price-compare-iloj.onrender.com/api";

const PLATFORM_META = {
  amazon:          { label: "Amazon",          icon: "🛒" },
  flipkart:        { label: "Flipkart",        icon: "🛍️" },
  ebay:            { label: "eBay",            icon: "🏷️" },
  google_shopping: { label: "Google Shopping", icon: "🔍" },
};

const ALL_PLATFORMS = Object.keys(PLATFORM_META);

// ── State ─────────────────────────────────────────────────
let state = {
  query:     "",
  results:   {},
  activeTab: "all",
  sortOrder: "default",
};

// ── DOM refs ──────────────────────────────────────────────
const searchForm   = document.getElementById("searchForm");
const queryInput   = document.getElementById("queryInput");
const searchBtn    = document.getElementById("searchBtn");
const btnText      = searchBtn.querySelector(".btn-text");
const btnLoader    = searchBtn.querySelector(".btn-loader");
const stepResults  = document.getElementById("step-results");
const resultsQuery = document.getElementById("resultsQuery");
const resultsCount = document.getElementById("resultsCount");
const tabs         = document.getElementById("tabs");
const cardsGrid    = document.getElementById("cardsGrid");
const bestDeal     = document.getElementById("bestDeal");
const bestDealText = document.getElementById("bestDealText");
const resetBtn     = document.getElementById("resetBtn");
const sortSelect   = document.getElementById("sortSelect");
const themeToggle  = document.getElementById("themeToggle");
const errorToast   = document.getElementById("errorToast");

// ── Theme ─────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem("ps_theme") || "dark";
  document.documentElement.dataset.theme = saved;
}
initTheme();

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("ps_theme", next);
});

// ── Sort ──────────────────────────────────────────────────
sortSelect.addEventListener("change", () => {
  state.sortOrder = sortSelect.value;
  renderCards(state.activeTab);
});

function getSortedItems(items) {
  const arr = [...items];
  switch (state.sortOrder) {
    case "price-asc":
      arr.sort((a, b) => (parsePrice(a.price) ?? Infinity) - (parsePrice(b.price) ?? Infinity));
      break;
    case "price-desc":
      arr.sort((a, b) => (parsePrice(b.price) ?? 0) - (parsePrice(a.price) ?? 0));
      break;
    case "rating":
      arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
  }
  return arr;
}

// ── Skeleton loading ──────────────────────────────────────
function showSkeletons() {
  showSection(stepResults);
  stepResults.scrollIntoView({ behavior: "smooth", block: "start" });
  cardsGrid.innerHTML = Array(8).fill(0).map(() => `
    <div class="card skel-card">
      <div class="skel-img-area"></div>
      <div class="skel-body">
        <div class="skel-line" style="height:11px;width:38%"></div>
        <div class="skel-line" style="height:13px;width:92%"></div>
        <div class="skel-line" style="height:12px;width:70%"></div>
        <div class="skel-line" style="height:22px;width:48%;margin-top:4px"></div>
        <div class="skel-line" style="height:38px;width:100%;border-radius:10px;margin-top:4px"></div>
      </div>
    </div>
  `).join("");
}

// ── Search submit ─────────────────────────────────────────
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = queryInput.value.trim();
  if (!q) return;
  state.query     = q;
  state.sortOrder = "default";
  sortSelect.value = "default";
  await runComparison();
});

function setSearchLoading(on) {
  btnText.classList.toggle("hidden", on);
  btnLoader.classList.toggle("hidden", !on);
  searchBtn.disabled = on;
}

// ── Comparison ────────────────────────────────────────────
async function runComparison() {
  setSearchLoading(true);
  showSkeletons();

  try {
    const res = await fetch(`${API_BASE}/search`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        ...(typeof authHeaders === "function" ? authHeaders() : {}),
      },
      body: JSON.stringify({ query: state.query, platforms: ALL_PLATFORMS }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${res.status}`);
    }

    const data    = await res.json();
    state.results = data.results || {};

    renderResults();
  } catch (err) {
    hideSection(stepResults);
    showError("Failed to fetch results. Is the backend server running?");
    console.error(err);
  } finally {
    setSearchLoading(false);
  }
}

// ── Results ───────────────────────────────────────────────
function renderResults() {
  state.activeTab = "all";
  resultsQuery.textContent = `"${state.query}"`;

  const total = Object.values(state.results).reduce((s, a) => s + a.length, 0);
  resultsCount.textContent = `${total} results across ${Object.keys(state.results).length} platforms`;

  renderTabs();
  renderCards("all");
  renderBestDeal();
}

function renderTabs() {
  tabs.innerHTML = "";
  tabs.appendChild(makeTabBtn("all", "✦ All"));
  Object.keys(state.results).forEach((p) => {
    const meta  = PLATFORM_META[p] || { label: p, icon: "" };
    const count = (state.results[p] || []).length;
    tabs.appendChild(makeTabBtn(p, `${meta.icon} ${meta.label} (${count})`));
  });
}

function makeTabBtn(key, label) {
  const btn = document.createElement("button");
  btn.className = `tab-btn${key === state.activeTab ? " active" : ""}`;
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
    items = (state.results[platformKey] || []).map(prod => ({ ...prod, _platform: platformKey }));
  }

  items = getSortedItems(items);

  if (items.length === 0) {
    cardsGrid.innerHTML = `
      <div class="no-results">
        <span class="no-results-icon">🔍</span>
        <h3>No results found</h3>
        <p>Try a different search term or broaden your filters.</p>
      </div>`;
    return;
  }

  items.forEach((item, i) => cardsGrid.appendChild(buildCard(item, i)));

  observeCards();
  if (typeof attachWishlistButtons === "function") attachWishlistButtons();
}

// ── Scroll reveal (IntersectionObserver) ──────────────────
let _cardObserver;

(function initObserver() {
  if (!window.IntersectionObserver) return;
  _cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        _cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06 });
})();

function observeCards() {
  if (!_cardObserver) {
    // Fallback: reveal all immediately
    document.querySelectorAll(".card:not(.skel-card)").forEach(c => c.classList.add("revealed"));
    return;
  }
  document.querySelectorAll(".card:not(.skel-card):not(.revealed)").forEach((card, i) => {
    card.style.animationDelay = `${i * 48}ms`;
    _cardObserver.observe(card);
  });
}

// ── Card builder ──────────────────────────────────────────
function buildCard(item) {
  const card = document.createElement("div");
  card.className = "card";

  const meta   = PLATFORM_META[item._platform] || { label: item.platform || item._platform, icon: "" };
  const badge  = item.badge         ? `<span class="card-badge">${escapeHtml(item.badge)}</span>`             : "";
  const orig   = item.originalPrice ? `<span class="card-orig">${escapeHtml(item.originalPrice)}</span>`      : "";
  const rating = item.rating        ? `<span class="card-rating">⭐ ${item.rating}</span>`                    : "";
  const hasMeta = rating || badge;

  const imgHtml = item.image
    ? `<img class="card-img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy"
         onerror="this.parentNode.innerHTML='<div class=\\'card-img-placeholder\\'>🖼️</div>'">`
    : `<div class="card-img-placeholder">🖼️</div>`;

  const linkHtml = item.url
    ? `<a class="card-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
         View Deal
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
       </a>`
    : "";

  card.innerHTML = `
    <div class="card-img-wrap">
      ${imgHtml}
      <span class="card-platform-tag">${escapeHtml(meta.label)}</span>
      <span class="card-platform" aria-hidden="true">${escapeHtml(meta.label)}</span>
    </div>
    <div class="card-body">
      <div class="card-title">${escapeHtml(item.title || "—")}</div>
      ${hasMeta ? `<div class="card-meta">${rating}${badge}</div>` : ""}
      <div class="card-price-row">
        <span class="card-price">${escapeHtml(item.price || "N/A")}</span>
        ${orig}
      </div>
      ${linkHtml}
    </div>`;

  return card;
}

// ── Best deal banner ──────────────────────────────────────
function renderBestDeal() {
  let best    = null;
  let bestVal = Infinity;

  Object.entries(state.results).forEach(([platform, products]) => {
    products.forEach((p) => {
      const num = parsePrice(p.price);
      if (num && num < bestVal) { bestVal = num; best = { ...p, _platform: platform }; }
    });
  });

  if (best) {
    bestDeal.classList.remove("hidden");
    const meta = PLATFORM_META[best._platform] || { label: best._platform };
    bestDealText.innerHTML = `<strong>${escapeHtml(best.title || "Unknown product")}</strong> at <strong>${escapeHtml(best.price)}</strong> on ${escapeHtml(meta.label)}`;
  } else {
    bestDeal.classList.add("hidden");
  }
}

// ── Reset ─────────────────────────────────────────────────
resetBtn.addEventListener("click", () => {
  queryInput.value = "";
  state.query   = "";
  state.results = {};
  hideSection(stepResults);
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => queryInput.focus(), 400);
});

// ── Helpers ───────────────────────────────────────────────
function showSection(el) { el.classList.remove("hidden"); }
function hideSection(el) { el.classList.add("hidden"); }

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const m = String(priceStr).replace(/,/g, "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

let _errTimer;
function showError(msg) {
  errorToast.textContent = msg;
  errorToast.classList.remove("hidden");
  clearTimeout(_errTimer);
  _errTimer = setTimeout(() => errorToast.classList.add("hidden"), 4500);
}
