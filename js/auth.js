/**
 * auth.js — Authentication & session management (FETCH-ONLY VERSION)
 * ────────────────────────────────────────────────
 * Complete rewrite using fetch API directly.
 * Does NOT use Supabase SDK for auth operations.
 *
 * Public API (attached to window.CURA360.auth):
 *   login(email, password)  → Promise<void>
 *   logout()                → Promise<void>
 *   getCurrentUser()        → { id, email, role } | null
 *   protectRoute(allowedRoles) → checks session, redirects if needed
 */

(function () {
  'use strict';

  // ── Configuration ────────────────────────────────────
  const SUPABASE_URL = 'https://ghzfnosevncivblpbful.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_zLely_K2mNNHQv82YeV40A_-Tj1XLDg';
  const STORAGE_KEY = 'sb-ghzfnosevncivblpbful-auth-token';

  /** In-memory cache of the current user + role */
  let _currentUser = null;

  // ── Toast helper ─────────────────────────────────────
  function showToast(msg, type = 'error') {
    if (window.CURA360.showToast) window.CURA360.showToast(msg, type);
  }

  // ── Get stored session ───────────────────────────────
  function getStoredSession() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (err) {
      console.error('[auth] Error parsing stored session:', err);
      return null;
    }
  }

  // ── Save session to storage ──────────────────────────
  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  // ── Clear session ────────────────────────────────────
  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    _currentUser = null;
  }

  // ── Login using pure fetch ───────────────────────────
  /**
   * Authenticates via email + password using direct API call.
   * @param {string} email
   * @param {string} password
   */
  async function login(email, password) {
    if (!email || !password) {
      showToast('Por favor ingrese correo y contraseña.');
      return;
    }

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.disabled = true;

    try {
      console.log('[auth] Starting login with fetch...');

      // Call Supabase auth API directly
      const response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      console.log('[auth] Login response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[auth] Login error:', errorData);
        showToast('Credenciales incorrectas. Verifique su correo y contraseña.');
        if (loginBtn) loginBtn.disabled = false;
        return;
      }

      const authData = await response.json();
      console.log('[auth] Login successful, user ID:', authData.user.id);

      // Save session to localStorage
      saveSession(authData);

      // Fetch role from profiles
      console.log('[auth] Fetching role...');
      const role = await _fetchRole(authData.user.id, authData.access_token);
      console.log('[auth] Role fetched:', role);

      _currentUser = { 
        id: authData.user.id, 
        email: authData.user.email, 
        role: role 
      };

      // Redirect based on role
      console.log('[auth] Redirecting to:', role === 'professional' ? 'dashboard' : 'paciente');
      
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

  // ── Logout ───────────────────────────────────────────
  async function logout() {
    const session = getStoredSession();
    
    if (session && session.access_token) {
      // Call logout endpoint
      try {
        await fetch(SUPABASE_URL + '/auth/v1/logout', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + session.access_token
          }
        });
      } catch (err) {
        console.error('[auth] logout error:', err);
      }
    }

    clearSession();
    window.location.href = 'index.html';
  }

  // ── Get current user ─────────────────────────────────
  function getCurrentUser() {
    return _currentUser;
  }

  // ── Route protection ─────────────────────────────────
  /**
   * Checks if user is authenticated and has the right role.
   * @param {string[]} allowedRoles
   * @returns {Promise<object|null>}
   */
  async function protectRoute(allowedRoles = []) {
    const session = getStoredSession();

    if (!session || !session.access_token) {
      window.location.href = 'index.html';
      return null;
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at < now) {
      clearSession();
      window.location.href = 'index.html';
      return null;
    }

    // Fetch role
    const role = await _fetchRole(session.user.id, session.access_token);
    _currentUser = { 
      id: session.user.id, 
      email: session.user.email, 
      role: role 
    };

    // Check role access
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      if (role === 'patient') {
        window.location.href = 'paciente.html';
      } else {
        window.location.href = 'dashboard.html';
      }
      return null;
    }

    return _currentUser;
  }

  // ── Internal: fetch role ─────────────────────────────
  /**
   * @param {string} userId
   * @param {string} accessToken
   * @returns {Promise<string>}
   */
  async function _fetchRole(userId, accessToken) {
    try {
      const response = await fetch(
        SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId + '&select=role',
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('[auth] _fetchRole HTTP error:', response.status);
        return 'patient';
      }

      const data = await response.json();
      return (data && data[0] && data[0].role) ? data[0].role : 'patient';
    } catch (err) {
      console.error('[auth] _fetchRole error:', err);
      return 'patient';
    }
  }

  // ── Expose public API ────────────────────────────────
  window.CURA360.auth = {
    login,
    logout,
    getCurrentUser,
    protectRoute
  };

  console.log('[auth] Pure-fetch auth module loaded');

})();
