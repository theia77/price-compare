// frontend/auth.js — Auth UI, Supabase client, wishlist API
// Supabase JS v2 loaded as window.supabase via CDN in index.html

const API = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:5000/api"
  : "https://price-compare-iloj.onrender.com/api";

// ── Supabase client (anon key — safe to expose in frontend) ──────────────────
const _supabase = window.supabase?.createClient(
  "https://ajxixspybcjegualqwak.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqeGl4c3B5YmNqZWd1YWxxd2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzM4ODAsImV4cCI6MjA5MjM0OTg4MH0.o4KDD06HrlFEquQMM5_lE22OjK9Q_Q2dorWdRYeZKUg"
);

// ── Token storage ─────────────────────────────────────────────────────────────
function saveToken(t) { sessionStorage.setItem("ps_token", t); }
function getToken()   { return sessionStorage.getItem("ps_token"); }
function clearToken() { sessionStorage.removeItem("ps_token"); }
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Builds the URL Supabase should redirect back to after Google OAuth.
function getAuthRedirectUrl() {
  if (window.location.protocol === "file:") return null;
  const url = new URL(window.location.href);
  url.pathname = "/";
  url.search   = "";
  url.hash     = "";
  return url.href;
}

// ── Auth functions ────────────────────────────────────────────────────────────
async function signup(email, password, displayName) {
  if (!_supabase) throw new Error("Supabase not loaded. Refresh the page.");

  const { data, error } = await _supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || "" } },
  });
  if (error) throw new Error(error.message);
  if (!data.session?.access_token) {
    throw new Error("Account created but email confirmation is still enabled in Supabase. Go to Supabase Dashboard → Authentication → Providers → Email and turn off \"Confirm email\".");
  }

  saveToken(data.session.access_token);
  return data.user;
}

async function login(email, password) {
  if (!_supabase) throw new Error("Supabase not loaded. Refresh the page.");

  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message.includes("Invalid login credentials")
    ? "Incorrect email or password."
    : error.message || "Login failed.");

  saveToken(data.session.access_token);
  return data.user;
}

async function loginWithGoogle() {
  if (!_supabase) throw new Error("Supabase not loaded. Refresh the page.");

  if (window.location.protocol === "file:") {
    throw new Error(
      "Google sign-in needs a web server. In VS Code, right-click index.html → \"Open with Live Server\"."
    );
  }

  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await _supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) throw new Error(error.message || "Google sign-in failed.");
  if (data?.url) window.location.href = data.url;
}

async function logout() {
  if (_supabase) await _supabase.auth.signOut();
  clearToken();
  updateAuthUI(null);
}

async function getMe() {
  if (!_supabase) return null;

  let token = getToken();
  if (!token) {
    // Try to restore a session Supabase already has (e.g. after page refresh)
    const { data, error } = await _supabase.auth.getSession();
    if (!error && data?.session?.access_token) {
      token = data.session.access_token;
      saveToken(token);
    }
  }
  if (!token) return null;

  const { data, error } = await _supabase.auth.getUser(token);
  if (error || !data?.user) { clearToken(); return null; }
  return data.user;
}

// ── Backend API calls (wishlist & history — needs backend running) ────────────
async function getWishlists() {
  try {
    const res  = await fetch(`${API}/wishlist`, { headers: authHeaders() });
    const data = await res.json();
    return data.wishlists || [];
  } catch { return []; }
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
    method: "DELETE",
    headers: authHeaders(),
  });
}

async function getSearchHistory() {
  try {
    const res  = await fetch(`${API}/search/history`, { headers: authHeaders() });
    const data = await res.json();
    return data.history || [];
  } catch { return []; }
}

// ── Auth bar (top-right) ──────────────────────────────────────────────────────
function injectAuthBar() {
  const bar = document.createElement("div");
  bar.id = "authBar";
  bar.style.cssText = `
    position:fixed; top:0; right:0;
    display:flex; align-items:center; gap:10px;
    padding:10px 20px; z-index:999;
    font-family:var(--font-body); font-size:0.85rem;
  `;
  bar.innerHTML = `
    <span id="authGreeting" style="color:var(--muted)"></span>
    <button id="authSignupBtn" style="
      background:var(--accent); border:none; color:#0a0a0f;
      padding:6px 14px; border-radius:50px; cursor:pointer;
      font-size:0.82rem; font-weight:600;
    ">Sign up</button>
    <button id="authLoginBtn" style="
      background:none; border:1px solid var(--border); color:var(--text);
      padding:6px 14px; border-radius:50px; cursor:pointer; font-size:0.82rem;
    ">Log in</button>
    <button id="historyBtn" style="
      background:none; border:none; color:var(--muted);
      cursor:pointer; font-size:0.82rem; display:none;
    ">History</button>
    <button id="wishlistBtn" style="
      background:none; border:1px solid var(--border); color:var(--muted);
      padding:6px 14px; border-radius:50px; cursor:pointer;
      font-size:0.82rem; display:none;
    ">♡ Wishlist</button>
  `;
  document.body.appendChild(bar);

  document.getElementById("authSignupBtn").addEventListener("click", () => showAuthModal("signup"));
  document.getElementById("authLoginBtn").addEventListener("click", () => {
    if (getToken()) logout();
    else showAuthModal("login");
  });
  document.getElementById("historyBtn").addEventListener("click", showHistoryPanel);
  document.getElementById("wishlistBtn").addEventListener("click", showWishlistPanel);
}

function updateAuthUI(user) {
  const greeting  = document.getElementById("authGreeting");
  const signupBtn = document.getElementById("authSignupBtn");
  const loginBtn  = document.getElementById("authLoginBtn");
  const histBtn   = document.getElementById("historyBtn");
  if (!greeting) return;

  const wishBtn = document.getElementById("wishlistBtn");
  if (user) {
    const name = user.user_metadata?.display_name || user.email?.split("@")[0] || "User";
    greeting.textContent    = `Hi, ${name}`;
    loginBtn.textContent    = "Log out";
    signupBtn.style.display = "none";
    histBtn.style.display   = "inline";
    if (wishBtn) wishBtn.style.display = "inline";
  } else {
    greeting.textContent    = "";
    loginBtn.textContent    = "Log in";
    signupBtn.style.display = "inline";
    histBtn.style.display   = "none";
    if (wishBtn) wishBtn.style.display = "none";
  }
}

// ── Auth Modal ────────────────────────────────────────────────────────────────
function showAuthModal(mode = "login") {
  const existing = document.getElementById("authModal");
  if (existing) existing.remove();

  const isLogin = mode === "login";
  const modal   = document.createElement("div");
  modal.id = "authModal";
  modal.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.75);
    display:flex; align-items:center; justify-content:center;
    z-index:1000; padding:20px;
  `;
  modal.innerHTML = `
    <div style="
      background:var(--surface); border:1px solid var(--border);
      border-radius:18px; padding:36px 32px; width:360px; max-width:92vw;
      font-family:var(--font-body); position:relative;
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
    ">
      <!-- Tab bar: Log in / Sign up -->
      <div style="display:flex; margin-bottom:28px; border:1px solid var(--border); border-radius:10px; overflow:hidden;">
        <button id="tab_login" style="
          flex:1; padding:10px; border:none; cursor:pointer; font-size:0.9rem;
          font-family:var(--font-body);
          background:${isLogin ? "var(--accent)" : "transparent"};
          color:${isLogin ? "#0a0a0f" : "var(--muted)"};
          font-weight:${isLogin ? 600 : 400};
        ">Log in</button>
        <button id="tab_signup" style="
          flex:1; padding:10px; border:none; cursor:pointer; font-size:0.9rem;
          font-family:var(--font-body);
          background:${!isLogin ? "var(--accent)" : "transparent"};
          color:${!isLogin ? "#0a0a0f" : "var(--muted)"};
          font-weight:${!isLogin ? 600 : 400};
        ">Sign up</button>
      </div>

      <!-- Google -->
      <button id="m_google" style="${googleBtnStyle()}">
        <svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div style="display:flex;align-items:center;gap:10px;margin:14px 0;">
        <hr style="flex:1;border:none;border-top:1px solid var(--border)"/>
        <span style="color:var(--muted);font-size:0.78rem;">or email</span>
        <hr style="flex:1;border:none;border-top:1px solid var(--border)"/>
      </div>

      ${!isLogin ? `<input id="m_name" type="text" placeholder="Display name (optional)"
        style="${inputStyle()}" />` : ""}
      <input id="m_email" type="email" placeholder="Email address"
        style="${inputStyle()}" />
      <input id="m_pass" type="password" placeholder="Password (min 6 chars)"
        style="${inputStyle()}" />

      <div id="m_msg" style="font-size:0.82rem; min-height:20px; margin-bottom:12px; line-height:1.4;"></div>

      <button id="m_submit" style="${btnStyle()}">
        ${isLogin ? "Log in" : "Create account"}
      </button>

      <button id="m_close" style="
        position:absolute; top:14px; right:18px; background:none; border:none;
        color:var(--muted); font-size:1.3rem; cursor:pointer; line-height:1;
      ">✕</button>
    </div>
  `;
  document.body.appendChild(modal);

  const msgEl     = modal.querySelector("#m_msg");
  const submitBtn = modal.querySelector("#m_submit");

  function showMsg(html, type = "error") {
    const c = { error: "var(--accent2)", info: "#60a5fa", success: "#4ade80" };
    msgEl.style.color = c[type] || c.error;
    msgEl.innerHTML = html;
  }

  // Tab switch
  modal.querySelector("#tab_login").addEventListener("click",  () => { modal.remove(); showAuthModal("login"); });
  modal.querySelector("#tab_signup").addEventListener("click", () => { modal.remove(); showAuthModal("signup"); });
  // Close
  modal.querySelector("#m_close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

  // Google button
  modal.querySelector("#m_google").addEventListener("click", async () => {
    msgEl.innerHTML = "";
    try { await loginWithGoogle(); }
    catch (err) { showMsg(err.message, "error"); }
  });

  // Email / password submit
  modal.querySelector("#m_submit").addEventListener("click", async () => {
    const email = modal.querySelector("#m_email").value.trim();
    const pass  = modal.querySelector("#m_pass").value;
    if (!email || !pass) { showMsg("Please fill in email and password.", "error"); return; }

    msgEl.innerHTML    = "";
    submitBtn.disabled = true;
    submitBtn.textContent = isLogin ? "Logging in…" : "Creating account…";

    try {
      let user;
      if (isLogin) {
        user = await login(email, pass);
      } else {
        const name = modal.querySelector("#m_name")?.value.trim() || "";
        user = await signup(email, pass, name);
      }

      // ── SUCCESS: update top bar, close modal — user stays on main page ──
      updateAuthUI(user);
      modal.remove();

    } catch (err) {
      showMsg(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? "Log in" : "Create account";
    }
  });

  setTimeout(() => modal.querySelector("#m_email")?.focus(), 50);
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
    max-height:70vh; overflow-y:auto; box-shadow:0 8px 30px rgba(0,0,0,0.4);
  `;
  panel.innerHTML = `
    <h3 style="font-family:var(--font-head);margin-bottom:14px;font-size:1rem;">Recent Searches</h3>
    <div id="historyList"><em style="color:var(--muted)">Loading…</em></div>
  `;
  document.body.appendChild(panel);

  setTimeout(() => {
    document.addEventListener("click", function closer(e) {
      if (!panel.contains(e.target) && e.target.id !== "historyBtn") {
        panel.remove();
        document.removeEventListener("click", closer);
      }
    });
  }, 0);

  try {
    const history = await getSearchHistory();
    const list = document.getElementById("historyList");
    if (!history.length) {
      list.innerHTML = `<p style="color:var(--muted)">No searches yet.</p>`;
    } else {
      list.innerHTML = history.map(h => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;color:var(--text);"
          onclick="document.getElementById('queryInput').value='${escHtml(h.query)}';
                   document.getElementById('historyPanel').remove();">
          <strong>${escHtml(h.query)}</strong><br>
          <span style="color:var(--muted);font-size:0.78rem;">
            ${(h.platforms || []).join(", ")} · ${h.result_count} results ·
            ${new Date(h.searched_at).toLocaleDateString()}
          </span>
        </div>
      `).join("");
    }
  } catch {
    document.getElementById("historyList").innerHTML =
      `<p style="color:var(--accent2)">Failed to load history.</p>`;
  }
}

// ── Wishlist Panel ────────────────────────────────────────────────────────────
async function showWishlistPanel() {
  const existing = document.getElementById("wishlistPanel");
  if (existing) { existing.remove(); return; }

  const panel = document.createElement("div");
  panel.id = "wishlistPanel";
  panel.style.cssText = `
    position:fixed; top:50px; right:16px; width:340px;
    background:var(--surface); border:1px solid var(--border);
    border-radius:14px; padding:20px; z-index:998;
    font-family:var(--font-body); font-size:0.85rem;
    max-height:75vh; overflow-y:auto; box-shadow:0 8px 30px rgba(0,0,0,0.4);
  `;
  panel.innerHTML = `
    <h3 style="font-family:var(--font-head);margin-bottom:14px;font-size:1rem;">♡ My Wishlist</h3>
    <div id="wishlistItems"><em style="color:var(--muted)">Loading…</em></div>
  `;
  document.body.appendChild(panel);

  setTimeout(() => {
    document.addEventListener("click", function closer(e) {
      if (!panel.contains(e.target) && e.target.id !== "wishlistBtn") {
        panel.remove();
        document.removeEventListener("click", closer);
      }
    });
  }, 0);

  try {
    const wishlists = await getWishlists();
    const container = document.getElementById("wishlistItems");

    if (!wishlists.length) {
      container.innerHTML = `<p style="color:var(--muted)">No wishlists yet. Save items from search results.</p>`;
      return;
    }

    let allItems = [];
    for (const wl of wishlists) {
      const res  = await fetch(`${API}/wishlist/${wl.id}/items`, { headers: authHeaders() });
      const data = await res.json();
      allItems = allItems.concat((data.items || []).map(item => ({ ...item, _wlName: wl.name })));
    }

    if (!allItems.length) {
      container.innerHTML = `<p style="color:var(--muted)">No saved items yet. Hit ♡ Save on any product card.</p>`;
      return;
    }

    container.innerHTML = allItems.map(item => `
      <div id="witem-${escHtml(item.id)}" style="
        display:flex; gap:10px; padding:10px 0;
        border-bottom:1px solid var(--border); align-items:flex-start;
      ">
        ${item.image
          ? `<img src="${escHtml(item.image)}" alt="" style="width:52px;height:52px;object-fit:contain;border-radius:8px;background:var(--surface2);" onerror="this.style.display='none'">`
          : `<div style="width:52px;height:52px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🖼️</div>`
        }
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(item.title)}">${escHtml(item.title)}</div>
          <div style="color:var(--accent);font-weight:700;margin:2px 0;">${escHtml(item.price || "N/A")}</div>
          <div style="color:var(--muted);font-size:0.75rem;">${escHtml(item.platform)} · ${escHtml(item._wlName)}</div>
          <div style="display:flex;gap:8px;margin-top:6px;">
            ${item.product_url ? `<a href="${escHtml(item.product_url)}" target="_blank" rel="noopener" style="color:var(--accent);font-size:0.78rem;text-decoration:none;">View ↗</a>` : ""}
            <button onclick="removeWishlistItem('${escHtml(item.id)}')" style="
              background:none;border:none;color:var(--accent2);
              font-size:0.78rem;cursor:pointer;padding:0;
            ">Remove</button>
          </div>
        </div>
      </div>
    `).join("");
  } catch {
    document.getElementById("wishlistItems").innerHTML =
      `<p style="color:var(--accent2)">Failed to load wishlist.</p>`;
  }
}

async function removeWishlistItem(itemId) {
  try {
    await removeFromWishlist(itemId);
    const el = document.getElementById(`witem-${itemId}`);
    if (el) el.remove();
    const container = document.getElementById("wishlistItems");
    if (container && !container.querySelector("[id^='witem-']")) {
      container.innerHTML = `<p style="color:var(--muted)">No saved items yet. Hit ♡ Save on any product card.</p>`;
    }
  } catch {
    /* silent fail */
  }
}

// ── Wishlist save buttons on result cards ─────────────────────────────────────
async function attachWishlistButtons() {
  if (!getToken()) return;

  let wishlists;
  try {
    wishlists = await getWishlists();
    if (!wishlists.length) {
      const def = await createWishlist("My Wishlist");
      wishlists = [def];
    }
  } catch { return; }

  const defaultList = wishlists[0];
  document.querySelectorAll(".card").forEach((card) => {
    if (card.querySelector(".save-btn")) return;
    const btn = document.createElement("button");
    btn.className = "save-btn";
    btn.textContent = "♡ Save";
    btn.style.cssText = `
      background:none; border:1px solid var(--border); color:var(--muted);
      padding:6px; border-radius:8px; font-size:0.78rem; cursor:pointer;
      margin-top:6px; width:100%; transition:border-color 0.2s,color 0.2s;
    `;
    btn.addEventListener("mouseenter", () => { btn.style.borderColor = "var(--accent)"; btn.style.color = "var(--accent)"; });
    btn.addEventListener("mouseleave", () => {
      if (!btn.dataset.saved) { btn.style.borderColor = "var(--border)"; btn.style.color = "var(--muted)"; }
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
        btn.textContent = "♥ Saved"; btn.dataset.saved = "1";
        btn.style.borderColor = "var(--accent)"; btn.style.color = "var(--accent)";
      } catch { btn.textContent = "Failed"; }
    });
    card.querySelector(".card-body").appendChild(btn);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function inputStyle() {
  return `width:100%; background:var(--surface2); border:1px solid var(--border);
    color:var(--text); padding:10px 14px; border-radius:10px; font-size:0.9rem;
    font-family:var(--font-body); outline:none; margin-bottom:12px; display:block;
    box-sizing:border-box;`;
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
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Google OAuth callback — token comes back in URL hash ──────────────────────
async function handleOAuthCallback() {
  const hash = window.location.hash;
  if (hash.includes("access_token=")) {
    const params = new URLSearchParams(hash.slice(1));
    const token  = params.get("access_token");
    if (token) {
      saveToken(token);
      history.replaceState(null, "", window.location.pathname);
      return await getMe();
    }
  }

  const qp  = new URLSearchParams(window.location.search);
  const err = qp.get("auth_error") || qp.get("error_description");
  if (err) {
    history.replaceState(null, "", window.location.pathname);
    if (typeof showError === "function") showError(`Sign-in failed: ${err}`);
  }

  return null;
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  injectAuthBar();
  const oauthUser = await handleOAuthCallback();
  const user      = oauthUser || await getMe();
  updateAuthUI(user);
})();
