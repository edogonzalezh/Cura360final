/**
 * router.js — Shared UI utilities & toast system
 * ──────────────────────────────────────────────
 * • Toast notifications (success / error / warning)
 * • Modal open/close helpers
 * • Common DOM helpers used across pages
 *
 * This module runs first (loaded before auth.js) so that
 * auth.js can call showToast() during login errors.
 */

(function () {
  'use strict';

  // ── Toast system ───────────────────────────────────
  /**
   * Displays a toast notification.
   * @param {string} message   - text to show
   * @param {string} [type]    - 'success' | 'error' | 'warning'
   * @param {number} [duration]- auto-dismiss in ms (0 = no auto-dismiss)
   */
  function showToast(message, type = 'error', duration = 3500) {
    const container = document.getElementById('toast-container')
      || _createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    // Icon map
    const icons = { success: '✓', error: '✕', warning: '⚠' };
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || '!'}</span>
      <span class="toast__text">${message}</span>
    `;

    container.appendChild(toast);

    // Trigger enter animation next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => _removeToast(toast), duration);
    }
  }

  function _removeToast(toast) {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, { once: true });
  }

  function _createToastContainer() {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  }

  // ── Modal helpers ──────────────────────────────────
  /**
   * Opens a modal by its overlay ID.
   * @param {string} overlayId - id of the .modal-overlay element
   */
  function openModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Close on backdrop click
    overlay.addEventListener('click', function onBackdrop(e) {
      if (e.target === overlay) {
        closeModal(overlayId);
        overlay.removeEventListener('click', onBackdrop);
      }
    });
  }

  /**
   * Closes a modal by its overlay ID.
   */
  function closeModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Loader overlay ─────────────────────────────────
  /**
   * Shows or hides the full-page loader.
   * @param {boolean} show
   */
  function setLoader(show) {
    const loader = document.getElementById('loader');
    if (!loader) return;
    if (show) {
      loader.classList.remove('hidden');
    } else {
      loader.classList.add('hidden');
    }
  }

  // ── Format helpers ─────────────────────────────────
  /**
   * Formats a date string to a locale-friendly display.
   * @param {string} isoString
   * @returns {string}  e.g. "15 de enero de 2025"
   */
  function formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  /**
   * Returns initials from a name string.
   * @param {string} name
   * @returns {string} e.g. "JD"
   */
  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  // ── Expose public API ──────────────────────────────
  window.CURA360 = window.CURA360 || {};
  window.CURA360.showToast  = showToast;
  window.CURA360.openModal  = openModal;
  window.CURA360.closeModal = closeModal;
  window.CURA360.setLoader  = setLoader;
  window.CURA360.formatDate = formatDate;
  window.CURA360.getInitials = getInitials;

})();
