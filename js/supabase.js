/**
 * supabase.js — Supabase client singleton
 * ─────────────────────────────────────────
 * Inicializa el SDK de Supabase.
 * Todos los otros módulos usan window.CURA360.supabase
 *
 * ⚠️  Reemplace los valores de abajo con sus credenciales reales
 *     (Supabase Dashboard → Settings → API)
 */

// ── Configuración ──────────────────────────────────────
const SUPABASE_URL  = 'https://ghzfnosevncivblpbful.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_zLely_K2mNNHQv82YeV40A_-Tj1XLDg';

// ── Inicializar cliente ────────────────────────────────
(function () {
  'use strict';

  window.CURA360 = window.CURA360 || {};

  // Esperar a que el SDK esté disponible
  var attempts = 0;
  var maxAttempts = 50; // 5 segundos máximo (50 x 100ms)

  function initSupabase() {
    // Buscar el SDK en cualquiera de sus posibles nombres
    var SDK = window.supabase;
    
    if (!SDK && window.supabaseClient) {
      SDK = window.supabaseClient;
    }

    if (SDK && SDK.createClient) {
      // SDK encontrado - crear cliente
      window.CURA360.supabase = SDK.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('[Cura360] Cliente Supabase inicializado correctamente.');
      
      // Disparar evento para que otros módulos sepan que está listo
      window.dispatchEvent(new Event('supabase-ready'));
      return;
    }

    // SDK no disponible aún
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(initSupabase, 100); // reintentar en 100ms
    } else {
      // Timeout - mostrar error
      console.error('[Cura360] ERROR: El SDK de Supabase no se cargó después de 5 segundos.');
      document.body.innerHTML =
        '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
        'background:#0f1923;font-family:sans-serif;padding:24px;">' +
          '<div style="background:#162230;border:1px solid #253d5a;border-radius:20px;' +
          'padding:40px 32px;max-width:400px;width:100%;text-align:center;">' +
            '<div style="font-size:48px;margin-bottom:16px;">&#9888;&#65039;</div>' +
            '<h2 style="color:#fff;margin-bottom:8px;font-size:20px;">Error de carga</h2>' +
            '<p style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:24px;">' +
              'No se pudo cargar el SDK de Supabase.<br>' +
              'Verifique su conexi&#243;n a internet y recargue.</p>' +
            '<button onclick="location.reload()" style="background:linear-gradient(135deg,#2dd4bf,#0d9488);' +
            'color:#fff;border:none;border-radius:10px;padding:12px 28px;font-size:15px;' +
            'font-weight:600;cursor:pointer;">Reintentar</button>' +
          '</div>' +
        '</div>';
    }
  }

  // Iniciar el polling
  initSupabase();
})();
