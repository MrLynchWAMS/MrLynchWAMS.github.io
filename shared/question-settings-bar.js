/**
 * QuestionSettingsBar — Shared "Quick Settings" panel for all editor pages.
 *
 * Usage:
 *   1. Add <div id="question-settings-bar-container" class="mb-6"></div> in the HTML
 *   2. Add <script src="./shared/question-settings-bar.js"></script>
 *   3. Call QuestionSettingsBar.init(options) after questions are rendered
 *
 * options:
 *   container        - HTMLElement mount point
 *   getQuestionCount - Function returning number of questions
 *   getAssignmentData - Function returning live assignmentData object
 *   onUpdate         - Function called after any change (for marking dirty)
 *   editorType       - 'slides' | 'pdf' | 'simulation' | 'video' (for labeling)
 *
 * No Firestore writes — DOM input changes are picked up by each editor's
 * existing saveAssignment() function.
 */
const QuestionSettingsBar = (() => {

  // ─── HTML Template ───────────────────────────────────────────────────
  function _buildHTML() {
    return `
    <div id="qsb-section" class="bg-gray-800 rounded-lg mb-8 overflow-hidden border border-yellow-900/20">
      <div id="qsb-header" class="p-6 cursor-pointer">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-yellow-400">⚙ Quick Settings</h2>
          <span id="qsb-chevron" class="text-2xl transform transition-transform">▶</span>
        </div>
        <p class="text-gray-400 mt-2">Apply common attempt settings across all questions at once.</p>
      </div>
      <div id="qsb-content" class="collapsible-content">
        <div class="px-6 pb-6">

          <!-- Attempt Settings Panel -->
          <div class="bg-gray-700/30 p-4 rounded-lg border border-gray-700 mb-4">
            <h3 class="font-semibold text-white mb-3">Attempt Settings</h3>
            <div class="mb-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="qsb-attempts-enabled" class="w-4 h-4 text-yellow-500 rounded bg-gray-700 border-gray-600">
                <span class="text-sm font-medium text-white">Enable Attempt Tracking</span>
              </label>
            </div>
            <div id="qsb-attempts-config" class="space-y-3 hidden">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <label class="block text-gray-400 mb-1">Max Attempts <span class="text-xs text-gray-500">(0=unlimited)</span></label>
                  <input type="number" id="qsb-max-attempts" value="5" min="0" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                </div>
                <div>
                  <label class="block text-gray-400 mb-1">Deduction per Attempt <span class="text-xs text-gray-500">(pts)</span></label>
                  <input type="number" id="qsb-deduction" value="0" min="0" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                </div>
                <div>
                  <label class="block text-gray-400 mb-1">Show Help After <span class="text-xs text-gray-500">(blank=never)</span></label>
                  <input type="number" id="qsb-show-help" placeholder="e.g. 3" min="1" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                </div>
                <div>
                  <label class="block text-gray-400 mb-1">Time Limit <span class="text-xs text-gray-500">(mins, 0=none)</span></label>
                  <input type="number" id="qsb-deadline-minutes" value="0" min="0" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                </div>
              </div>
              <div class="flex flex-wrap gap-4 text-sm">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="qsb-retain-best" checked class="w-4 h-4 text-yellow-500 rounded bg-gray-700 border-gray-600">
                  <span class="text-gray-300">Retain Best Score</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="qsb-lock-on-max" class="w-4 h-4 text-yellow-500 rounded bg-gray-700 border-gray-600">
                  <span class="text-gray-300">Lock When Max Reached</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="qsb-case-sensitive" class="w-4 h-4 text-yellow-500 rounded bg-gray-700 border-gray-600">
                  <span class="text-gray-300">Case Sensitive</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="qsb-punctuation-sensitive" class="w-4 h-4 text-yellow-500 rounded bg-gray-700 border-gray-600">
                  <span class="text-gray-300">Punctuation Sensitive</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Apply Controls -->
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <button id="qsb-apply-btn" class="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg text-sm">
              Apply to All Questions
            </button>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="qsb-auto-sync" class="w-4 h-4 text-green-500 rounded bg-gray-700 border-gray-600">
              <span class="text-sm text-gray-300">Auto-sync: apply changes instantly to all questions</span>
            </label>
          </div>

          <!-- Modifications Quick-Edit -->
          <div class="border-t border-gray-700 pt-4">
            <button type="button" id="qsb-mods-toggle" class="text-sm text-purple-400 hover:text-purple-300 font-medium">
              ▶ 🧩 Special Ed. Modifications (quick edit)
            </button>
            <div id="qsb-mods-content" class="hidden mt-3 bg-gray-700/30 p-4 rounded-lg border border-purple-900/30">
              <div class="mb-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="qsb-mods-enabled" class="w-4 h-4 text-purple-500 rounded bg-gray-700 border-gray-600">
                  <span class="text-sm font-semibold text-white">Enable Modifications for this Assignment</span>
                </label>
              </div>
              <div id="qsb-mods-fields" class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm hidden">
                <div>
                  <label class="block text-gray-400 mb-1">Time Multiplier</label>
                  <input type="number" id="qsb-mod-time-multiplier" value="1.5" min="1" step="0.1" class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white">
                </div>
                <div>
                  <label class="block text-gray-400 mb-1">Penalty Multiplier</label>
                  <input type="number" id="qsb-mod-penalty-multiplier" value="0.5" min="0" max="1" step="0.1" class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white">
                </div>
                <div>
                  <label class="block text-gray-400 mb-1">Attempts Bonus</label>
                  <input type="number" id="qsb-mod-attempts-bonus" value="2" min="0" class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white">
                </div>
                <div>
                  <label class="block text-gray-400 mb-1">Help Threshold</label>
                  <input type="number" id="qsb-mod-help-threshold" value="1" min="1" class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white">
                </div>
                <div class="flex flex-col gap-2 pt-1">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="qsb-mod-ignore-deduction" class="w-4 h-4 text-purple-500 rounded bg-gray-800 border-gray-600">
                    <span class="text-gray-300">Ignore Attempt Penalty</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="qsb-mod-fuzzy" class="w-4 h-4 text-purple-500 rounded bg-gray-800 border-gray-600">
                    <span class="text-gray-300">Allow Fuzzy Spelling</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>`;
  }

  // ─── Read panel values ────────────────────────────────────────────────
  function _readPanelValues() {
    return {
      attemptsEnabled: document.getElementById('qsb-attempts-enabled')?.checked || false,
      maxAttempts: parseInt(document.getElementById('qsb-max-attempts')?.value, 10) || 0,
      deduction: parseInt(document.getElementById('qsb-deduction')?.value, 10) || 0,
      retainBestScore: document.getElementById('qsb-retain-best')?.checked !== false,
      lockOnMax: document.getElementById('qsb-lock-on-max')?.checked || false,
      caseSensitive: document.getElementById('qsb-case-sensitive')?.checked || false,
      punctuationSensitive: document.getElementById('qsb-punctuation-sensitive')?.checked || false,
      showHelpAfter: document.getElementById('qsb-show-help')?.value ? parseInt(document.getElementById('qsb-show-help').value, 10) : null,
      deadlineMinutes: parseInt(document.getElementById('qsb-deadline-minutes')?.value, 10) || 0,
    };
  }

  // ─── Apply to all questions ───────────────────────────────────────────
  function _applyToAllQuestions(opts) {
    const count = opts.getQuestionCount();
    if (count === 0) {
      if (typeof window.showToast === 'function') window.showToast('No questions to apply settings to.', { color: 'orange' });
      return;
    }
    const v = _readPanelValues();
    for (let i = 0; i < count; i++) {
      const enabledEl = document.getElementById(`attempts-enabled-${i}`);
      const configDiv = document.getElementById(`attempt-config-${i}`);
      if (enabledEl) {
        enabledEl.checked = v.attemptsEnabled;
        enabledEl.dispatchEvent(new Event('change'));
      }
      if (configDiv) configDiv.classList.toggle('hidden', !v.attemptsEnabled);
      if (v.attemptsEnabled) {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) { el.value = val; el.dispatchEvent(new Event('change')); } };
        const setChk = (id, val) => { const el = document.getElementById(id); if (el) { el.checked = val; el.dispatchEvent(new Event('change')); } };
        setVal(`attempts-max-${i}`, v.maxAttempts);
        setVal(`attempts-deduction-${i}`, v.deduction);
        setChk(`attempts-retain-best-${i}`, v.retainBestScore);
        setChk(`attempts-lock-${i}`, v.lockOnMax);
        setVal(`attempts-show-help-${i}`, v.showHelpAfter || '');
        setChk(`attempts-case-sensitive-${i}`, v.caseSensitive);
        setChk(`attempts-punctuation-sensitive-${i}`, v.punctuationSensitive);
        setVal(`deadline-minutes-${i}`, v.deadlineMinutes);
      }
    }
    if (typeof window.showToast === 'function') window.showToast(`Applied to all ${count} questions!`, { color: 'green' });
    opts.onUpdate(opts.getAssignmentData());
  }

  // ─── Init panel from first question's current values ─────────────────
  function _initFromFirstQuestion(opts) {
    const count = opts.getQuestionCount();
    if (count === 0) return;
    const enabledEl = document.getElementById('attempts-enabled-0');
    if (!enabledEl) return;
    const isEnabled = enabledEl.checked;
    const qsbEnabled = document.getElementById('qsb-attempts-enabled');
    if (qsbEnabled) qsbEnabled.checked = isEnabled;
    const qsbConfig = document.getElementById('qsb-attempts-config');
    if (qsbConfig) qsbConfig.classList.toggle('hidden', !isEnabled);
    if (isEnabled) {
      const readVal = (id) => document.getElementById(id)?.value || '';
      const readChk = (id) => document.getElementById(id)?.checked || false;
      const setQsb = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      const setQsbChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
      setQsb('qsb-max-attempts', readVal('attempts-max-0'));
      setQsb('qsb-deduction', readVal('attempts-deduction-0'));
      setQsbChk('qsb-retain-best', readChk('attempts-retain-best-0'));
      setQsbChk('qsb-lock-on-max', readChk('attempts-lock-0'));
      setQsb('qsb-show-help', readVal('attempts-show-help-0'));
      setQsbChk('qsb-case-sensitive', readChk('attempts-case-sensitive-0'));
      setQsbChk('qsb-punctuation-sensitive', readChk('attempts-punctuation-sensitive-0'));
      setQsb('qsb-deadline-minutes', readVal('deadline-minutes-0'));
    }
  }

  // ─── Init modifications quick-edit from main section ─────────────────
  function _initModsFromMain() {
    const fields = [
      ['modificationsEnabled',  'qsb-mods-enabled',           'checked'],
      ['modTimeMultiplier',     'qsb-mod-time-multiplier',    'value'],
      ['modPenaltyMultiplier',  'qsb-mod-penalty-multiplier', 'value'],
      ['modAttemptsBonus',      'qsb-mod-attempts-bonus',     'value'],
      ['modHelpThreshold',      'qsb-mod-help-threshold',     'value'],
      ['modIgnoreDeduction',    'qsb-mod-ignore-deduction',   'checked'],
      ['modFuzzyMatch',         'qsb-mod-fuzzy',              'checked'],
    ];
    fields.forEach(([mainId, qsbId, prop]) => {
      const mainEl = document.getElementById(mainId);
      const qsbEl = document.getElementById(qsbId);
      if (mainEl && qsbEl) qsbEl[prop] = mainEl[prop];
    });
    // Show/hide fields based on enabled state
    const isEnabled = document.getElementById('qsb-mods-enabled')?.checked;
    const fieldsDiv = document.getElementById('qsb-mods-fields');
    if (fieldsDiv) fieldsDiv.classList.toggle('hidden', !isEnabled);
  }

  // ─── Attach all event listeners ──────────────────────────────────────
  function _attachListeners(container, opts) {
    // Collapsible header toggle
    const header = container.querySelector('#qsb-header');
    const content = container.querySelector('#qsb-content');
    const chevron = container.querySelector('#qsb-chevron');
    if (header && content && chevron) {
      header.addEventListener('click', () => {
        if (content.style.maxHeight && content.style.maxHeight !== '0px') {
          content.style.maxHeight = '0';
          chevron.style.transform = 'rotate(0deg)';
        } else {
          content.style.maxHeight = '2000px';
          chevron.style.transform = 'rotate(90deg)';
        }
      });
    }

    // attempts-enabled show/hide attempts-config
    const attemptsEnabledEl = container.querySelector('#qsb-attempts-enabled');
    const attemptsConfigEl = container.querySelector('#qsb-attempts-config');
    if (attemptsEnabledEl && attemptsConfigEl) {
      attemptsEnabledEl.addEventListener('change', () => {
        attemptsConfigEl.classList.toggle('hidden', !attemptsEnabledEl.checked);
      });
    }

    // Apply button
    const applyBtn = container.querySelector('#qsb-apply-btn');
    const autoSyncEl = container.querySelector('#qsb-auto-sync');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => _applyToAllQuestions(opts));
    }

    // Auto-sync toggle
    if (autoSyncEl && applyBtn) {
      autoSyncEl.addEventListener('change', () => {
        if (autoSyncEl.checked) {
          applyBtn.textContent = '✓ Auto-sync ON';
          applyBtn.classList.add('border-2', 'border-green-500');
          _applyToAllQuestions(opts);
        } else {
          applyBtn.textContent = 'Apply to All Questions';
          applyBtn.classList.remove('border-2', 'border-green-500');
        }
      });
    }

    // Panel inputs — fire auto-sync when changed
    const panelInputs = container.querySelectorAll(
      '#qsb-attempts-enabled, #qsb-max-attempts, #qsb-deduction, #qsb-retain-best, #qsb-lock-on-max, #qsb-case-sensitive, #qsb-punctuation-sensitive, #qsb-show-help, #qsb-deadline-minutes'
    );
    panelInputs.forEach(input => {
      input.addEventListener('change', () => {
        if (autoSyncEl && autoSyncEl.checked) _applyToAllQuestions(opts);
      });
    });

    // Modifications toggle button
    const modsToggleBtn = container.querySelector('#qsb-mods-toggle');
    const modsContent = container.querySelector('#qsb-mods-content');
    if (modsToggleBtn && modsContent) {
      modsToggleBtn.addEventListener('click', () => {
        const isHidden = modsContent.classList.toggle('hidden');
        modsToggleBtn.textContent = isHidden
          ? '▶ 🧩 Special Ed. Modifications (quick edit)'
          : '▼ 🧩 Special Ed. Modifications (quick edit)';
        if (!isHidden) _initModsFromMain();
      });
    }

    // Modifications enabled checkbox — show/hide fields, sync to main
    const modsEnabledEl = container.querySelector('#qsb-mods-enabled');
    const modsFieldsEl = container.querySelector('#qsb-mods-fields');
    if (modsEnabledEl) {
      modsEnabledEl.addEventListener('change', () => {
        if (modsFieldsEl) modsFieldsEl.classList.toggle('hidden', !modsEnabledEl.checked);
        // Sync to main section
        const mainEl = document.getElementById('modificationsEnabled');
        if (mainEl) {
          mainEl.checked = modsEnabledEl.checked;
          mainEl.dispatchEvent(new Event('change'));
        }
        opts.onUpdate(opts.getAssignmentData());
      });
    }

    // Modifications numeric/checkbox fields — sync back to main section on change
    const modsFieldMap = [
      ['qsb-mod-time-multiplier',    'modTimeMultiplier',    'value'],
      ['qsb-mod-penalty-multiplier', 'modPenaltyMultiplier', 'value'],
      ['qsb-mod-attempts-bonus',     'modAttemptsBonus',     'value'],
      ['qsb-mod-help-threshold',     'modHelpThreshold',     'value'],
      ['qsb-mod-ignore-deduction',   'modIgnoreDeduction',   'checked'],
      ['qsb-mod-fuzzy',              'modFuzzyMatch',        'checked'],
    ];
    modsFieldMap.forEach(([qsbId, mainId, prop]) => {
      const qsbEl = container.querySelector(`#${qsbId}`);
      if (qsbEl) {
        qsbEl.addEventListener('change', () => {
          const mainEl = document.getElementById(mainId);
          if (mainEl) {
            mainEl[prop] = qsbEl[prop];
            mainEl.dispatchEvent(new Event('change'));
          }
          opts.onUpdate(opts.getAssignmentData());
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * init(options)
   * Injects the Quick Settings panel HTML into the provided container element
   * and attaches all event listeners.
   *
   * options.container        - HTMLElement mount point
   * options.getQuestionCount - Function returning number of questions
   * options.getAssignmentData - Function returning live assignmentData object
   * options.onUpdate         - Function called after any change (for marking dirty)
   * options.editorType       - 'slides' | 'pdf' | 'simulation' | 'video'
   */
  function init(options) {
    const container = options && options.container;
    if (!container) {
      console.warn('QuestionSettingsBar.init: container is null/missing — skipping.');
      return;
    }

    const opts = {
      container,
      getQuestionCount: options.getQuestionCount || (() => 0),
      getAssignmentData: options.getAssignmentData || (() => ({})),
      onUpdate: options.onUpdate || (() => {}),
      editorType: options.editorType || 'slides',
    };

    container.innerHTML = _buildHTML();
    _attachListeners(container, opts);
    _initFromFirstQuestion(opts);
  }

  return { init };
})();
