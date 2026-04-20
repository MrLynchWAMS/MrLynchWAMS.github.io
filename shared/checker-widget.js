// Shared checker widget logic extracted from editor pages.

      function serializeSimpleConfig(container) {
        const isExclusive = container.querySelector('.exclusive-scoring-toggle')?.checked || false;
        const tolerance = parseFloat(container.querySelector('.numeric-tolerance-input')?.value) || 0;

        const groups = [];
        container.querySelectorAll('.rule-group').forEach(group => {
          const points = Number(group.querySelector('.rule-points')?.value) || 0;
          const groupConnector = group.querySelector('.group-connector')?.value || '&&';
          const toastMessage = group.querySelector('.rule-toast-message')?.value || '';
          const toastColor = group.querySelector('.rule-toast-color')?.value || 'default';
          const toastTarget = group.querySelector('.rule-toast-target')?.value || 'all';

          const toastTrigger = group.querySelector('.rule-toast-trigger')?.value || 'success';

          const conditions = [];
          group.querySelectorAll('.condition-row').forEach(cond => {
            const type = cond.querySelector('.cond-type')?.value || 'text';
            const op = cond.querySelector('.cond-operator')?.value || 'contains';
            const valInput = cond.querySelector('.cond-value');
            const value = valInput ? valInput.value : '';

            const condConfig = { type, op, value };

            if (type === 'text') {
              const textBoolEl = cond.querySelector('.text-bool');
              if (textBoolEl) condConfig.textBool = textBoolEl.value || '||';
              if (op === 'count') {
                const countVal = cond.querySelector('.cond-count')?.value;
                const countOp = cond.querySelector('.cond-count-op')?.value;
                condConfig.count = countVal ? parseInt(countVal, 10) : 1;
                condConfig.countOp = countOp || '>=';
              }
            } else if (type === 'number') {
              const pickModeEl = cond.querySelector('.number-pick-mode');
              const idxEl = cond.querySelector('.number-index');
              const val2Input = cond.querySelector('.cond-value-2');
              const inclusiveEl = cond.querySelector('.cond-inclusive');
              condConfig.pickMode = pickModeEl ? pickModeEl.value : 'first';
              condConfig.index = idxEl ? parseInt(idxEl.value || '1', 10) : 1;
              if (val2Input) condConfig.value2 = val2Input.value;
              if (inclusiveEl) condConfig.inclusive = inclusiveEl.checked;
              if (op === 'count') {
                const countVal = cond.querySelector('.cond-count')?.value;
                const countOp = cond.querySelector('.cond-count-op')?.value;
                condConfig.count = countVal ? parseInt(countVal, 10) : 1;
                condConfig.countOp = countOp || '>=';
              }
            }

            conditions.push(condConfig);
          });

          groups.push({
            points,
            groupConnector,
            toastMessage,
            toastColor,
            toastTarget,
            toastTrigger,
            conditions
          });
        });

        return { isExclusive, tolerance, groups };
      }

      function buildUIFromSimpleConfig(container, config) {
        const exclusiveToggle = container.querySelector('.exclusive-scoring-toggle');
        const toleranceInput = container.querySelector('.numeric-tolerance-input');
        const ruleGroupsContainer = container.querySelector('.rule-groups-container');

        if (exclusiveToggle) exclusiveToggle.checked = !!config.isExclusive;
        if (toleranceInput) toleranceInput.value = config.tolerance ?? 0;

        ruleGroupsContainer.innerHTML = '';

        (config.groups || []).forEach((g, idx) => {
          const groupEl = createRuleGroupElement(idx + 1);

          const pointsInput = groupEl.querySelector('.rule-points');
          const connectorSelect = groupEl.querySelector('.group-connector');
          const toastMessageInput = groupEl.querySelector('.rule-toast-message');
          const toastColorSelect = groupEl.querySelector('.rule-toast-color');
          const toastTargetSelect = groupEl.querySelector('.rule-toast-target');
          const toastTriggerSelect = groupEl.querySelector('.rule-toast-trigger');

          if (pointsInput) pointsInput.value = g.points ?? 0;
          if (connectorSelect) connectorSelect.value = g.groupConnector || '&&';
          if (toastMessageInput) toastMessageInput.value = g.toastMessage || '';
          if (toastColorSelect) toastColorSelect.value = g.toastColor || 'default';
          if (toastTargetSelect) toastTargetSelect.value = g.toastTarget || 'all';
          if (toastTriggerSelect) toastTriggerSelect.value = g.toastTrigger || 'success';

          const condContainer = groupEl.querySelector('.conditions-container');
          if (condContainer) {
            condContainer.innerHTML = '';
            (g.conditions || []).forEach(c => {
              const condEl = createConditionElement();
              const typeSelect = condEl.querySelector('.cond-type');
              const opSelect = condEl.querySelector('.cond-operator');

              if (typeSelect) typeSelect.value = c.type || 'text';
              typeSelect.dispatchEvent(new Event('change'));

              if (opSelect) {
                opSelect.value = c.op || (c.type === 'number' ? '==' : 'contains');
                opSelect.dispatchEvent(new Event('change'));
              }

              if (c.type === 'text') {
                const valueInput = condEl.querySelector('.cond-value');
                const textBoolEl = condEl.querySelector('.text-bool');
                if (valueInput) valueInput.value = c.value || '';
                if (textBoolEl && c.textBool) textBoolEl.value = c.textBool;
              } else if (c.type === 'number') {
                const valueInput = condEl.querySelector('.cond-value');
                const pickModeEl = condEl.querySelector('.number-pick-mode');
                const idxEl = condEl.querySelector('.number-index');
                if (valueInput) valueInput.value = c.value || '';
                if (pickModeEl && c.pickMode) pickModeEl.value = c.pickMode;
                if (idxEl && typeof c.index === 'number') {
                  idxEl.value = String(c.index);
                  if (c.pickMode === 'nth') {
                    idxEl.classList.remove('hidden');
                  } else {
                    idxEl.classList.add('hidden');
                  }
                }
                const val2Input = condEl.querySelector('.cond-value-2');
                const inclusiveEl = condEl.querySelector('.cond-inclusive');
                const countInput = condEl.querySelector('.cond-count');
                if (val2Input && c.value2 !== undefined) {
                  val2Input.value = c.value2;
                  if (c.op === 'between') val2Input.classList.remove('hidden');
                }
                if (inclusiveEl && c.inclusive !== undefined) {
                  inclusiveEl.checked = c.inclusive;
                  if (['>', '<', 'between'].includes(c.op)) {
                    inclusiveEl.closest('label').classList.remove('hidden');
                  }
                }
                if (countInput && c.count !== undefined) {
                  countInput.value = c.count;
                  const countOpEl = condEl.querySelector('.cond-count-op');
                  if (countOpEl && c.countOp) countOpEl.value = c.countOp;
                  if (c.op === 'count') {
                    countInput.classList.remove('hidden');
                    if (countOpEl) countOpEl.classList.remove('hidden');
                  }
                }
              }

              if (c.type === 'text' && c.op === 'count') {
                const countInput = condEl.querySelector('.cond-count');
                const countOpEl = condEl.querySelector('.cond-count-op');
                if (countInput && c.count !== undefined) {
                  countInput.value = c.count;
                  countInput.classList.remove('hidden');
                }
                if (countOpEl && c.countOp !== undefined) {
                  countOpEl.value = c.countOp;
                  countOpEl.classList.remove('hidden');
                }
              }

              condContainer.appendChild(condEl);
            });
          }

          ruleGroupsContainer.appendChild(groupEl);
        });

        if (!ruleGroupsContainer.children.length) {
          ruleGroupsContainer.appendChild(createRuleGroupElement(1));
        }
      }

      function CheckerWidget(container, initialCode = "", initialMeta = null) {
        let mode = "simple";
        let simpleDisabled = false;
        let code = initialCode || getDefaultCheckerCode();
        let advancedEdited = false;
        let initialAdvancedText = initialCode || "";
        let lastSavedSimpleConfig = initialMeta && initialMeta.simpleConfig
          ? initialMeta.simpleConfig
          : null;

        const simpleBtn = container.querySelector('.simple-mode-btn');
        const advBtn = container.querySelector('.advanced-mode-btn');
        const simpleUI = container.querySelector('.simple-mode-ui');
        const advUI = container.querySelector('.advanced-mode-ui');
        const ruleGroupsContainer = container.querySelector('.rule-groups-container');
        const livePreview = container.querySelector('.live-code-preview');
        const advTextarea = container.querySelector('.checker-textarea');
        const simpleDisabledNotice = container.querySelector('.simple-disabled-notice');
        const deleteAdvBtn = container.querySelector('.delete-advanced-btn');
        const convertToSimpleBtn = container.querySelector('.convert-to-simple-btn');

        const exclusiveToggle = container.querySelector('.exclusive-scoring-toggle');
        const toleranceInput = container.querySelector('.numeric-tolerance-input');
        const quickTestInput = container.querySelector('.quick-test-input');
        const quickTestBtn = container.querySelector('.quick-test-btn');
        const quickTestResult = container.querySelector('.quick-test-result');

        container.getCode = () => (mode === "simple" ? generateCodeFromUI(container) : advTextarea.value);
        container.getMode = () => mode;

        const hasInitialCode = !!initialCode && initialCode.trim().length > 0;
        const initialMode = initialMeta && initialMeta.mode ? initialMeta.mode : null;
        const initialSimpleConfig = initialMeta && initialMeta.simpleConfig ? initialMeta.simpleConfig : null;

        if (!hasInitialCode) {
          mode = "simple";
          simpleDisabled = false;
          advancedEdited = false;
          if (ruleGroupsContainer.children.length === 0) {
            ruleGroupsContainer.appendChild(createRuleGroupElement(1));
          }
          updateCodeFromSimple();
          showSimpleMode();
          simpleDisabledNotice.classList.add('hidden');
        } else if (initialMode === "simple") {
          mode = "simple";
          simpleDisabled = false;
          advancedEdited = false;

          if (initialSimpleConfig) {
            buildUIFromSimpleConfig(container, initialSimpleConfig);
            lastSavedSimpleConfig = initialSimpleConfig;
          } else {
            if (ruleGroupsContainer.children.length === 0) {
              ruleGroupsContainer.appendChild(createRuleGroupElement(1));
            }
          }

          updateCodeFromSimple();
          showSimpleMode();
          simpleDisabledNotice.classList.add('hidden');
        } else if (initialMode === "advanced") {
          mode = "advanced";
          simpleDisabled = true;
          advancedEdited = true;
          showAdvancedMode();
          advTextarea.value = initialCode;
          ruleGroupsContainer.innerHTML = "";
          simpleDisabledNotice.classList.remove('hidden');
        } else {
          if (hasInitialCode) {
            mode = "advanced";
            simpleDisabled = true;
            advancedEdited = true;
            showAdvancedMode();
            advTextarea.value = initialCode;
            ruleGroupsContainer.innerHTML = "";
            simpleDisabledNotice.classList.remove('hidden');
          } else {
            mode = "simple";
            simpleDisabled = false;
            advancedEdited = false;
            if (ruleGroupsContainer.children.length === 0) {
              ruleGroupsContainer.appendChild(createRuleGroupElement(1));
            }
            updateCodeFromSimple();
            showSimpleMode();
            simpleDisabledNotice.classList.add('hidden');
          }
        }

        simpleBtn.onclick = () => {
          if (simpleDisabled) {
            if (advancedEdited) {
              simpleDisabledNotice.classList.remove('hidden');
            }
            return;
          }
          mode = "simple";
          showSimpleMode();
          simpleDisabledNotice.classList.add('hidden');
          const generatedCode = generateCodeFromUI(container);
          livePreview.textContent = generatedCode;
          advTextarea.value = generatedCode;
          initialAdvancedText = generatedCode;
        };

        advBtn.onclick = () => {
          mode = "advanced";
          showAdvancedMode();
          if (!hasInitialCode || initialMode === "simple" || !advancedEdited) {
            const fromSimple = generateCodeFromUI(container);
            advTextarea.value = fromSimple;
            initialAdvancedText = fromSimple;
          }
        };

        advTextarea.oninput = () => {
          code = advTextarea.value;
          const trimmedNow = advTextarea.value.trim();
          const trimmedInitial = initialAdvancedText.trim();
          const actuallyChanged = trimmedNow !== trimmedInitial;

          if (actuallyChanged && !advancedEdited) {
            advancedEdited = true;
            simpleDisabled = true;
            simpleDisabledNotice.classList.remove('hidden');
          } else if (!actuallyChanged && advancedEdited) {
            advancedEdited = false;
            simpleDisabled = false;
            simpleDisabledNotice.classList.add('hidden');
          }
        };

        deleteAdvBtn.onclick = () => {
          showDialog(
            "Delete advanced code and switch to Simple Mode?",
            "This will discard your advanced changes and restore the simple editor.",
            () => {
              advTextarea.value = "";
              code = getDefaultCheckerCode();
              mode = "simple";
              advancedEdited = false;
              simpleDisabled = false;
              showSimpleMode();
              simpleDisabledNotice.classList.add('hidden');
              ruleGroupsContainer.innerHTML = "";
              ruleGroupsContainer.appendChild(createRuleGroupElement(1));
              updateCodeFromSimple();
            }
          );
        };

        if (convertToSimpleBtn) {
          convertToSimpleBtn.onclick = () => {
            if (!lastSavedSimpleConfig) {
              if (typeof showToast === "function") {
                showToast("No simple configuration found to convert.", { color: "red" });
              }
              return;
            }

            const temp = container.cloneNode(true);
            buildUIFromSimpleConfig(temp, lastSavedSimpleConfig);
            const expectedSimpleCode = generateCodeFromUI(temp);

            const currentTrimmed = advTextarea.value.trim();
            const expectedTrimmed = expectedSimpleCode.trim();
            const compatible = currentTrimmed === expectedTrimmed;

            const doConvert = () => {
              mode = "simple";
              simpleDisabled = false;
              advancedEdited = false;
              buildUIFromSimpleConfig(container, lastSavedSimpleConfig);
              updateCodeFromSimple();
              showSimpleMode();
              simpleDisabledNotice.classList.add('hidden');
            };

            if (!compatible) {
              showDialog(
                "Convert back to Simple?",
                "The current advanced code does not exactly match the last simple configuration. Converting back to Simple will discard any custom advanced edits.",
                doConvert
              );
            } else {
              doConvert();
            }
          };
        }

        container.querySelector('.add-rule-group-btn').onclick = () => {
          ruleGroupsContainer.appendChild(
            createRuleGroupElement(ruleGroupsContainer.children.length + 1)
          );
          updateCodeFromSimple();
        };

        ruleGroupsContainer.addEventListener('click', (e) => {
          const target = e.target;

          if (target.classList.contains('delete-group-btn')) {
            const group = target.closest('.rule-group');
            if (group) {
              group.remove();
              Array.from(ruleGroupsContainer.querySelectorAll('.rule-group')).forEach((g, idx) => {
                const title = g.querySelector('h4');
                if (title) title.textContent = `Rule Group ${idx + 1}`;
              });
              updateCodeFromSimple();
            }
            return;
          }

          if (target.classList.contains('add-condition-btn')) {
            const group = target.closest('.rule-group');
            if (group) {
              const conditionsContainer = group.querySelector('.conditions-container');
              if (conditionsContainer) {
                conditionsContainer.appendChild(createConditionElement());
                updateCodeFromSimple();
              }
            }
            return;
          }

          if (target.classList.contains('delete-btn')) {
            const row = target.closest('.condition-row');
            if (row) {
              row.remove();
              updateCodeFromSimple();
            }
            return;
          }
        });

        quickTestBtn.onclick = () => {
          const codeToTest = container.getCode();
          const testAnswerRaw = quickTestInput.value;
          quickTestResult.textContent = '';

          const frame = document.createElement('iframe');
          frame.style.display = 'none';
          frame.src = 'about:blank';
          document.body.appendChild(frame);

          try {
            const win = frame.contentWindow;
            const before = new Set(Object.getOwnPropertyNames(win));

            try {
              win.eval(codeToTest);
            } catch (evalErr) {
              quickTestResult.textContent = `Error evaluating code: ${evalErr.message}`;
              quickTestResult.style.color = '#f87171';
              document.body.removeChild(frame);
              return;
            }

            const afterProps = Object.getOwnPropertyNames(win);
            const newProps = afterProps.filter(p => !before.has(p));

            let funcNames = newProps.filter(name => {
              try { return typeof win[name] === 'function'; } catch (e) { return false; }
            });

            if (funcNames.length === 0) {
              const heuristics = ['checkAnswer', 'check', 'calc', 'validate', 'grade', 'score', 'match'];
              const allNames = afterProps;
              for (const name of allNames) {
                try {
                  if (typeof win[name] === 'function') {
                    for (const h of heuristics) {
                      if (name.toLowerCase().startsWith(h.toLowerCase())) {
                        funcNames.push(name);
                        break;
                      }
                    }
                  }
                } catch (e) { }
              }
            }

            if (funcNames.length === 0) {
              const blacklist = new Set(['Object', 'Math', 'Date', 'String', 'Number', 'Array', 'Promise', 'fetch', 'window', 'self', 'parent', 'frames', 'top', 'localStorage', 'sessionStorage', 'indexedDB', 'console']);
              const allNames = Object.getOwnPropertyNames(win);
              for (const name of allNames) {
                if (blacklist.has(name)) continue;
                try {
                  if (typeof win[name] === 'function') {
                    funcNames.push(name);
                  }
                } catch (e) { }
              }
            }

            if (funcNames.length === 0) {
              quickTestResult.textContent = 'No callable function found in the provided code.';
              quickTestResult.style.color = '#f87171';
              document.body.removeChild(frame);
              return;
            }

            let chosenName = funcNames.find(n => n === 'checkAnswer') || funcNames[0];
            const fn = win[chosenName];

            const showToastShim = (...args) => { try { window.showToast && window.showToast(...args); } catch (e) { } };
            const userProfileShim = { name: 'Test Student' };

            const variants = [];
            variants.push([testAnswerRaw]);
            variants.push([testAnswerRaw, showToastShim]);
            variants.push([testAnswerRaw, showToastShim, userProfileShim]);

            const maybeNum = parseFloat(testAnswerRaw);
            if (!isNaN(maybeNum)) {
              variants.push([maybeNum]);
              variants.push([maybeNum, showToastShim]);
              variants.push([maybeNum, showToastShim, userProfileShim]);
            }
            variants.push([]);

            let lastError = null;
            let called = false;
            let result;
            for (const args of variants) {
              try {
                result = fn.apply(win, args);
                called = true;
                break;
              } catch (callErr) {
                lastError = callErr;
              }
            }

            if (!called) {
              quickTestResult.textContent = `Error calling function '${chosenName}': ${lastError ? lastError.message : 'unknown error'}`;
              quickTestResult.style.color = '#f87171';
            } else {
              let out;
              try { out = typeof result === 'undefined' ? 'undefined' : JSON.stringify(result); } catch (e) { out = String(result); }
              quickTestResult.textContent = `Result: ${out}`;
              quickTestResult.style.color = '#d1d5db';
            }

          } finally {
            if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
          }
        };

        ruleGroupsContainer.addEventListener('change', updateCodeFromSimple);
        ruleGroupsContainer.addEventListener('keyup', updateCodeFromSimple);
        exclusiveToggle.addEventListener('change', updateCodeFromSimple);
        toleranceInput.addEventListener('input', updateCodeFromSimple);

        function showSimpleMode() {
          simpleUI.classList.remove('hidden');
          advUI.classList.add('hidden');
          simpleBtn.classList.add('bg-indigo-600', 'text-white');
          simpleBtn.classList.remove('bg-transparent', 'text-gray-300');
          advBtn.classList.add('bg-transparent', 'text-gray-300');
          advBtn.classList.remove('bg-indigo-600', 'text-white');
          livePreview.textContent = generateCodeFromUI(container);
          if (!advancedEdited) {
            advTextarea.value = generateCodeFromUI(container);
            initialAdvancedText = advTextarea.value;
          }
        }

        function showAdvancedMode() {
          simpleUI.classList.add('hidden');
          advUI.classList.remove('hidden');
          simpleBtn.classList.add('bg-transparent', 'text-gray-300');
          simpleBtn.classList.remove('bg-indigo-600', 'text-white');
          advBtn.classList.add('bg-indigo-600', 'text-white');
          advBtn.classList.remove('bg-transparent', 'text-gray-300');
        }

        function updateCodeFromSimple() {
          const newCode = generateCodeFromUI(container);
          livePreview.textContent = newCode;
          code = newCode;
          if (!advancedEdited) {
            advTextarea.value = newCode;
            initialAdvancedText = newCode;
          }
        }
      }

      function generateCodeFromUI(container) {
        // Defensive null-safe DOM lookups to prevent TypeError when elements are missing
        const exclusiveToggleEl = container.querySelector('.exclusive-scoring-toggle');
        const isExclusive = exclusiveToggleEl ? exclusiveToggleEl.checked : false;
        const toleranceInputEl = container.querySelector('.numeric-tolerance-input');
        const tolerance = toleranceInputEl ? (parseFloat(toleranceInputEl.value) || 0) : 0;

        const ruleGroups = container.querySelectorAll('.rule-group');
        let code = `function checkAnswer(studentAnswer) {\n`;
        code += `    let score = 0;\n`;
        let totalMaxScore = 0;
        ruleGroups.forEach(group => {
          const pointsEl = group.querySelector('.rule-points');
          totalMaxScore += pointsEl ? (Number(pointsEl.value) || 0) : 0;
        });
        code += `    const maxScore = ${totalMaxScore || 100};\n`;

        code += `    const answerStr = String(studentAnswer).toLowerCase();\n`;
        code += `    const numMatches = answerStr.match(/-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?/g) || [];\n`;
        code += `    const answerNums = numMatches.map(s => parseFloat(s.replace(/,/g, '')));\n`;
        code += `    const answerNum = answerNums.length ? answerNums[0] : NaN; // Kept for backward compatibility\n`;

        if (tolerance > 0) {
          code += `\n    function isNear(a, b, t) {\n`;
          code += `        if (isNaN(a) || isNaN(b)) return false;\n`;
          code += `        return Math.abs(a - b) <= t;\n`;
          code += `    }\n`;
        }

        // Track whether we've written the first if statement (for exclusive scoring mode)
        let wroteIf = false;

        // Each Rule Group represents a single scoring rule with combined conditions.
        // Points are awarded once per group if the combined condition evaluates to true.
        ruleGroups.forEach((group) => {
          const pointsEl = group.querySelector('.rule-points');
          const connectorEl = group.querySelector('.group-connector');
          const toastMessageEl = group.querySelector('.rule-toast-message');
          const toastColorEl = group.querySelector('.rule-toast-color');
          const toastTargetEl = group.querySelector('.rule-toast-target');

          // Skip malformed groups missing essential elements
          const points = pointsEl ? (Number(pointsEl.value) || 0) : 0;
          const groupConnector = connectorEl ? connectorEl.value : '&&';
          const toastMessage = toastMessageEl ? (toastMessageEl.value.trim() || '') : '';
          const toastColor = toastColorEl ? (toastColorEl.value || 'default') : 'default';
          const toastTarget = toastTargetEl ? (toastTargetEl.value || 'all') : 'all';
          const toastTrigger = group.querySelector('.rule-toast-trigger')?.value || 'success';

          // Collect condition expressions for this group (to be combined with && or ||)
          let groupConditions = [];

          group.querySelectorAll('.condition-row').forEach(cond => {
            const typeEl = cond.querySelector('.cond-type');
            const opEl = cond.querySelector('.cond-operator');
            const valInput = cond.querySelector('.cond-value');

            // Skip malformed condition rows missing essential elements
            if (!typeEl || !opEl) return;

            const type = typeEl.value;
            const op = opEl.value;
            if (!valInput || valInput.value.trim() === "") return;

            const val = valInput.value.trim();

            if (type === 'text') {
              const keywords = val.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
              if (op === 'ordered') {
                if (keywords.length === 0) return;
                if (keywords.length === 1) {
                  groupConditions.push(`answerStr.includes("${keywords[0].replace(/"/g, '\\"')}")`);
                } else {
                  // Generate a pure boolean expression (IIFE that returns true/false) for ordered keyword check
                  const kwsArrayLiteral = JSON.stringify(keywords);
                  const orderedCheckExpr = `(function(){ const _kws = ${kwsArrayLiteral}; let _pos = 0; for (let _i = 0; _i < _kws.length; _i++){ const _p = answerStr.indexOf(_kws[_i], _pos); if (_p === -1) return false; _pos = _p + _kws[_i].length; } return true; })()`;
                  groupConditions.push(orderedCheckExpr);
                }
              } else if (keywords.length > 1 && (op === 'contains' || op === 'not_contains')) {
                const textBoolEl = cond.querySelector('.text-bool');
                const textBool = textBoolEl ? textBoolEl.value : '||';
                const keywordConditions = keywords.map(k => `${op === 'not_contains' ? '!' : ''}answerStr.includes("${k.replace(/"/g, '\\"')}")`);
                groupConditions.push(`(${keywordConditions.join(` ${textBool} `)})`);
              } else if (keywords.length > 0) {
                const keyword = keywords[0];
                if (op === 'contains') groupConditions.push(`answerStr.includes("${keyword.replace(/"/g, '\\"')}")`);
                else if (op === 'not_contains') groupConditions.push(`!answerStr.includes("${keyword.replace(/"/g, '\\"')}")`);
                else if (op === 'equals_str') groupConditions.push(`answerStr === "${keyword.replace(/"/g, '\\"')}"`);
                else if (op === 'count') {
                  const countEl = cond.querySelector('.cond-count');
                  const countOpEl = cond.querySelector('.cond-count-op');
                  const count = countEl ? (parseInt(countEl.value, 10) || 1) : 1;
                  const countOp = countOpEl ? countOpEl.value : '>=';
                  groupConditions.push(`(answerStr.split("${keyword.replace(/"/g, '\\"')}").length - 1 ${countOp} ${count})`);
                }
              }
            } else if (type === 'number') {
              const numericVal = parseFloat(val);
              if (isNaN(numericVal)) return;

              const pickModeEl = cond.querySelector('.number-pick-mode');
              const nthIndexEl = cond.querySelector('.number-index');
              const pickMode = pickModeEl ? pickModeEl.value : 'first';
              const nthIndex = nthIndexEl ? (parseInt(nthIndexEl.value, 10) || 1) : 1;

              const createComparison = (numVar) => {
                const inclusive = cond.querySelector('.cond-inclusive')?.checked || false;
                if (op === '==') {
                  return tolerance > 0 ? `isNear(${numVar}, ${numericVal}, ${tolerance})` : `(${numVar} == ${numericVal})`;
                } else if (op === '!=') {
                  return tolerance > 0 ? `!isNear(${numVar}, ${numericVal}, ${tolerance})` : `(${numVar} != ${numericVal})`;
                } else if (op === '>') {
                  return inclusive ? `(${numVar} >= ${numericVal})` : `(${numVar} > ${numericVal})`;
                } else if (op === '<') {
                  return inclusive ? `(${numVar} <= ${numericVal})` : `(${numVar} < ${numericVal})`;
                } else if (op === 'between') {
                  const val2 = parseFloat(cond.querySelector('.cond-value-2')?.value || 0);
                  if (inclusive) {
                    return `(${numVar} >= ${Math.min(numericVal, val2)} && ${numVar} <= ${Math.max(numericVal, val2)})`;
                  } else {
                    return `(${numVar} > ${Math.min(numericVal, val2)} && ${numVar} < ${Math.max(numericVal, val2)})`;
                  }
                } else if (op === 'count') {
                  const countEl = cond.querySelector('.cond-count');
                  const countOpEl = cond.querySelector('.cond-count-op');
                  const count = countEl ? (parseInt(countEl.value, 10) || 1) : 1;
                  const countOp = countOpEl ? countOpEl.value : '>=';
                  return `(answerNums.filter(n => n === ${numericVal}).length ${countOp} ${count})`;
                }
                return 'false';
              };

              let conditionString = 'false';
              if (op === 'ordered') {
                const valStr = cond.querySelector('.cond-value')?.value || "";
                const targetNums = valStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
                if (targetNums.length === 0) return;
                const targetArrayLiteral = JSON.stringify(targetNums);
                conditionString = `(function(){ const _t = ${targetArrayLiteral}; let _ai = 0; for (const _tn of _t) { const _foundIdx = answerNums.slice(_ai).indexOf(_tn); if (_foundIdx === -1) return false; _ai += _foundIdx + 1; } return true; })()`;
              } else if (op === 'count') {
                conditionString = createComparison('');
              } else {
                switch (pickMode) {
                  case 'first':
                    conditionString = `(answerNums.length > 0 && ${createComparison('answerNums[0]')})`;
                    break;
                  case 'last':
                    conditionString = `(answerNums.length > 0 && ${createComparison('answerNums[answerNums.length - 1]')})`;
                    break;
                  case 'nth':
                    if (nthIndex > 0) {
                      conditionString = `(answerNums.length >= ${nthIndex} && ${createComparison(`answerNums[${nthIndex - 1}]`)})`;
                    }
                    break;
                  case 'any':
                    conditionString = `(answerNums.some(num => ${createComparison('num')}))`;
                    break;
                }
              }
              groupConditions.push(conditionString);
            }
          });

          // Helper for toast generation in JS
          const getToastJS = (msg, color, target) => {
            let block = `        if (typeof showToast === "function") {\n`;
            if (target === 'mods_only') {
              block += `            if (userProfile && userProfile.hasModifications) {\n`;
              block += `                try { showToast(${JSON.stringify(msg)}, { color: ${JSON.stringify(color)} }); } catch (_) {}\n`;
              block += `            }\n`;
            } else {
              block += `            try { showToast(${JSON.stringify(msg)}, { color: ${JSON.stringify(color)} }); } catch (_) {}\n`;
            }
            block += `        }\n`;
            return block;
          };

          // Emit the group-level scoring logic if there are any conditions
          if (groupConditions.length > 0) {
            let ifStatement = 'if';
            if (isExclusive) {
              ifStatement = wroteIf ? 'else if' : 'if';
              wroteIf = true;
            }

            const combinedCond = groupConditions.join(` ${groupConnector} `);
            code += `    ${ifStatement} (${combinedCond}) {\n`;
            code += `        score += ${points};\n`;
            if (toastMessage && toastTrigger === 'success') {
              code += getToastJS(toastMessage, toastColor, toastTarget);
            }
            code += `    }\n`;

            if (toastMessage && toastTrigger === 'failure') {
              code += `    if (!(${combinedCond})) {\n`;
              code += getToastJS(toastMessage, toastColor, toastTarget);
              code += `    }\n`;
            }
          }
        });

        code += `    return score;\n`;
        code += `}`;
        return code;
      }

      function createRuleGroupElement(number) {
        const div = document.createElement('div');
        div.className = 'rule-group bg-gray-800 p-3 rounded-lg border border-gray-600 space-y-3';
        div.innerHTML = `
    <div class="flex justify-between items-center">
      <h4 class="font-semibold text-white">Rule Group ${number}</h4>
      <button class="delete-group-btn text-red-400 hover:text-red-300 font-bold text-sm">Remove Group</button>
    </div>
    <div class="flex items-center space-x-2">
      <label class="text-sm">If conditions are met, award</label>
      <input type="number" class="rule-points w-20 bg-gray-700 border border-gray-600 rounded-md p-1 text-center" value="100">
      <label class="text-sm">points.</label>
    </div>
    <div class="flex items-center space-x-2">
      <label class="text-sm">Conditions in this group require:</label>
      <select class="group-connector bg-gray-700 border border-gray-600 rounded-md p-1 text-sm">
        <option value="&&">All to be true (AND)</option>
        <option value="||">Any to be true (OR)</option>
      </select>
    </div>
    <div class="conditions-container space-y-2"></div>
    <button class="add-condition-btn text-sm text-blue-400 hover:text-blue-300">+ Add Condition</button>
    <div class="mt-2 pt-2 border-t border-gray-700 space-y-2">
      <label class="block text-xs font-medium text-gray-400">Optional Toast Notification</label>
      <input type="text" class="rule-toast-message w-full bg-gray-700 border border-gray-600 rounded-md p-1 text-sm" placeholder="Message content...">
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2">
            <label class="text-xs text-gray-400">Trigger:</label>
            <select class="rule-toast-trigger bg-gray-700 border border-gray-600 rounded-md p-1 text-xs">
              <option value="success">On Success</option>
              <option value="failure">On Failure</option>
            </select>
        </div>
        <div class="flex items-center space-x-2">
            <label class="text-xs text-gray-400">Color:</label>
            <select class="rule-toast-color bg-gray-700 border border-gray-600 rounded-md p-1 text-xs">
              <option value="default">Default</option>
              <option value="blue">Info (Blue)</option>
              <option value="green">Success (Green)</option>
              <option value="red">Warning (Red)</option>
              <option value="yellow">Alert (Yellow)</option>
            </select>
        </div>
        <div class="flex items-center space-x-2">
            <label class="text-xs text-gray-400">Show to:</label>
            <select class="rule-toast-target bg-gray-700 border border-gray-600 rounded-md p-1 text-xs">
              <option value="all">All Students</option>
              <option value="mods_only">Modified Only</option>
            </select>
        </div>
      </div>
    </div>
  `;
        div.querySelector('.conditions-container').appendChild(createConditionElement());
        return div;
      }

      function createConditionElement() {
        const div = document.createElement('div');
        div.className = 'condition-row flex items-center space-x-2 bg-gray-900/50 p-2 rounded-md';
        div.innerHTML = `
    <select class="cond-type bg-gray-700 border border-gray-600 rounded-md p-1 text-sm">
      <option value="text">Text</option>
      <option value="number">Number</option>
    </select>
    <select class="cond-operator bg-gray-700 border border-gray-600 rounded-md p-1 text-sm">
      <option value="contains">contains</option>
      <option value="not_contains">does not contain</option>
      <option value="equals_str">is exactly</option>
      <option value="ordered">contains in order</option>
      <option value="count">count instances</option>
    </select>
    <div class="cond-value-wrapper flex-grow flex flex-col">
      <div class="flex items-center space-x-2">
        <select class="number-pick-mode bg-gray-700 border border-gray-600 rounded-md p-1 text-sm">
          <option value="first">First</option>
          <option value="last">Last</option>
          <option value="nth">Nth</option>
          <option value="any">Any</option>
        </select>
        <input type="number" class="number-index w-12 bg-gray-700 border border-gray-600 rounded-md p-1 text-sm" style="display:none" value="1" min="1" step="1">
        <input type="text" class="cond-value w-full bg-gray-700 border border-gray-600 rounded-md p-1 text-sm" placeholder="keyword(s), comma-separated">
        <span class="cond-between-and text-sm text-gray-400" style="display:none">and</span>
        <input type="number" class="cond-value-2 w-full bg-gray-700 border border-gray-600 rounded-md p-1 text-sm" style="display:none" placeholder="a number" step="any">
        <select class="cond-count-op bg-gray-700 border border-gray-600 rounded-md p-1 text-sm" style="display:none">
          <option value="==">exactly</option>
          <option value=">=">at least</option>
          <option value="<=">at most</option>
          <option value=">">more than</option>
          <option value="<">fewer than</option>
        </select>
        <input type="number" class="cond-count w-20 bg-gray-700 border border-gray-600 rounded-md p-1 text-sm" style="display:none" placeholder="count" min="1" value="1">
      </div>
      <label class="cond-inclusive-label flex items-center text-xs text-gray-400 cursor-pointer" style="display:none">
        <input type="checkbox" class="cond-inclusive mr-1"> Inclusive (e.g. >=)
      </label>
      <div class="text-options text-xs mt-1" style="display:none">
        <label>Require: </label>
        <select class="text-bool bg-gray-700 border border-gray-600 rounded-md p-0.5 text-sm">
          <option value="||">Any (OR)</option>
          <option value="&&">All (AND)</option>
        </select>
      </div>
    </div>
    <button class="delete-btn text-red-400 hover:text-red-300 font-bold text-xl leading-none">&times;</button>
  `;

        const typeSelect = div.querySelector('.cond-type');
        const operatorSelect = div.querySelector('.cond-operator');
        const valueWrapper = div.querySelector('.cond-value-wrapper');

        function updateRowVisibility() {
          const type = typeSelect ? typeSelect.value : 'text';
          const operator = operatorSelect ? operatorSelect.value : 'contains';
          
          const val2Input = div.querySelector('.cond-value-2');
          const andSpan = div.querySelector('.cond-between-and');
          const inclusiveLabel = div.querySelector('.cond-inclusive-label');
          const pickModeSelect = div.querySelector('.number-pick-mode');
          const countInput = div.querySelector('.cond-count');
          const countOpEl = div.querySelector('.cond-count-op');
          const textOptions = div.querySelector('.text-options');
          const valueInput = div.querySelector('.cond-value');

          const setVisible = (el, visible, display = 'inline-block') => {
            if (el) el.style.setProperty('display', visible ? display : 'none', 'important');
          };

          const isCount = (operator === 'count');
          const isOrdered = (operator === 'ordered');

          // Always set count visibility
          setVisible(countInput, isCount, 'inline-block');
          setVisible(countOpEl, isCount, 'inline-block');

          if (type === 'number') {
            setVisible(val2Input, operator === 'between', 'inline-block');
            setVisible(andSpan, operator === 'between', 'inline-block');
            setVisible(inclusiveLabel, ['>', '<', 'between'].includes(operator), 'flex');
            setVisible(pickModeSelect, !isCount && !isOrdered, 'inline-block');

            if (valueInput) {
              valueInput.type = "number";
              if (isOrdered) {
                valueInput.type = "text";
                valueInput.placeholder = "numbers, comma-separated";
              } else {
                valueInput.placeholder = isCount ? "number to count" : "a number";
              }
            }
          } else {
            setVisible(pickModeSelect, false);
            setVisible(val2Input, false);
            setVisible(andSpan, false);
            setVisible(inclusiveLabel, false);
            
            if (valueInput) {
              valueInput.type = "text";
              valueInput.placeholder = isCount ? "keyword to count" : "keyword(s), comma-separated";
            }

            if (textOptions && valueInput) {
              const showTextOptions = (operator === 'contains' || operator === 'not_contains') && valueInput.value.includes(',');
              setVisible(textOptions, showTextOptions, 'block');
            }
          }
          if (typeof updateCodeFromSimple === 'function') {
            updateCodeFromSimple();
          }
        }

        typeSelect.addEventListener('change', e => {
          const type = e.target.value;
          if (type === 'number') {
            operatorSelect.innerHTML = `
              <option value="==">is exactly</option>
              <option value="!=">is not</option>
              <option value=">">is greater than</option>
              <option value="<">is less than</option>
              <option value="between">is between</option>
              <option value="ordered">contains in order</option>
              <option value="count">count instances</option>
            `;
          } else {
            operatorSelect.innerHTML = `
              <option value="contains">contains</option>
              <option value="not_contains">does not contain</option>
              <option value="equals_str">is exactly</option>
              <option value="ordered">contains in order</option>
              <option value="count">count instances</option>
            `;
          }
          updateRowVisibility();
        });

        operatorSelect.addEventListener('change', updateRowVisibility);
        div.addEventListener('input', updateRowVisibility);

        const pm = div.querySelector('.number-pick-mode');
        pm.addEventListener('change', () => {
          const idx = div.querySelector('.number-index');
          if (idx) idx.style.setProperty('display', pm.value === 'nth' ? 'inline-block' : 'none', 'important');
        });

        // Initialize visibility
        updateRowVisibility();
        return div;
      }

      function getDefaultCheckerCode() {
        return `function checkAnswer(studentAnswer) {
    let score = 0;
    const maxScore = 100;
    const answerStr = String(studentAnswer).toLowerCase();
    const numMatches = answerStr.match(/-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?/g) || [];
    const answerNums = numMatches.map(s => parseFloat(s.replace(/,/g, '')));
    const answerNum = answerNums.length ? answerNums[0] : NaN;
    return score;
}`;
      }
