/**
 * DeadlineWidget — Shared deadline configuration UI for all editor pages.
 *
 * Usage:
 *   1. Add <div id="deadline-widget-container"></div> in the HTML
 *   2. Add <script src="./shared/deadline-widget.js"></script>
 *   3. Call DeadlineWidget.render(allClassNames) after DOM is ready
 *   4. Call DeadlineWidget.populate(assignmentData, teacherDefaults, allClassNames) after data loads
 *   5. Call DeadlineWidget.read(allClassNames) during save to get the deadline data
 *
 * Expects: firebase, db, auth, showToast to be available globally.
 */
const DeadlineWidget = (() => {

  // ─── HTML Template ───────────────────────────────────────────────────
  function _buildSectionHTML() {
    return `
    <div id="deadline-section" class="bg-gray-800 rounded-lg mb-8 overflow-hidden">
      <div id="deadline-header" class="p-6 cursor-pointer">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-yellow-400">Class Start Times & Deadlines</h2>
          <span id="deadline-chevron" class="text-2xl transform transition-transform">▶</span>
        </div>
        <p class="text-gray-400 mt-2">Manage per-period start times and individual class deadlines to control when
          students can access and finish work.</p>
      </div>
      <div id="deadline-content" class="collapsible-content">
        <div class="px-6 pb-6">

          <!-- Deadline Behavior -->
          <div class="mb-6 bg-gray-700/30 p-4 rounded-lg border border-gray-700">
            <h3 class="font-semibold text-white mb-3">When the deadline passes…</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <label class="flex items-start gap-2 cursor-pointer bg-gray-800 p-3 rounded-lg border border-gray-600 hover:border-yellow-500 transition-colors">
                <input type="radio" name="dw-deadline-behavior" value="none" checked
                  class="mt-1 text-yellow-500 focus:ring-yellow-500 bg-gray-700 border-gray-600">
                <div>
                  <span class="font-semibold text-white">Do Nothing</span>
                  <p class="text-gray-400 text-xs mt-1">Students can still work and submit after the deadline.</p>
                </div>
              </label>
              <label class="flex items-start gap-2 cursor-pointer bg-gray-800 p-3 rounded-lg border border-gray-600 hover:border-yellow-500 transition-colors">
                <input type="radio" name="dw-deadline-behavior" value="auto-submit"
                  class="mt-1 text-yellow-500 focus:ring-yellow-500 bg-gray-700 border-gray-600">
                <div>
                  <span class="font-semibold text-white">Auto-Submit</span>
                  <p class="text-gray-400 text-xs mt-1">Automatically submit student work when the deadline passes.</p>
                </div>
              </label>
              <label class="flex items-start gap-2 cursor-pointer bg-gray-800 p-3 rounded-lg border border-gray-600 hover:border-yellow-500 transition-colors">
                <input type="radio" name="dw-deadline-behavior" value="lock-only"
                  class="mt-1 text-yellow-500 focus:ring-yellow-500 bg-gray-700 border-gray-600">
                <div>
                  <span class="font-semibold text-white">Lock Only</span>
                  <p class="text-gray-400 text-xs mt-1">Lock editing but don't submit. Students must submit manually before time runs out.</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Late Policy -->
          <div id="dw-late-policy-section" class="mb-6 bg-gray-700/30 p-4 rounded-lg border border-gray-700 hidden">
            <h3 class="font-semibold text-white mb-3">Late Submission Policy</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <select id="dw-late-policy"
                  class="w-full p-2 bg-gray-800 rounded border border-gray-600 focus:border-yellow-400 focus:outline-none text-sm">
                  <option value="allow">Allow late submissions (no penalty)</option>
                  <option value="penalize">Allow with penalty</option>
                  <option value="block">Block all late submissions</option>
                </select>
              </div>
              <div id="dw-late-penalty-config" class="hidden">
                <div class="flex items-center gap-2">
                  <label class="text-sm text-gray-400 whitespace-nowrap">Penalty:</label>
                  <input type="number" id="dw-late-penalty-percent" value="10" min="1" max="100"
                    class="w-20 p-2 bg-gray-800 border border-gray-600 rounded text-sm">
                  <span class="text-sm text-gray-400">% off total score</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Per-class toggle -->
          <div class="mb-6 bg-gray-700/30 p-4 rounded-lg border border-gray-700">
            <label class="flex items-center cursor-pointer mb-2">
              <input type="checkbox" id="dw-perClassDeadlines"
                class="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-500 bg-gray-800 border-gray-600">
              <span class="ml-3 font-semibold text-white">Specify individual deadlines by class</span>
            </label>
            <p class="text-xs text-gray-400">If unchecked, all periods share a single global deadline. If checked, each
              period can have its own start time and due date.</p>
          </div>

          <!-- Global Deadline Section -->
          <div id="dw-global-deadline-config" class="space-y-4 mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Global Due Date</label>
                <input type="date" id="dw-globalDueDate"
                  class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-yellow-500 focus:outline-none">
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Global Due Time</label>
                <input type="time" id="dw-globalDueTime"
                  class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-yellow-500 focus:outline-none">
              </div>
            </div>
          </div>

          <!-- Per-Class Deadlines (Collapsible) -->
          <div id="dw-per-class-config" class="hidden">
            <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
              <p class="text-gray-400 text-sm">Set the official start time and due date for each class period.</p>
              <button id="dw-apply-all-btn"
                class="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg text-sm">
                Apply First Class to All
              </button>
            </div>
            <div class="mb-4 bg-gray-700/40 p-3 rounded-lg border border-gray-600 flex flex-wrap items-center gap-2">
              <span class="text-sm text-gray-300 whitespace-nowrap">Quick fill: due = start +</span>
              <input type="number" id="dw-quick-fill-mins" min="0" value="50"
                class="w-20 p-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white">
              <span class="text-sm text-gray-300 whitespace-nowrap">mins for all classes</span>
              <button id="dw-quick-fill-btn"
                class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded text-sm">
                Apply
              </button>
              <span class="text-xs text-gray-500">(sets due time only; set due date separately)</span>
            </div>
            <div id="dw-class-start-times" class="flex flex-wrap gap-4"></div>
            <div class="mt-4 border-t border-gray-700 pt-4 flex justify-end">
              <button id="dw-save-defaults-btn"
                class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm">Save These
                Start Times as My Defaults</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ─── Per-class card HTML ─────────────────────────────────────────────
  function _buildClassCard(className, startDateValue, startTimeValue, dueDateValue, dueTimeValue, earlyAccess) {
    return `
    <div class="bg-gray-700 p-3 rounded-lg dw-class-card" data-class="${className}">
      <label class="block text-sm font-semibold mb-2">Period ${className}</label>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <label for="dw-start-date-${className}" class="text-xs text-gray-400 w-20">Start Date</label>
          <input type="date" id="dw-start-date-${className}" value="${startDateValue}" class="p-2 bg-gray-800 border border-gray-600 rounded text-sm">
        </div>
        <div class="flex items-center gap-2">
          <label for="dw-start-time-${className}" class="text-xs text-gray-400 w-20">Start Time</label>
          <input type="time" id="dw-start-time-${className}" value="${startTimeValue}" class="p-2 bg-gray-800 border border-gray-600 rounded w-28 text-sm">
        </div>
        <div class="flex items-center gap-2">
          <label for="dw-due-date-${className}" class="text-xs text-gray-400 w-20">Due Date</label>
          <input type="date" id="dw-due-date-${className}" value="${dueDateValue}" class="p-2 bg-gray-800 border border-gray-600 rounded text-sm">
        </div>
        <div class="flex items-center gap-2">
          <label for="dw-due-time-${className}" class="text-xs text-gray-400 w-20">Due Time</label>
          <input type="time" id="dw-due-time-${className}" value="${dueTimeValue}" class="p-2 bg-gray-800 border border-gray-600 rounded w-28 text-sm">
        </div>
        <div class="flex items-center gap-2">
          <label for="dw-early-access-padding-${className}" class="text-xs text-gray-400 w-20">Early Access (mins)</label>
          <input type="number" id="dw-early-access-padding-${className}" value="${earlyAccess}" class="p-2 bg-gray-800 border border-gray-600 rounded w-28 text-sm">
        </div>
      </div>
    </div>`;
  }

  // ─── Timestamp → form values helper ──────────────────────────────────
  function _timestampToDate(ts) {
    if (!ts) return null;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }

  function _dateToFormDate(d) {
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function _dateToFormTime(d) {
    if (!d) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ─── Attach event listeners ──────────────────────────────────────────
  function _attachListeners(allClassNames) {
    // Collapsible toggle
    document.getElementById('deadline-header').addEventListener('click', () => {
      const content = document.getElementById('deadline-content');
      const chevron = document.getElementById('deadline-chevron');
      if (content.style.maxHeight && content.style.maxHeight !== '0px') {
        content.style.maxHeight = '0';
        chevron.style.transform = 'rotate(0deg)';
      } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        chevron.style.transform = 'rotate(90deg)';
      }
    });

    // Per-class toggle
    document.getElementById('dw-perClassDeadlines').addEventListener('change', () => {
      const isChecked = document.getElementById('dw-perClassDeadlines').checked;
      document.getElementById('dw-per-class-config').classList.toggle('hidden', !isChecked);
      document.getElementById('dw-global-deadline-config').classList.toggle('hidden', isChecked);
      // Expand collapsible to fit
      const content = document.getElementById('deadline-content');
      if (content.style.maxHeight && content.style.maxHeight !== '0px') {
        content.style.maxHeight = '2000px';
      }
    });

    // Deadline behavior toggles late policy visibility
    document.querySelectorAll('input[name="dw-deadline-behavior"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const val = document.querySelector('input[name="dw-deadline-behavior"]:checked').value;
        // Show late policy only when behavior is "none" (do nothing) — since auto-submit/lock handle it
        document.getElementById('dw-late-policy-section').classList.toggle('hidden', val !== 'none');
      });
    });

    // Late policy toggle penalty input
    document.getElementById('dw-late-policy').addEventListener('change', () => {
      const val = document.getElementById('dw-late-policy').value;
      document.getElementById('dw-late-penalty-config').classList.toggle('hidden', val !== 'penalize');
    });

    // Apply First Class to All
    document.getElementById('dw-apply-all-btn').addEventListener('click', () => {
      if (allClassNames.length < 2) return;
      const first = allClassNames[0];
      const startDate = document.getElementById(`dw-start-date-${first}`)?.value || '';
      const startTime = document.getElementById(`dw-start-time-${first}`)?.value || '';
      const dueDate = document.getElementById(`dw-due-date-${first}`)?.value || '';
      const dueTime = document.getElementById(`dw-due-time-${first}`)?.value || '';
      const earlyAccess = document.getElementById(`dw-early-access-padding-${first}`)?.value || '0';

      allClassNames.forEach(cn => {
        const sd = document.getElementById(`dw-start-date-${cn}`);
        const st = document.getElementById(`dw-start-time-${cn}`);
        const dd = document.getElementById(`dw-due-date-${cn}`);
        const dt = document.getElementById(`dw-due-time-${cn}`);
        const ea = document.getElementById(`dw-early-access-padding-${cn}`);
        if (sd) sd.value = startDate;
        if (st) st.value = startTime;
        if (dd) dd.value = dueDate;
        if (dt) dt.value = dueTime;
        if (ea) ea.value = earlyAccess;
      });
      if (typeof showToast === 'function') showToast('Applied to all classes!', { color: 'green' });
    });

    // Quick fill: due = start + X mins
    document.getElementById('dw-quick-fill-btn').addEventListener('click', () => {
      const offsetMins = parseInt(document.getElementById('dw-quick-fill-mins')?.value, 10) || 0;
      if (offsetMins <= 0) {
        if (typeof showToast === 'function') showToast('Enter a positive number of minutes.', { color: 'red' });
        return;
      }
      allClassNames.forEach(cn => {
        const startTimeEl = document.getElementById(`dw-start-time-${cn}`);
        const dueTimeEl = document.getElementById(`dw-due-time-${cn}`);
        if (!startTimeEl || !dueTimeEl) return;
        const startTimeStr = startTimeEl.value;
        if (!startTimeStr) return;
        const [hours, mins] = startTimeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(mins)) return;
        const totalMins = hours * 60 + mins + offsetMins;
        const dueHours = Math.floor(totalMins / 60) % 24;
        const dueMins = totalMins % 60;
        dueTimeEl.value = `${String(dueHours).padStart(2, '0')}:${String(dueMins).padStart(2, '0')}`;
      });
      if (typeof showToast === 'function') showToast(`Due times set to start + ${offsetMins} mins!`, { color: 'green' });
    });

    // Save teacher defaults
    document.getElementById('dw-save-defaults-btn').addEventListener('click', async () => {
      try {
        const classStartTimes = {};
        allClassNames.forEach(cn => {
          const tv = document.getElementById(`dw-start-time-${cn}`)?.value;
          if (tv) classStartTimes[String(cn)] = tv;
        });
        await db.collection("teachers").doc(auth.currentUser.email).set({ classStartTimes }, { merge: true });
        if (typeof showToast === 'function') showToast("Default start times saved!", { color: 'green' });
      } catch (e) {
        console.error("Error saving teacher defaults:", e);
        if (typeof showToast === 'function') showToast("Error saving defaults.", { color: 'red' });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * render(allClassNames)
   * Injects the full deadline section HTML into #deadline-widget-container
   * and attaches event listeners.
   */
  function render(allClassNames) {
    const container = document.getElementById('deadline-widget-container');
    if (!container) { console.error('DeadlineWidget: #deadline-widget-container not found'); return; }
    container.innerHTML = _buildSectionHTML();
    _attachListeners(allClassNames);
  }

  /**
   * populate(assignmentData, teacherDefaults, allClassNames)
   * Fills all form values from loaded assignment/teacher data.
   */
  function populate(assignmentData, teacherDefaults, allClassNames) {
    const policy = assignmentData.deadlinePolicy || {};
    const hardcodedDefaults = { '1': '08:01', '2': '08:50', '5': '11:17', '7': '12:55', '8': '13:44' };

    // --- Deadline behavior ---
    const behavior = policy.deadlineBehavior || 'none';
    const behaviorRadio = document.querySelector(`input[name="dw-deadline-behavior"][value="${behavior}"]`);
    if (behaviorRadio) behaviorRadio.checked = true;
    document.getElementById('dw-late-policy-section').classList.toggle('hidden', behavior !== 'none');

    // --- Late policy ---
    const latePolicy = policy.latePolicy || 'allow';
    document.getElementById('dw-late-policy').value = latePolicy;
    document.getElementById('dw-late-penalty-config').classList.toggle('hidden', latePolicy !== 'penalize');
    document.getElementById('dw-late-penalty-percent').value = policy.latePenaltyPercent || 10;

    // --- Per-class toggle ---
    const isPerClass = (policy.perClass !== undefined) ? policy.perClass : true;
    document.getElementById('dw-perClassDeadlines').checked = isPerClass;
    document.getElementById('dw-per-class-config').classList.toggle('hidden', !isPerClass);
    document.getElementById('dw-global-deadline-config').classList.toggle('hidden', isPerClass);

    // --- Global due date ---
    const globalDue = _timestampToDate(policy.globalDueAt);
    if (globalDue) {
      document.getElementById('dw-globalDueDate').value = _dateToFormDate(globalDue);
      document.getElementById('dw-globalDueTime').value = _dateToFormTime(globalDue);
    }

    // --- Per-class cards ---
    const cardsContainer = document.getElementById('dw-class-start-times');
    cardsContainer.innerHTML = '';

    const assignmentStartTimes = policy.classStartTimes || {};
    const classDueAt = policy.classDueAt || {};
    const defaultStartTimes = (teacherDefaults || {}).classStartTimes || {};

    allClassNames.forEach(className => {
      const startTimeValue = assignmentStartTimes[className] || defaultStartTimes[className] || hardcodedDefaults[className] || '08:00';

      // Start date
      let startDateValue = '';
      const classStart = policy.classStartAt?.[className];
      const startAt = _timestampToDate(classStart);
      if (startAt) startDateValue = _dateToFormDate(startAt);

      // Due date/time
      let dueDateValue = '';
      let dueTimeValue = '';
      const classDue = classDueAt[className];
      const dueAt = _timestampToDate(classDue);
      if (dueAt) {
        dueDateValue = _dateToFormDate(dueAt);
        dueTimeValue = _dateToFormTime(dueAt);
      }

      const earlyAccess = policy.earlyAccessPadding?.[className] || 0;

      cardsContainer.innerHTML += _buildClassCard(className, startDateValue, startTimeValue, dueDateValue, dueTimeValue, earlyAccess);
    });
  }

  /**
   * read(allClassNames)
   * Reads all form values and returns an object with:
   *   { deadlinePolicy, isPerClass, globalDueAt }
   * ready to merge into the Firestore update payload.
   */
  function read(allClassNames) {
    const deadlinePolicy = {
      classStartTimes: {},
      classStartAt: {},
      classDueAt: {},
      earlyAccessPadding: {}
    };

    // Deadline behavior
    const behavior = document.querySelector('input[name="dw-deadline-behavior"]:checked')?.value || 'none';
    deadlinePolicy.deadlineBehavior = behavior;

    // Late policy
    const latePolicy = document.getElementById('dw-late-policy')?.value || 'allow';
    deadlinePolicy.latePolicy = latePolicy;
    if (latePolicy === 'penalize') {
      deadlinePolicy.latePenaltyPercent = parseInt(document.getElementById('dw-late-penalty-percent')?.value, 10) || 10;
    }

    // Per-class data
    allClassNames.forEach(className => {
      const startTimeValue = document.getElementById(`dw-start-time-${className}`)?.value || '';
      const startDateValue = document.getElementById(`dw-start-date-${className}`)?.value || '';

      if (startTimeValue) {
        deadlinePolicy.classStartTimes[String(className)] = startTimeValue;
      }

      // Build per-class start Timestamp
      if (startDateValue && startTimeValue) {
        const dateParts = startDateValue.split('-');
        const timeParts = startTimeValue.split(':');
        if (dateParts.length === 3 && timeParts.length >= 2) {
          const [year, month, day] = dateParts.map(Number);
          const [hour, minute] = timeParts.map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
            const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
            deadlinePolicy.classStartAt[String(className)] = firebase.firestore.Timestamp.fromDate(localDate);
          }
        }
      }

      // Build per-class due Timestamp
      const dueDateStr = document.getElementById(`dw-due-date-${className}`)?.value || '';
      const dueTimeStr = document.getElementById(`dw-due-time-${className}`)?.value || '';
      if (dueDateStr && dueTimeStr) {
        const dateParts = dueDateStr.split('-');
        const timeParts = dueTimeStr.split(':');
        if (dateParts.length === 3 && timeParts.length >= 2) {
          const [year, month, day] = dateParts.map(Number);
          const [hour, minute] = timeParts.map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
            const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
            deadlinePolicy.classDueAt[String(className)] = firebase.firestore.Timestamp.fromDate(localDate);
          }
        }
      }

      // Early access padding
      const paddingValue = parseInt(document.getElementById(`dw-early-access-padding-${className}`)?.value, 10) || 0;
      deadlinePolicy.earlyAccessPadding[String(className)] = paddingValue;
    });

    // Per-class & global
    const isPerClass = document.getElementById('dw-perClassDeadlines')?.checked || false;

    const globalDueDateStr = document.getElementById('dw-globalDueDate')?.value || '';
    const globalDueTimeStr = document.getElementById('dw-globalDueTime')?.value || '';
    let globalDueAt = null;

    if (globalDueDateStr && globalDueTimeStr) {
      const dateParts = globalDueDateStr.split('-');
      const timeParts = globalDueTimeStr.split(':');
      if (dateParts.length === 3 && timeParts.length >= 2) {
        const [year, month, day] = dateParts.map(Number);
        const [hour, minute] = timeParts.map(Number);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
          globalDueAt = firebase.firestore.Timestamp.fromDate(new Date(year, month - 1, day, hour, minute, 0, 0));
        }
      }
    }

    return { deadlinePolicy, isPerClass, globalDueAt };
  }

  /**
   * applyToSavePayload(updatePayload, allClassNames)
   * Convenience: reads the widget and merges all deadline fields
   * into the provided updatePayload object using dot-notation for
   * Firestore-safe updates.
   */
  function applyToSavePayload(updatePayload, allClassNames) {
    const { deadlinePolicy, isPerClass, globalDueAt } = read(allClassNames);

    // Merge the core deadlinePolicy (per-question fields are handled separately by each editor)
    // We set the top-level deadline policy fields
    updatePayload.deadlinePolicy = Object.assign(updatePayload.deadlinePolicy || {}, deadlinePolicy);

    // Use dot notation for atomic fields that may need FieldValue.delete()
    updatePayload["deadlinePolicy.perClass"] = isPerClass;
    updatePayload["deadlinePolicy.deadlineBehavior"] = deadlinePolicy.deadlineBehavior;
    updatePayload["deadlinePolicy.latePolicy"] = deadlinePolicy.latePolicy;
    if (deadlinePolicy.latePenaltyPercent !== undefined) {
      updatePayload["deadlinePolicy.latePenaltyPercent"] = deadlinePolicy.latePenaltyPercent;
    }

    if (globalDueAt) {
      updatePayload["deadlinePolicy.globalDueAt"] = globalDueAt;
    } else {
      updatePayload["deadlinePolicy.globalDueAt"] = firebase.firestore.FieldValue.delete();
    }

    return updatePayload;
  }

  // Expose public API
  return { render, populate, read, applyToSavePayload };
})();
