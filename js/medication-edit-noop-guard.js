(function () {
  const originalSaveMedicationEdit = window.saveMedicationEdit;

  if (typeof originalSaveMedicationEdit !== 'function') {
    return;
  }

  const normalizeMedicationForEditComparison = med => ({
    name: med.name || '',
    manufacturer: med.manufacturer || '',
    contentValue: med.contentValue || '',
    contentUnit: med.contentUnit || '',
    contentUnitOther: med.contentUnitOther || '',
    intakeQuantity: med.intakeQuantity || '',
    intakeUnit: med.intakeUnit || '',
    intakeUnitOther: med.intakeUnitOther || '',
    details: med.details || '',
    scheduleType: med.scheduleType || 'daily',
    times: Array.isArray(med.times) ? [...med.times].sort() : [],
    startDate: med.startDate || '',
    endDate: med.endDate || '',
    active: Boolean(med.active),
    weekdays: Array.isArray(med.weekdays) ? [...med.weekdays].sort() : [],
    explicitDates: Array.isArray(med.explicitDates) ? [...med.explicitDates].sort() : []
  });

  window.saveMedicationEdit = function(id) {
    try {
      const state = getState();
      const med = state.medications.find(item => item.id === id);

      if (!med || med.cancelled) return;

      const updatedMedication = createMedicationFromForm('edit_');
      updatedMedication.active = Boolean(med.active);

      const before = normalizeMedicationForEditComparison(med);
      const after = normalizeMedicationForEditComparison(updatedMedication);

      if (JSON.stringify(before) === JSON.stringify(after)) {
        document.getElementById('editDialog')?.close();
        return;
      }
    } catch (error) {
      return originalSaveMedicationEdit(id);
    }

    return originalSaveMedicationEdit(id);
  };
})();
