// frontend/auth.js
// Handles login/signup UI and wishlist interactions.
// Supabase is loaded as a global via CDN in index.html

const API = "http://localhost:5000/api";

// Supabase client (anon key is safe to expose — it only has public permissions)
const _supabase = window.supabase?.createClient(
  "https://ajxixspybcjegualqwak.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqeGl4c3B5YmNqZWd1YWxxd2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzM4ODAsImV4cCI6MjA5MjM0OTg4MH0.o4KDD06HrlFEquQMM5_lE22OjK9Q_Q2dorWdRYeZKUg"
);

// ── Token storage ─────────────────────────────────────────────────────────────
function saveToken(token) { sessionStorage.setItem("ps_token", token); }
function getToken()       { return sessionStorage.getItem("ps_token"); }
function clearToken()     { sessionStorage.removeItem("ps_token"); }

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth API calls ────────────────────────────────────────────────────────────
async function signup(email, password, displayName) {
  if (!_supabase) throw new Error("Auth not configured");
  const { data, error } = await _supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || "" } },
  });
  if (error) throw new Error(error.message);
  if (!data.session?.access_token) {
    throw new Error("Account created! Please verify your email, then log in.");
  }
  saveToken(data.session.access_token);
  return data.user;
}

async function login(email, password) {
  if (!_supabase) throw new Error("Auth not configured");
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  saveToken(data.session.access_token);
  return data.user;
}

async function loginWithGoogle() {
  if (!_supabase) throw new Error("Auth not configured");
  const redirectTo = window.location.origin + window.location.pathname;
  const { data, error } = await _supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw new Error(error.message || "Google login failed");
  if (data?.url) window.location.href = data.url;
}

async function logout() {
  if (_supabase) await _supabase.auth.signOut();
  clearToken();
  updateAuthUI(null);
}

async function getMe() {
  if (!getToken() || !_supabase) return null;
  const { data, error } = await _supabase.auth.getUser(getToken());
  if (error || !data?.user) { clearToken(); return null; }
  return data.user;
}

// ── Wishlist API calls (go through backend) ───────────────────────────────────
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
    ">Sign up / Log in</button>
    <button id="historyBtn" style="
      background:none; border:none; color:var(--muted);
      cursor:pointer; font-size:0.82rem; display:none;
    ">History</button>
  `;
  document.body.appendChild(bar);

  document.getElementById("authActionBtn").addEventListener("click", () => {
    if (getToken()) logout();
    else showAuthModal("signup");
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
    actionBtn.textContent = "Sign up / Log in";
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
      border-radius:16px; padding:36px; width:360px; max-width:90vw;
      font-family:var(--font-body); position:relative;
    ">
      <h2 style="font-family:var(--font-head);font-size:1.3rem;margin-bottom:24px;">
        ${isLogin ? "Log in" : "Create account"}
      </h2>

      <button id="m_google" style="${googleBtnStyle()}">
        <svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0;">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div style="display:flex;align-items:center;gap:10px;margin:14px 0;">
        <hr style="flex:1;border:none;border-top:1px solid var(--border);" />
        <span style="color:var(--muted);font-size:0.78rem;">or email</span>
        <hr style="flex:1;border:none;border-top:1px solid var(--border);" />
      </div>

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

  const errEl = modal.querySelector("#m_err");

  modal.querySelector("#m_close").addEventListener("click", () => modal.remove());
  modal.querySelector("#m_toggle").addEventListener("click", (e) => {
    e.preventDefault();
    modal.remove();
    showAuthModal(isLogin ? "signup" : "login");
  });

  modal.querySelector("#m_google").addEventListener("click", async () => {
    errEl.textContent = "";
    try { await loginWithGoogle(); }
    catch (err) { errEl.textContent = err.message; }
  });

  modal.querySelector("#m_submit").addEventListener("click", async () => {
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
      redirectToMainPage();
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
            ${(h.platforms || []).join(", ")} · ${h.result_count} results ·
            ${new Date(h.searched_at).toLocaleDateString()}
          </span>
        </div>
      `).join("");
    }
  } catch {
    document.getElementById("historyList").innerHTML = `<p style="color:var(--accent2)">Failed to load.</p>`;
  }
}

// ── Wishlist buttons on cards ─────────────────────────────────────────────────
async function attachWishlistButtons() {
  if (!getToken()) return;

  let wishlists = await getWishlists();
  if (!wishlists.length) {
    const def = await createWishlist("My Wishlist");
    wishlists = [def];
  }
  const defaultList = wishlists[0];

  document.querySelectorAll(".card").forEach((card) => {
    if (card.querySelector(".save-btn")) return;
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
      try {
        await addToWishlist(defaultList.id, {
          platform: card.querySelector(".card-platform")?.textContent || "Unknown",
          title:    card.querySelector(".card-title")?.textContent    || "",
          price:    card.querySelector(".card-price")?.textContent    || "",
          image:    card.querySelector(".card-img")?.src              || null,
          url:      card.querySelector(".card-link")?.href            || null,
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
  return `width:100%; background:var(--surface2); color:var(--text);
    border:1px solid var(--border); padding:11px; border-radius:10px;
    font-family:var(--font-body); font-size:0.9rem; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:10px;`;
}
function escHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function redirectToMainPage() {
  const mainPageUrl = new URL("index.html", window.location.href);
  if (window.location.pathname !== mainPageUrl.pathname) {
    window.location.assign(mainPageUrl.href);
  }
}

// ── Google OAuth callback — token arrives in URL hash ─────────────────────────
async function handleOAuthCallback() {
  const hash = window.location.hash;
  if (hash.includes("access_token=")) {
    const params = new URLSearchParams(hash.slice(1));
    const token  = params.get("access_token");
    if (token) {
      saveToken(token);
      history.replaceState(null, "", window.location.pathname);
      redirectToMainPage();
      return await getMe();
    }
  }

  const params = new URLSearchParams(window.location.search);
  const err    = params.get("auth_error");
  if (err) {
    history.replaceState(null, "", window.location.pathname);
    if (typeof showError === "function") showError(`Google sign-in failed: ${err}`);
  }

  return null;
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  injectAuthBar();
  const oauthUser = await handleOAuthCallback();
  const user      = oauthUser || await getMe();
  updateAuthUI(user);
})();
