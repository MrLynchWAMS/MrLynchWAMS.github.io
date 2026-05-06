// Shared checker execution logic.

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function checkTextCondition(studentVal, targetVal, op, context = {}) {
  const userText = String(studentVal || '').toLowerCase().trim();
  const targetText = String(targetVal || '').toLowerCase().trim();

  const assignmentData = context.assignmentData || {};
  const userProfile = context.userProfile || {};
  const isFuzzyEnabled = !!(assignmentData.modifications && assignmentData.modifications.enabled && assignmentData.modifications.fuzzy);
  const useFuzzy = isFuzzyEnabled && !!userProfile.hasModifications;

  if (op === 'contains') return userText.includes(targetText);
  if (op === 'not_contains') return !userText.includes(targetText);
  if (op === 'equals_str') {
    if (useFuzzy) {
      const dist = levenshteinDistance(userText, targetText);
      const maxErrors = Math.max(1, Math.floor(targetText.length / 4));
      return dist <= maxErrors;
    }
    return userText === targetText;
  }
  return false;
}

/**
 * evaluateInlineChecker(ic, studentAnswer, context)
 * Evaluates an inlineChecker object (from canvas mode) against a student answer.
 * Returns true/false (not a score — multiply by points to get score).
 * Handles both single-condition and multi-condition (type: 'multi') objects.
 */
function evaluateInlineChecker(ic, studentAnswer, context) {
  if (!ic) return false;
  context = context || {};

  if (ic.type === 'multi') {
    const results = ic.conditions.map(c => {
      if (c.op === 'contains' || c.op === 'not_contains' || c.op === 'equals_str') {
        return checkTextCondition(studentAnswer, c.value, c.op, context);
      }
      return false;
    });
    return ic.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
  }

  // Single-condition handling
  const text = String(studentAnswer || '').toLowerCase().trim();
  if (ic.op === 'contains') return text.includes(String(ic.value || '').toLowerCase());
  if (ic.op === 'not_contains') return !text.includes(String(ic.value || '').toLowerCase());
  if (ic.op === 'equals_str') return checkTextCondition(studentAnswer, ic.value, 'equals_str', context);

  // Numeric ops
  const num = parseFloat(studentAnswer);
  if (ic.op === '==') return Math.abs(num - ic.value) <= (ic.tolerance || 0);
  if (ic.op === '!=') return Math.abs(num - ic.value) > (ic.tolerance || 0);
  if (ic.op === '>') return num > ic.value;
  if (ic.op === '<') return num < ic.value;
  if (ic.op === 'between') return num >= Math.min(ic.value, ic.value2) && num <= Math.max(ic.value, ic.value2);

  return false;
}
window.evaluateInlineChecker = evaluateInlineChecker;

function executeCheckerFunction(funcString, studentAnswer, options = {}) {
  if (!funcString || !String(funcString).trim()) return 0;

  const showToast = typeof options.showToast === 'function' ? options.showToast : () => {};
  const userProfile = options.userProfile || {};
  const hasAttemptInfo = Object.prototype.hasOwnProperty.call(options, 'attemptInfo');
  const hasLateContext = Object.prototype.hasOwnProperty.call(options, 'isLate') || typeof options.showVideo === 'function';
  const attemptInfo = options.attemptInfo;
  const isLate = !!options.isLate;
  const showVideo = typeof options.showVideo === 'function' ? options.showVideo : () => {};
  const textConditionFn = typeof options.checkTextCondition === 'function'
    ? options.checkTextCondition
    : ((studentVal, targetVal, op) => checkTextCondition(studentVal, targetVal, op, {
      assignmentData: options.assignmentData,
      userProfile
    }));

  const funcNameMatch = String(funcString).match(/function\s+([a-zA-Z0-9_]+)\s*\(/);
  if (!funcNameMatch || !funcNameMatch[1]) {
    throw new Error('Could not find a valid function definition in the checker code.');
  }
  const funcNameToRun = funcNameMatch[1];

  const runner = new Function(
    'studentAnswer',
    'showToast',
    'userProfile',
    'attemptInfo',
    'checkTextCondition',
    'isLate',
    'showVideo',
    'hasAttemptInfo',
    'hasLateContext',
    `
      const window = { open: () => {} };
      const alert = () => {};
      const confirm = () => false;
      ${funcString}
      if (typeof ${funcNameToRun} === 'function') {
        return function() {
          const fn = ${funcNameToRun};
          const callVariants = [];
          if (hasAttemptInfo) {
            callVariants.push([studentAnswer, showToast, userProfile, attemptInfo]);
          }
          if (hasLateContext) {
            callVariants.push([studentAnswer, showToast, userProfile, isLate, showVideo]);
          }
          callVariants.push([studentAnswer, showToast, userProfile]);
          callVariants.push([studentAnswer]);

          let lastError = null;
          for (let i = 0; i < callVariants.length; i++) {
            try {
              return fn.apply(null, callVariants[i]);
            } catch (err) {
              lastError = err;
            }
          }
          throw lastError || new Error('Checker function could not be executed.');
        }();
      }
      if (typeof checkAnswer === 'function') {
        return checkAnswer(studentAnswer, showToast, userProfile, attemptInfo, isLate, showVideo, checkTextCondition);
      }
      throw new Error("Checker function not found.");
    `
  );

  return runner(studentAnswer, showToast, userProfile, attemptInfo, textConditionFn, isLate, showVideo, hasAttemptInfo, hasLateContext);
}
