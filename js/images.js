/**
 * images.js — Wound Images Management
 * ────────────────────────────────────
 * Handles image upload, compression, storage, and gallery display.
 * Uses Supabase Storage for files and wound_images table for metadata.
 *
 * Public API (window.CURA360.images):
 *   upload(woundId, file, notes)     → Promise<object>
 *   list(woundId)                    → Promise<object[]>
 *   delete(imageId, storagePath)     → Promise<boolean>
 *   getSignedUrl(storagePath)        → Promise<string>
 */

(function () {
  'use strict';

  const sb = window.CURA360.supabase;
  const SUPABASE_URL = 'https://ghzfnosevncivblpbful.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_zLely_K2mNNHQv82YeV40A_-Tj1XLDg';
  const STORAGE_KEY = 'sb-ghzfnosevncivblpbful-auth-token';
  const BUCKET_NAME = 'wounds';  // ← IMPORTANTE: debe coincidir con el bucket creado

  // ── Helper: get auth token ───────────────────────────
  function getToken() {
    const sessionData = localStorage.getItem(STORAGE_KEY);
    if (!sessionData) return null;
    try {
      const session = JSON.parse(sessionData);
      return session.access_token;
    } catch (err) {
      console.error('[images] Error parsing session:', err);
      return null;
    }
  }

  // ── Compress image before upload ─────────────────────
  /**
   * Compresses image if larger than maxSizeMB
   * @param {File} file - original image file
   * @param {number} maxSizeMB - max size in MB (default 2)
   * @param {number} quality - compression quality 0-1 (default 0.85)
   * @returns {Promise<Blob>}
   */
  async function compressImage(file, maxSizeMB = 2, quality = 0.85) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    // Si ya es pequeño, no comprimir
    if (file.size <= maxSizeBytes) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Reducir dimensiones si es muy grande
          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log('[images] Compressed:', 
                  `${(file.size / 1024 / 1024).toFixed(2)}MB → ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                resolve(blob);
              } else {
                reject(new Error('Compression failed'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = e.target.result;
      };
      
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  // ── Upload image ─────────────────────────────────────
  /**
   * Uploads image to Supabase Storage and saves metadata
   * @param {string} woundId
   * @param {File} file
   * @param {string} notes - optional notes about the image
   * @returns {Promise<object>} image metadata
   */
  async function upload(woundId, file, notes = '') {
    const token = getToken();
    if (!token) {
      window.CURA360.showToast('Sesión expirada. Inicie sesión de nuevo.');
      return null;
    }

    const user = window.CURA360.auth.getCurrentUser();
    if (!user) {
      window.CURA360.showToast('Usuario no autenticado.');
      return null;
    }

    try {
      console.log('[images] Starting upload...');
      
      // Comprimir imagen
      const compressedBlob = await compressImage(file);
      
      // Generar nombre único
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `${timestamp}.${extension}`;
      const storagePath = `${woundId}/${fileName}`;

      console.log('[images] Uploading to:', storagePath);

      // Subir a Storage usando fetch directo
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${storagePath}`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'apikey': SUPABASE_KEY,
          'Content-Type': file.type || 'image/jpeg'
        },
        body: compressedBlob
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        console.error('[images] Upload failed:', error);
        window.CURA360.showToast('Error al subir imagen.');
        return null;
      }

      console.log('[images] Upload successful, saving metadata...');

      // Guardar metadata en tabla
      const metadata = {
        wound_id: woundId,
        storage_path: storagePath,
        file_size: compressedBlob.size,
        uploaded_by: user.id,
        notes: notes,
        created_at: new Date().toISOString()
      };

      const metadataResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/wound_images`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(metadata)
        }
      );

      if (!metadataResponse.ok) {
        console.error('[images] Metadata save failed');
        window.CURA360.showToast('Error al guardar metadata de imagen.');
        return null;
      }

      const savedMetadata = await metadataResponse.json();
      console.log('[images] Metadata saved:', savedMetadata[0].id);
      
      window.CURA360.showToast('Imagen agregada exitosamente.', 'success');
      return savedMetadata[0];
      
    } catch (err) {
      console.error('[images] upload error:', err);
      window.CURA360.showToast('Error al subir imagen.');
      return null;
    }
  }

  // ── List images for a wound ──────────────────────────
  /**
   * @param {string} woundId
   * @returns {Promise<object[]>}
   */
  async function list(woundId) {
    const token = getToken();
    if (!token) return [];

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/wound_images?wound_id=eq.${woundId}&select=*&order=created_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('[images] list HTTP error:', response.status);
        return [];
      }

      return await response.json();
    } catch (err) {
      console.error('[images] list error:', err);
      return [];
    }
  }

  // ── Delete image ─────────────────────────────────────
  /**
   * Deletes image from storage and metadata
   * @param {string} imageId - wound_images.id
   * @param {string} storagePath
   * @returns {Promise<boolean>}
   */
  async function deleteImage(imageId, storagePath) {
    const token = getToken();
    if (!token) return false;

    try {
      // Delete from storage
      const storageUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${storagePath}`;
      
      await fetch(storageUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token,
          'apikey': SUPABASE_KEY
        }
      });

      // Delete metadata
      const metadataUrl = `${SUPABASE_URL}/rest/v1/wound_images?id=eq.${imageId}`;
      
      const response = await fetch(metadataUrl, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + token
        }
      });

      if (response.ok) {
        window.CURA360.showToast('Imagen eliminada.', 'success');
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('[images] delete error:', err);
      window.CURA360.showToast('Error al eliminar imagen.');
      return false;
    }
  }

  // ── Get signed URL for viewing ───────────────────────
  /**
   * Gets a temporary signed URL for viewing private images
   * @param {string} storagePath
   * @returns {Promise<string|null>}
   */
  async function getSignedUrl(storagePath) {
    const token = getToken();
    if (!token) return null;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET_NAME}/${storagePath}`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'apikey': SUPABASE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expiresIn: 3600 }) // 1 hour
        }
      );

      if (!response.ok) {
        console.error('[images] getSignedUrl failed:', response.status);
        return null;
      }

      const data = await response.json();
      return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
    } catch (err) {
      console.error('[images] getSignedUrl error:', err);
      return null;
    }
  }

  // ── Expose ───────────────────────────────────────────
  window.CURA360.images = {
    upload,
    list,
    delete: deleteImage,
    getSignedUrl
  };

  console.log('[images] Module loaded');

})();
