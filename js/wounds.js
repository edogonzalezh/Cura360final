/**
 * CURA360 - Wounds Module
 * Gestión de heridas con campos clínicos extendidos
 */

(function () {
  'use strict';

  const wounds = {
    
    /**
     * Create a new wound
     */
    async create(patientId, data) {
      try {
        window.CURA360.setLoader(true);
        
        // Set default clinical_stage if not provided
        if (!data.clinical_stage) {
          data.clinical_stage = 'valoracion_inicial';
        }
        
        data.patient_id = patientId;
        
        // Clean data - remove empty values
        const cleanData = {};
        for (const key in data) {
          if (data[key] !== null && data[key] !== '' && data[key] !== undefined) {
            cleanData[key] = data[key];
          }
        }
        
        // Ensure required fields
        if (!cleanData.patient_id) {
          throw new Error('patient_id es requerido');
        }
        
        const { data: wound, error } = await window.CURA360.supabase
          .from('wounds')
          .insert([cleanData])
          .select()
          .single();
          
        if (error) throw error;
        
        window.CURA360.showToast('Herida registrada correctamente');
        return wound;
        
      } catch (err) {
        console.error('Error creating wound:', err);
        window.CURA360.showToast('Error al crear herida: ' + err.message);
        return null;
      } finally {
        window.CURA360.setLoader(false);
      }
    },

    /**
     * Get wound by ID
     */
    async getById(woundId) {
      try {
        const { data, error } = await window.CURA360.supabase
          .from('wounds')
          .select('*')
          .eq('id', woundId)
          .single();
          
        if (error) throw error;
        return data;
        
      } catch (err) {
        console.error('Error getting wound:', err);
        return null;
      }
    },

    /**
     * List wounds by patient
     */
    async listByPatient(patientId) {
      try {
        const { data, error } = await window.CURA360.supabase
          .from('wounds')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        return data || [];
        
      } catch (err) {
        console.error('Error listing wounds:', err);
        return [];
      }
    },

    /**
     * List all wounds
     */
    async listAll() {
      try {
        const { data, error } = await window.CURA360.supabase
          .from('wounds')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        return data || [];
        
      } catch (err) {
        console.error('Error listing all wounds:', err);
        return [];
      }
    },

    /**
     * Update wound
     */
    async update(woundId, updates) {
      try {
        window.CURA360.setLoader(true);
        
        const { error } = await window.CURA360.supabase
          .from('wounds')
          .update(updates)
          .eq('id', woundId);
          
        if (error) throw error;
        
        window.CURA360.showToast('Herida actualizada');
        return true;
        
      } catch (err) {
        console.error('Error updating wound:', err);
        window.CURA360.showToast('Error al actualizar herida');
        return false;
      } finally {
        window.CURA360.setLoader(false);
      }
    },

    /**
     * Delete wound
     */
    async delete(woundId) {
      try {
        window.CURA360.setLoader(true);
        
        const { error } = await window.CURA360.supabase
          .from('wounds')
          .delete()
          .eq('id', woundId);
          
        if (error) throw error;
        
        window.CURA360.showToast('Herida eliminada');
        return true;
        
      } catch (err) {
        console.error('Error deleting wound:', err);
        window.CURA360.showToast('Error al eliminar herida');
        return false;
      } finally {
        window.CURA360.setLoader(false);
      }
    }
  };

  // Export to global namespace
  window.CURA360 = window.CURA360 || {};
  window.CURA360.wounds = wounds;

})();
