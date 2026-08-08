(function () {
  const originalSaveMedicationEdit = window.saveMedicationEdit;

  if (typeof originalSaveMedicationEdit !== 'function') {
    return;
  }

  window.saveMedicationEdit = function(id) {
    try {
      const state = getState();
      const med = state.medications.find(item => item.id === id);

      if (!med || med.cancelled) return;

      const updatedMedication = createMedicationFromForm('edit_');
      updatedMedication.active = Boolean(med.active);

      const hasChanges = Object.keys(updatedMedication).some(key =>
        JSON.stringify(med[key]) !== JSON.stringify(updatedMedication[key])
      );

      if (!hasChanges) {
        document.getElementById('editDialog')?.close();
        return;
      }
    } catch (error) {
      return originalSaveMedicationEdit(id);
    }

    return originalSaveMedicationEdit(id);
  };
})();
