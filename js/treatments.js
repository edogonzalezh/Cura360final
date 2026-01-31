/**
 * treatments.js — Treatment / Curación CRUD
 * ───────────────────────────────────────────
 * Uses direct fetch API with token from localStorage.
 * Workaround for Supabase client not attaching auth tokens correctly.
 *
 * Public API (window.CURA360.treatments):
 *   create(woundId, data)     → Promise<Treatment>
 *   listByWound(woundId)      → Promise<Treatment[]>  (chronological)
 */

(function () {
  'use strict';

  const sb = window.CURA360.supabase;
  const SUPABASE_URL = sb.supabaseUrl;
  const SUPABASE_KEY = sb.supabaseKey;
  const STORAGE_KEY = 'sb-' + SUPABASE_URL.match(/\/\/(.+?)\.supabase/)[1] + '-auth-token';

  // ── Helper: get auth token ───────────────────────────
  function getToken() {
    const sessionData = localStorage.getItem(STORAGE_KEY);
    if (!sessionData) return null;
    try {
      const session = JSON.parse(sessionData);
      return session.access_token;
    } catch (err) {
      console.error('[treatments] Error parsing session:', err);
      return null;
    }
  }

  // ── Create treatment ─────────────────────────────────
  async function create(woundId, data) {
    const token = getToken();
    if (!token) {
      window.CURA360.showToast('Sesión expirada. Inicie sesión de nuevo.');
      return null;
    }

    const payload = {
      wound_id:  woundId,
      technique: data.technique || '',
      supplies:  data.supplies  || '',
      notes:     data.notes     || '',
      created_at: new Date().toISOString()
    };

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/treatments', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('[treatments] create HTTP error:', response.status);
        window.CURA360.showToast('Error al registrar curación.');
        return null;
      }

      const rows = await response.json();
      window.CURA360.showToast('Curación registrada exitosamente.', 'success');
      return rows[0];
    } catch (err) {
      console.error('[treatments] create error:', err);
      window.CURA360.showToast('Error al registrar curación.');
      return null;
    }
  }

  // ── List treatments for a wound ──────────────────────
  async function listByWound(woundId) {
    const token = getToken();
    if (!token) return [];

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/treatments?wound_id=eq.' + woundId + '&select=*&order=created_at.desc', {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[treatments] listByWound HTTP error:', response.status);
        return [];
      }

      return await response.json();
    } catch (err) {
      console.error('[treatments] listByWound error:', err);
      return [];
    }
  }

  // ── Expose ─────────────────────────────────────────
  window.CURA360.treatments = { create, listByWound };

})();
