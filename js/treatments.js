/**
 * CURA360 - Treatments Module (with Clinical Stage Auto-Evaluation)
 * Handles wound treatments/curaciones + triggers automatic stage evaluation
 */

(function () {
  'use strict';

  const treatments = {
    
    /**
     * Create a new treatment and trigger automatic stage evaluation
     */
    async create(woundId, data) {
      try {
        window.CURA360.setLoader(true);
        
        data.wound_id = woundId;
        data.created_at = new Date().toISOString();
        
        // Clean data - remove empty values
        const cleanData = {};
        for (const key in data) {
          if (data[key] !== null && data[key] !== '' && data[key] !== undefined) {
            cleanData[key] = data[key];
          }
        }
        
        // Ensure required fields
        if (!cleanData.wound_id || !cleanData.technique) {
          throw new Error('wound_id y technique son requeridos');
        }
        
        const { data: treatment, error } = await window.CURA360.supabase
          .from('treatments')
          .insert([cleanData])
          .select()
          .single();
          
        if (error) throw error;
        
        window.CURA360.showToast('Curación registrada correctamente');
        
        // 🆕 EVALUAR Y ACTUALIZAR CLINICAL STAGE AUTOMÁTICAMENTE
        // Esto ejecuta las reglas automáticas después de cada curación
        if (window.CURA360.wounds && window.CURA360.wounds.evaluateStage) {
          await window.CURA360.wounds.evaluateStage(woundId);
          console.log('✅ Clinical stage evaluated after treatment');
        }
        
        return treatment;
        
      } catch (err) {
        console.error('Error creating treatment:', err);
        window.CURA360.showToast('Error al registrar curación: ' + err.message);
        return null;
      } finally {
        window.CURA360.setLoader(false);
      }
    },

    /**
     * Get treatment by ID
     */
    async getById(treatmentId) {
      try {
        const { data, error } = await window.CURA360.supabase
          .from('treatments')
          .select('*')
          .eq('id', treatmentId)
          .single();
          
        if (error) throw error;
        return data;
        
      } catch (err) {
        console.error('Error getting treatment:', err);
        return null;
      }
    },

    /**
     * List treatments by wound
     */
    async listByWound(woundId) {
      try {
        const { data, error } = await window.CURA360.supabase
          .from('treatments')
          .select('*')
          .eq('wound_id', woundId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        return data || [];
        
      } catch (err) {
        console.error('Error listing treatments:', err);
        return [];
      }
    },

    /**
     * Update treatment
     */
    async update(treatmentId, updates) {
      try {
        window.CURA360.setLoader(true);
        
        const { error } = await window.CURA360.supabase
          .from('treatments')
          .update(updates)
          .eq('id', treatmentId);
          
        if (error) throw error;
        
        window.CURA360.showToast('Curación actualizada');
        return true;
        
      } catch (err) {
        console.error('Error updating treatment:', err);
        window.CURA360.showToast('Error al actualizar curación');
        return false;
      } finally {
        window.CURA360.setLoader(false);
      }
    },

    /**
     * Delete treatment
     */
    async delete(treatmentId) {
      try {
        window.CURA360.setLoader(true);
        
        const { error } = await window.CURA360.supabase
          .from('treatments')
          .delete()
          .eq('id', treatmentId);
          
        if (error) throw error;
        
        window.CURA360.showToast('Curación eliminada');
        return true;
        
      } catch (err) {
        console.error('Error deleting treatment:', err);
        window.CURA360.showToast('Error al eliminar curación');
        return false;
      } finally {
        window.CURA360.setLoader(false);
      }
    }
  };

  // Export to global namespace
  window.CURA360 = window.CURA360 || {};
  window.CURA360.treatments = treatments;

})();
