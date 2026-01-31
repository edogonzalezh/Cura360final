/**
 * patients.js — Patient CRUD operations
 * ─────────────────────────────────────────
 * Uses direct fetch API with token from localStorage.
 * Workaround for Supabase client not attaching auth tokens correctly.
 *
 * Public API (window.CURA360.patients):
 *   create(data)       → Promise<Patient>
 *   list()             → Promise<Patient[]>
 *   getById(id)        → Promise<Patient>
 */

(function () {
  'use strict';

  const sb = window.CURA360.supabase;
  const SUPABASE_URL = sb.supabaseUrl;
  const SUPABASE_KEY = sb.supabaseKey;
  const STORAGE_KEY = 'sb-' + SUPABASE_URL.match(/\/\/(.+?)\.supabase/)[1] + '-auth-token';

  // ── Helper: get auth token from localStorage ─────────
  function getToken() {
    const sessionData = localStorage.getItem(STORAGE_KEY);
    if (!sessionData) return null;
    try {
      const session = JSON.parse(sessionData);
      return session.access_token;
    } catch (err) {
      console.error('[patients] Error parsing session:', err);
      return null;
    }
  }

  // ── Create patient ───────────────────────────────────
  async function create(data) {
    const user = window.CURA360.auth.getCurrentUser();
    if (!user) {
      window.CURA360.showToast('Sesión expirada. Inicie sesión de nuevo.');
      return null;
    }

    const token = getToken();
    if (!token) {
      window.CURA360.showToast('Sesión expirada. Inicie sesión de nuevo.');
      return null;
    }

    const payload = {
      name:            data.name,
      age:             parseInt(data.age, 10),
      diagnosis:       data.diagnosis || '',
      comorbidities:   data.comorbidities || '',
      professional_id: user.id
    };

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/patients', {
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
        console.error('[patients] create HTTP error:', response.status);
        window.CURA360.showToast('Error al crear paciente.');
        return null;
      }

      const rows = await response.json();
      window.CURA360.showToast('Paciente creado exitosamente.', 'success');
      return rows[0];
    } catch (err) {
      console.error('[patients] create error:', err);
      window.CURA360.showToast('Error al crear paciente.');
      return null;
    }
  }

  // ── List patients ────────────────────────────────────
  async function list() {
    const token = getToken();
    if (!token) return [];

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/patients?select=*&order=created_at.desc', {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[patients] list HTTP error:', response.status);
        window.CURA360.showToast('Error al cargar pacientes.');
        return [];
      }

      return await response.json();
    } catch (err) {
      console.error('[patients] list error:', err);
      window.CURA360.showToast('Error al cargar pacientes.');
      return [];
    }
  }

  // ── Get single patient ───────────────────────────────
  async function getById(id) {
    const token = getToken();
    if (!token) return null;

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/patients?id=eq.' + id + '&select=*', {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[patients] getById HTTP error:', response.status);
        return null;
      }

      const rows = await response.json();
      return rows[0] || null;
    } catch (err) {
      console.error('[patients] getById error:', err);
      return null;
    }
  }

  // ── Expose ─────────────────────────────────────────
  window.CURA360.patients = { create, list, getById };

})();
