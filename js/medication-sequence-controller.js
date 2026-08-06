(function () {
  let listenersInstalled = false;

  function setSequenceTarget(element, target, eventType = 'focus') {
    if (!element) return;
    element.dataset.medSequenceTarget = target;
    element.dataset.medSequenceEvent = eventType;
    element.removeAttribute('onfocus');
  }

  function findButtonByInlineCall(callText) {
    return [...document.querySelectorAll('button[onclick]')]
      .find(button => button.getAttribute('onclick')?.includes(callText));
  }

  function prepareCreateMedicationForm() {
    const focusTargets = {
      create_contentValue: 'contentValue',
      create_contentUnit: 'contentUnit',
      create_contentUnitOther: 'contentUnitOther',
      create_intakeQuantity: 'intakeQuantity',
      create_intakeUnit: 'intakeUnit',
      create_intakeUnitOther: 'intakeUnitOther',
      create_details: 'details',
      create_timeHour: 'scheduleType',
      create_timeMinute: 'scheduleType',
      create_datePicker: 'explicitDates',
      create_startDate: 'startDate',
      create_endDate: 'endDate'
    };

    Object.entries(focusTargets).forEach(([id, target]) => {
      setSequenceTarget(document.getElementById(id), target);
    });

    const scheduleSelect = document.getElementById('create_scheduleType');
    if (scheduleSelect) {
      scheduleSelect.dataset.medSequenceTarget = 'scheduleType';
      scheduleSelect.dataset.medSequenceEvent = 'change';
      scheduleSelect.dataset.medSequenceAction = 'schedule-change';
      scheduleSelect.dataset.previousValue ||= scheduleSelect.value || 'daily';
      scheduleSelect.removeAttribute('onchange');
    }

    document
      .querySelectorAll('input[data-prefix="create_"][data-weekday]')
      .forEach(input => {
        input.dataset.medSequenceTarget = 'weekdays';
        input.dataset.medSequenceEvent = 'click';
        input.dataset.medSequenceAction = 'weekday-toggle';
        input.removeAttribute('onclick');
      });

    const addTimeButton = findButtonByInlineCall("addStructuredTime('create_')");
    if (addTimeButton) {
      addTimeButton.dataset.medSequenceTarget = 'scheduleType';
      addTimeButton.dataset.medSequenceEvent = 'click';
      addTimeButton.dataset.medSequenceAction = 'add-time';
      addTimeButton.removeAttribute('onclick');
    }

    const addDateButton = findButtonByInlineCall("addStructuredDate('create_')");
    if (addDateButton) {
      addDateButton.dataset.medSequenceTarget = 'explicitDates';
      addDateButton.dataset.medSequenceEvent = 'click';
      addDateButton.dataset.medSequenceAction = 'add-date';
      addDateButton.removeAttribute('onclick');
    }

    const submitButton = findButtonByInlineCall('createMedication()');
    if (submitButton) {
      submitButton.dataset.medSequenceTarget = 'submit';
      submitButton.dataset.medSequenceEvent = 'click';
      submitButton.dataset.medSequenceAction = 'submit';
      submitButton.removeAttribute('onclick');
    }
  }

  function closestSequenceElement(event) {
    return event.target?.closest?.('[data-med-sequence-target]') || null;
  }

  function guard(element) {
    return window.guardMedicationSequence(
      'create_',
      element.dataset.medSequenceTarget
    );
  }

  function handleFocus(event) {
    const element = closestSequenceElement(event);
    if (!element || element.dataset.medSequenceEvent !== 'focus') return;

    if (!guard(element)) {
      window.setTimeout(() => element.blur(), 0);
    }
  }

  function handleClick(event) {
    const element = closestSequenceElement(event);
    if (!element || element.dataset.medSequenceEvent !== 'click') return;

    if (!guard(element)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const action = element.dataset.medSequenceAction;

    if (action === 'add-time') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.addStructuredTime('create_');
    } else if (action === 'add-date') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.addStructuredDate('create_');
    } else if (action === 'submit') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.createMedication();
    }
  }

  function handleChange(event) {
    const element = closestSequenceElement(event);
    if (!element || element.dataset.medSequenceEvent !== 'change') return;
    if (element.dataset.medSequenceAction !== 'schedule-change') return;

    const previousValue = element.dataset.previousValue || 'daily';

    if (!guard(element)) {
      element.value = previousValue;
      window.syncCreateScheduleFields();
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    element.dataset.previousValue = element.value;
    window.syncCreateScheduleFields();
  }

  function installListeners() {
    if (listenersInstalled) return;

    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('change', handleChange, true);

    listenersInstalled = true;
  }

  function initializeController() {
    installListeners();
    prepareCreateMedicationForm();
  }

  const originalMount = window.mount;

  window.mount = function (...args) {
    const result = originalMount.apply(this, args);

    if (args[0] === 'input') {
      window.setTimeout(initializeController, 0);
    }

    return result;
  };
})();
