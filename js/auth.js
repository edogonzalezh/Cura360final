/**
 * auth.js — Authentication & session management
 * ────────────────────────────────────────────────
 * • Login / Logout via Supabase Auth (email + password)
 * • Listens for auth state changes (onAuthStateChange)
 * • Fetches user role from the `profiles` table
 * • Route protection: redirects unauthenticated users
 *
 * Public API (attached to window.CURA360.auth):
 *   login(email, password)  → Promise<void>
 *   logout()                → Promise<void>
 *   getCurrentUser()        → { id, email, role } | null
 *   protectRoute(allowedRoles) → checks session, redirects if needed
 */

(function () {
  'use strict';

  const sb = window.CURA360.supabase;

  /** In-memory cache of the current user + role */
  let _currentUser = null;

  // ── Toast helper (imported from router.js utilities) ──
  function showToast(msg, type = 'error') {
    if (window.CURA360.showToast) window.CURA360.showToast(msg, type);
  }

  // ── Login ──────────────────────────────────────────
  /**
   * Authenticates via email + password.
   * On success, fetches the role from `profiles` and redirects.
   * @param {string} email
   * @param {string} password
   */
  async function login(email, password) {
    // Basic client-side validation
    if (!email || !password) {
      showToast('Por favor ingrese correo y contraseña.');
      return;
    }

    // Disable button while request is in flight
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.disabled = true;

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        showToast('Credenciales incorrectas. Verifique su correo y contraseña.');
        if (loginBtn) loginBtn.disabled = false;
        return;
      }

      console.log('[auth] Login successful, fetching role...');

      // Fetch role from profiles table using direct fetch with token
      const role = await _fetchRoleDirectly(data.user.id, data.session.access_token);
      
      console.log('[auth] Role fetched:', role);
      
      _currentUser = { id: data.user.id, email: data.user.email, role };

      // Redirect based on role
      if (role === 'professional') {
        window.location.href = 'dashboard.html';
      } else if (role === 'patient') {
        window.location.href = 'paciente.html';
      } else {
        showToast('Rol no reconocido. Contacte al administrador.');
        if (loginBtn) loginBtn.disabled = false;
      }
    } catch (err) {
      console.error('[auth] login error:', err);
      showToast('Error de conexión. Intente de nuevo.');
      if (loginBtn) loginBtn.disabled = false;
    }
  }

  // ── Logout ─────────────────────────────────────────
  /**
   * Signs out and clears local state.
   */
  async function logout() {
    _currentUser = null;
    await sb.auth.signOut();
    window.location.href = 'index.html';
  }

  // ── Get current user ───────────────────────────────
  /**
   * Returns the cached user object or null.
   * @returns {{ id: string, email: string, role: string } | null}
   */
  function getCurrentUser() {
    return _currentUser;
  }

  // ── Route protection ───────────────────────────────
  /**
   * Call at the top of any protected page.
   * Checks the active Supabase session; if none, redirects to login.
   * If a role filter is provided and doesn't match, redirects accordingly.
   *
   * @param {string[]} [allowedRoles] - e.g. ['professional']
   * @returns {Promise<{ id, email, role }>} the authenticated user
   */
  async function protectRoute(allowedRoles = []) {
    const { data: { session } } = await sb.auth.getSession();

    if (!session) {
      window.location.href = 'index.html';
      return null; // execution stops after redirect
    }

    // Build user object
    const role = await _fetchRole(session.user.id);
    _currentUser = { id: session.user.id, email: session.user.email, role };

    // Role check
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      // Redirect patients trying to access professional pages and vice-versa
      if (role === 'patient') {
        window.location.href = 'paciente.html';
      } else {
        window.location.href = 'dashboard.html';
      }
      return null;
    }

    return _currentUser;
  }

  // ── Internal: fetch role directly with token ────────
  /**
   * Queries the `profiles` table for the user's role using direct fetch.
   * This is a workaround for the Supabase client not auto-attaching tokens correctly.
   * @param {string} userId
   * @param {string} accessToken
   * @returns {Promise<string>}
   */
  async function _fetchRoleDirectly(userId, accessToken) {
    console.log('[auth] _fetchRoleDirectly called with userId:', userId);
    
    try {
      const url = 'https://ghzfnosevncivblpbful.supabase.co' + userId + '&select=role';
      
      console.log('[auth] Fetching from:', url);
      
      const response = await fetch(url, {
        headers: {
          'apikey': 'sb_publishable_zLely_K2mNNHQv82YeV40A_-Tj1XLDg',
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[auth] Response status:', response.status);
      
      if (!response.ok) {
        console.error('[auth] _fetchRoleDirectly HTTP error:', response.status);
        return 'patient';
      }
      
      const data = await response.json();
      console.log('[auth] _fetchRoleDirectly response:', data);
      
      return (data && data[0] && data[0].role) ? data[0].role : 'patient';
    } catch (err) {
      console.error('[auth] _fetchRoleDirectly error:', err);
      return 'patient';
    }
  }

  /**
   * Queries the `profiles` table for the user's role.
   * Falls back to 'patient' if no profile exists.
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async function _fetchRole(userId) {
    const { data } = await sb.from('profiles').select('role').eq('id', userId).single();
    return data ? data.role : 'patient';
  }

  // ── Auth state listener ────────────────────────────
  /**
   * Fires whenever the session changes (tab focus, token refresh, sign-out).
   * Updates the cached user accordingly.
   */
  sb.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      const role = await _fetchRole(session.user.id);
      _currentUser = { id: session.user.id, email: session.user.email, role };
    } else {
      _currentUser = null;
    }
  });

  // ── Expose public API ──────────────────────────────
  window.CURA360.auth = {
    login,
    logout,
    getCurrentUser,
    protectRoute
  };

})();
