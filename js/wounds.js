/**
 * wounds.js — Wound CRUD operations
 * ─────────────────────────────────────
 * Uses direct fetch API with token from localStorage.
 * Workaround for Supabase client not attaching auth tokens correctly.
 *
 * Public API (window.CURA360.wounds):
 *   create(patientId, data) → Promise<Wound>
 *   listByPatient(patientId)→ Promise<Wound[]>
 *   getById(woundId)        → Promise<Wound>
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
      console.error('[wounds] Error parsing session:', err);
      return null;
    }
  }

  // ── Create wound ─────────────────────────────────────
  async function create(patientId, data) {
    const token = getToken();
    if (!token) {
      window.CURA360.showToast('Sesión expirada. Inicie sesión de nuevo.');
      return null;
    }

    const payload = {
      patient_id: patientId,
      
      // Clasificación estándar
      wound_type_standard: data.wound_type_standard || null,
      type:                data.type || '',
      wound_grade:         data.wound_grade || null,
      
      // Ubicación y medidas
      location:   data.location || '',
      length_cm:  data.length_cm ? parseFloat(data.length_cm) : null,
      width_cm:   data.width_cm ? parseFloat(data.width_cm) : null,
      depth_cm:   data.depth_cm ? parseFloat(data.depth_cm) : null,
      
      // Características clínicas
      exudate_amount:  data.exudate_amount || null,
      exudate_type:    data.exudate_type || null,
      pain_scale:      data.pain_scale ? parseInt(data.pain_scale, 10) : null,
      infection_signs: data.infection_signs || false,
      
      // Estado y observaciones
      dimensions: data.dimensions || '',  // Observaciones adicionales
      status:     data.status || 'active'
    };

    // Remove null/empty values
    Object.keys(payload).forEach(key => {
      if (payload[key] === null || payload[key] === '') {
        delete payload[key];
      }
    });
    
    // Ensure required fields
    payload.patient_id = patientId;
    payload.location = data.location || '';
    payload.status = data.status || 'active';

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/wounds', {
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
        console.error('[wounds] create HTTP error:', response.status);
        window.CURA360.showToast('Error al registrar herida.');
        return null;
      }

      const rows = await response.json();
      window.CURA360.showToast('Herida registrada exitosamente.', 'success');
      return rows[0];
    } catch (err) {
      console.error('[wounds] create error:', err);
      window.CURA360.showToast('Error al registrar herida.');
      return null;
    }
  }

  // ── List wounds for a patient ────────────────────────
  async function listByPatient(patientId) {
    const token = getToken();
    if (!token) return [];

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/wounds?patient_id=eq.' + patientId + '&select=*&order=created_at.desc', {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[wounds] listByPatient HTTP error:', response.status);
        return [];
      }

      return await response.json();
    } catch (err) {
      console.error('[wounds] listByPatient error:', err);
      return [];
    }
  }

  // ── Get single wound ─────────────────────────────────
  async function getById(woundId) {
    const token = getToken();
    if (!token) return null;

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/wounds?id=eq.' + woundId + '&select=*', {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[wounds] getById HTTP error:', response.status);
        return null;
      }

      const rows = await response.json();
      return rows[0] || null;
    } catch (err) {
      console.error('[wounds] getById error:', err);
      return null;
    }
  }

  // ── Expose ─────────────────────────────────────────
  window.CURA360.wounds = { create, listByPatient, getById };

})();
