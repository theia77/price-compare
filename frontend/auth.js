// frontend/auth.js
// Handles login/signup UI and wishlist interactions on the frontend.
// Add <script src="auth.js"></script> after app.js in index.html
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const API = "http://localhost:5000/api";
const supabase = createClient(
  "https://ajxixspybcjegualqwak.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqeGl4c3B5YmNqZWd1YWxxd2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzM4ODAsImV4cCI6MjA5MjM0OTg4MH0.o4KDD06HrlFEquQMM5_lE22OjK9Q_Q2dorWdRYeZKUg"
);

// ── Token storage (sessionStorage keeps it tab-local) ────────────────────────
function saveToken(token) { sessionStorage.setItem("ps_token", token); }
function getToken()       { return sessionStorage.getItem("ps_token"); }
function clearToken()     { sessionStorage.removeItem("ps_token"); }

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth API calls ────────────────────────────────────────────────────────────
async function signup(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || "" } },
  });
  if (error) throw new Error(error.message);
  if (!data.session?.access_token) {
    throw new Error("Signup succeeded. Please verify your email, then log in.");
  }
  saveToken(data.session.access_token);
  return data.user;
}

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  saveToken(data.session.access_token);
  return data.user;
}

async function loginWithGoogle() {
  const redirectTo = window.location.origin + window.location.pathname;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw new Error(error.message || "Google login failed");
  if (data?.url) window.location.href = data.url;
}

async function logout() {
  await supabase.auth.signOut();
  clearToken();
  updateAuthUI(null);
}

async function getMe() {
  if (!getToken()) return null;
  const { data, error } = await supabase.auth.getUser(getToken());
  if (error || !data?.user) { clearToken(); return null; }
  return data.user;
}

// ── Wishlist API calls ────────────────────────────────────────────────────────
async function getWishlists() {
  const res  = await fetch(`${API}/wishlist`, { headers: authHeaders() });
  const data = await res.json();
  return data.wishlists || [];
}

async function createWishlist(name) {
  const res  = await fetch(`${API}/wishlist`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.wishlist;
}

async function addToWishlist(wishlistId, product) {
  const res  = await fetch(`${API}/wishlist/${wishlistId}/items`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(product),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.item;
}

async function removeFromWishlist(itemId) {
  await fetch(`${API}/wishlist/items/${itemId}`, {
    method:  "DELETE",
    headers: authHeaders(),
  });
}

async function getSearchHistory() {
  const res  = await fetch(`${API}/search/history`, { headers: authHeaders() });
  const data = await res.json();
  return data.history || [];
}

// ── UI ────────────────────────────────────────────────────────────────────────

// Inject the auth bar into the page
function injectAuthBar() {
  const bar = document.createElement("div");
  bar.id = "authBar";
  bar.style.cssText = `
    position: fixed; top: 0; right: 0;
    display: flex; align-items: center; gap: 12px;
    padding: 10px 20px; z-index: 999;
    font-family: var(--font-body); font-size: 0.85rem;
  `;
  bar.innerHTML = `
    <span id="authGreeting" style="color:var(--muted)"></span>
    <button id="authActionBtn" style="
      background:none; border:1px solid var(--border);
      color:var(--text); padding:6px 14px; border-radius:50px;
      cursor:pointer; font-size:0.82rem;
      transition: border-color 0.2s, color 0.2s;
    ">Log in</button>
    <button id="historyBtn" style="
      background:none; border:none; color:var(--muted);
      cursor:pointer; font-size:0.82rem; display:none;
    ">History</button>
  `;
  document.body.appendChild(bar);

  document.getElementById("authActionBtn").addEventListener("click", () => {
    if (getToken()) logout();
    else showAuthModal("login");
  });

  document.getElementById("historyBtn").addEventListener("click", showHistoryPanel);
}

function updateAuthUI(user) {
  const greeting   = document.getElementById("authGreeting");
  const actionBtn  = document.getElementById("authActionBtn");
  const historyBtn = document.getElementById("historyBtn");

  if (user) {
    const name = user.user_metadata?.display_name || user.email?.split("@")[0] || "User";
    greeting.textContent  = `Hi, ${name}`;
    actionBtn.textContent = "Log out";
    historyBtn.style.display = "inline";
  } else {
    greeting.textContent  = "";
    actionBtn.textContent = "Log in";
    historyBtn.style.display = "none";
  }
}

// ── Auth Modal ────────────────────────────────────────────────────────────────
function showAuthModal(mode = "login") {
  const existing = document.getElementById("authModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "authModal";
  modal.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.7);
    display:flex; align-items:center; justify-content:center; z-index:1000;
    padding: 20px;
  `;

  const isLogin = mode === "login";
  modal.innerHTML = `
    <div style="
      background:var(--surface); border:1px solid var(--border);
      border-radius:16px; padding:36px; width:420px; max-width:90vw;
      font-family:var(--font-body); position:relative;
    ">
      <h2 style="font-family:var(--font-head);font-size:1.3rem;margin-bottom:24px;">
        ${isLogin ? "Log in" : "Create account"}
      </h2>

      <button id="m_google" style="${googleBtnStyle()}">Continue with Google</button>
      <div style="text-align:center;color:var(--muted);font-size:0.8rem;margin:12px 0 14px;">or use email</div>

      ${!isLogin ? `<input id="m_name" type="text" placeholder="Display name"
        style="${inputStyle()}" />` : ""}

      <input id="m_email" type="email" placeholder="Email"
        style="${inputStyle()}" />
      <input id="m_pass" type="password" placeholder="Password"
        style="${inputStyle()}" />

      <div id="m_err" style="color:var(--accent2);font-size:0.8rem;margin-bottom:12px;min-height:18px;"></div>

      <button id="m_submit" style="${btnStyle()}">
        ${isLogin ? "Log in" : "Sign up"}
      </button>

      <p style="text-align:center;color:var(--muted);font-size:0.82rem;margin-top:16px;">
        ${isLogin ? "No account?" : "Already have one?"}
        <a href="#" id="m_toggle" style="color:var(--accent);text-decoration:none;">
          ${isLogin ? "Sign up" : "Log in"}
        </a>
      </p>

      <button id="m_close" style="
        position:absolute; top:16px; right:20px;
        background:none; border:none; color:var(--muted);
        font-size:1.2rem; cursor:pointer;
      ">✕</button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#m_close").addEventListener("click", () => modal.remove());
  modal.querySelector("#m_toggle").addEventListener("click", (e) => {
    e.preventDefault();
    modal.remove();
    showAuthModal(isLogin ? "signup" : "login");
  });

  modal.querySelector("#m_submit").addEventListener("click", async () => {
    const errEl = modal.querySelector("#m_err");
    const email = modal.querySelector("#m_email").value.trim();
    const pass  = modal.querySelector("#m_pass").value;

    errEl.textContent = "";
    try {
      let user;
      if (isLogin) {
        user = await login(email, pass);
      } else {
        const name = modal.querySelector("#m_name")?.value.trim() || "";
        user = await signup(email, pass, name);
      }
      updateAuthUI(user);
      modal.remove();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  modal.querySelector("#m_google").addEventListener("click", async () => {
    const errEl = modal.querySelector("#m_err");
    errEl.textContent = "";
    try {
      await loginWithGoogle();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}

// ── History Panel ─────────────────────────────────────────────────────────────
async function showHistoryPanel() {
  const existing = document.getElementById("historyPanel");
  if (existing) { existing.remove(); return; }

  const panel = document.createElement("div");
  panel.id = "historyPanel";
  panel.style.cssText = `
    position:fixed; top:50px; right:16px; width:300px;
    background:var(--surface); border:1px solid var(--border);
    border-radius:14px; padding:20px; z-index:998;
    font-family:var(--font-body); font-size:0.85rem;
    max-height:70vh; overflow-y:auto;
  `;
  panel.innerHTML = `<h3 style="font-family:var(--font-head);margin-bottom:14px;font-size:1rem;">Recent Searches</h3>
    <div id="historyList"><em style="color:var(--muted)">Loading…</em></div>`;
  document.body.appendChild(panel);

  try {
    const history = await getSearchHistory();
    const list = document.getElementById("historyList");
    if (!history.length) {
      list.innerHTML = `<p style="color:var(--muted)">No searches yet.</p>`;
    } else {
      list.innerHTML = history.map(h => `
        <div style="
          padding:10px 0; border-bottom:1px solid var(--border);
          cursor:pointer; color:var(--text);
        " onclick="document.getElementById('queryInput').value='${escHtml(h.query)}';
                   document.getElementById('historyPanel').remove();">
          <strong>${escHtml(h.query)}</strong>
          <br><span style="color:var(--muted);font-size:0.78rem;">
            ${h.platforms.join(", ")} · ${h.result_count} results ·
            ${new Date(h.searched_at).toLocaleDateString()}
          </span>
        </div>
      `).join("");
    }
  } catch {
    document.getElementById("historyList").innerHTML = `<p style="color:var(--accent2)">Failed to load.</p>`;
  }
}

// ── Wishlist save button (injected onto each card) ───────────────────────────
// Call this after renderCards() in app.js to attach save buttons
async function attachWishlistButtons() {
  if (!getToken()) return;  // only for logged-in users

  let wishlists = await getWishlists();
  if (!wishlists.length) {
    const def = await createWishlist("My Wishlist");
    wishlists = [def];
  }
  const defaultList = wishlists[0];

  document.querySelectorAll(".card").forEach((card) => {
    if (card.querySelector(".save-btn")) return;  // already attached
    const btn = document.createElement("button");
    btn.className = "save-btn";
    btn.textContent = "♡ Save";
    btn.style.cssText = `
      background:none; border:1px solid var(--border);
      color:var(--muted); padding:6px; border-radius:8px;
      font-size:0.78rem; cursor:pointer; margin-top:6px; width:100%;
      transition: border-color 0.2s, color 0.2s;
    `;
    btn.addEventListener("mouseenter", () => {
      btn.style.borderColor = "var(--accent)";
      btn.style.color = "var(--accent)";
    });
    btn.addEventListener("mouseleave", () => {
      if (!btn.dataset.saved) {
        btn.style.borderColor = "var(--border)";
        btn.style.color = "var(--muted)";
      }
    });

    btn.addEventListener("click", async () => {
      const titleEl  = card.querySelector(".card-title");
      const priceEl  = card.querySelector(".card-price");
      const imgEl    = card.querySelector(".card-img");
      const linkEl   = card.querySelector(".card-link");
      const platEl   = card.querySelector(".card-platform");

      try {
        await addToWishlist(defaultList.id, {
          platform: platEl?.textContent || "Unknown",
          title:    titleEl?.textContent || "",
          price:    priceEl?.textContent || "",
          image:    imgEl?.src || null,
          url:      linkEl?.href || null,
        });
        btn.textContent = "♥ Saved";
        btn.dataset.saved = "1";
        btn.style.borderColor = "var(--accent)";
        btn.style.color = "var(--accent)";
      } catch {
        btn.textContent = "Failed";
      }
    });

    card.querySelector(".card-body").appendChild(btn);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function inputStyle() {
  return `width:100%; background:var(--surface2); border:1px solid var(--border);
    color:var(--text); padding:10px 14px; border-radius:10px; font-size:0.9rem;
    font-family:var(--font-body); outline:none; margin-bottom:12px; display:block;`;
}
function btnStyle() {
  return `width:100%; background:var(--accent); color:#0a0a0f; border:none;
    padding:12px; border-radius:10px; font-family:var(--font-head);
    font-size:1rem; font-weight:700; cursor:pointer;`;
}
function googleBtnStyle() {
  return `width:100%; background:#fff; color:#222; border:1px solid #ddd;
    padding:10px 12px; border-radius:10px; font-family:var(--font-body);
    font-size:0.95rem; font-weight:600; cursor:pointer;`;
}
function escHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function readOAuthTokenFromUrl() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  if (!token) return null;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return token;
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  injectAuthBar();
  const oauthToken = readOAuthTokenFromUrl();
  if (oauthToken) saveToken(oauthToken);
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) saveToken(session.access_token);
  const user = await getMe();
  updateAuthUI(user);
})();
