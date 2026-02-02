/**
 * CURA360 - Wounds Module (Enhanced with Clinical Stage)
 * Handles wound CRUD + automatic stage evaluation
 */

(function () {
  'use strict';

  const wounds = {
    
    /**
     * Create a new wound with automatic stage evaluation
     */
    async create(patientId, data) {
      try {
        window.CURA360.setLoader(true);
        
        // Set initial stage
        data.clinical_stage = 'valoracion_inicial';
        data.patient_id = patientId;
        
        // Clean data
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
        
        const { data: wound, error } = await window.supabase
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
     * Evaluate and update clinical stage automatically
     * Called after each treatment is registered
     */
    async evaluateStage(woundId) {
      try {
        // Get wound data
        const wound = await this.getById(woundId);
        if (!wound) return null;
        
        // Get treatments count and last treatment
        const treatments = await window.CURA360.treatments.listByWound(woundId);
        const treatmentCount = treatments.length;
        const lastTreatment = treatments[0]; // Ordered by date DESC
        
        // Calculate days since creation
        const createdDate = new Date(wound.created_at);
        const today = new Date();
        const daysSinceCreation = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
        
        // Determine new stage based on rules
        let newStage = wound.clinical_stage;
        
        // RULE 1: Valoración inicial
        if (treatmentCount === 0 && daysSinceCreation < 1) {
          newStage = 'valoracion_inicial';
        }
        
        // RULE 2: Tratamiento en curso
        else if (treatmentCount >= 1 && treatmentCount <= 3 && !wound.infection_signs) {
          newStage = 'tratamiento_en_curso';
        }
        
        // RULE 3: Bajo observación (ALERT)
        else if (
          wound.infection_signs === 'si' || 
          (wound.pain_scale && wound.pain_scale > 7) ||
          (daysSinceCreation > 14 && treatmentCount > 5 && this._noImprovement(wound, treatments))
        ) {
          newStage = 'bajo_observacion';
        }
        
        // RULE 4: Evolución favorable
        else if (
          treatmentCount > 3 &&
          !wound.infection_signs &&
          (wound.pain_scale === null || wound.pain_scale <= 5) &&
          this._showsImprovement(wound, treatments)
        ) {
          newStage = 'evolucion_favorable';
        }
        
        // RULE 5: Alta clínica (mostly manual, but can auto-suggest)
        else if (
          wound.length_cm && wound.width_cm &&
          wound.length_cm < 1 && wound.width_cm < 1 &&
          wound.exudate_amount === 'escaso' &&
          (!wound.pain_scale || wound.pain_scale <= 2) &&
          wound.infection_signs !== 'si'
        ) {
          newStage = 'alta_clinica';
        }
        
        // Update if stage changed
        if (newStage !== wound.clinical_stage) {
          await this.updateStage(woundId, newStage);
          console.log(`Wound ${woundId} stage updated: ${wound.clinical_stage} → ${newStage}`);
        }
        
        return newStage;
        
      } catch (err) {
        console.error('Error evaluating stage:', err);
        return null;
      }
    },

    /**
     * Manually update clinical stage (override automatic)
     */
    async updateStage(woundId, newStage) {
      try {
        const { error } = await window.supabase
          .from('wounds')
          .update({ clinical_stage: newStage })
          .eq('id', woundId);
          
        if (error) throw error;
        return true;
        
      } catch (err) {
        console.error('Error updating stage:', err);
        return false;
      }
    },

    /**
     * Helper: Check if wound shows improvement
     */
    _showsImprovement(wound, treatments) {
      if (treatments.length < 2) return false;
      
      // Check if exudate is decreasing
      if (wound.exudate_amount === 'escaso' || wound.exudate_amount === 'moderado') {
        return true;
      }
      
      // Check if pain is decreasing
      if (wound.pain_scale !== null && wound.pain_scale <= 4) {
        return true;
      }
      
      // Check if size is decreasing (would need measurement history)
      // For now, assume improvement if measurements are small
      if (wound.length_cm && wound.width_cm) {
        if (wound.length_cm < 5 && wound.width_cm < 5) {
          return true;
        }
      }
      
      return false;
    },

    /**
     * Helper: Check if wound shows no improvement
     */
    _noImprovement(wound, treatments) {
      // If still has abundant exudate after 2+ weeks
      if (wound.exudate_amount === 'abundante') return true;
      
      // If pain hasn't decreased
      if (wound.pain_scale && wound.pain_scale > 6) return true;
      
      // If measurements haven't decreased (simplified check)
      if (wound.length_cm && wound.width_cm) {
        if (wound.length_cm > 8 || wound.width_cm > 8) return true;
      }
      
      return false;
    },

    /**
     * Get wound by ID
     */
    async getById(woundId) {
      try {
        const { data, error } = await window.supabase
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
        const { data, error } = await window.supabase
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
     * List all wounds (for global wound view)
     */
    async listAll() {
      try {
        const { data, error } = await window.supabase
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
     * Update wound data
     */
    async update(woundId, updates) {
      try {
        window.CURA360.setLoader(true);
        
        const { error } = await window.supabase
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
        
        const { error } = await window.supabase
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
