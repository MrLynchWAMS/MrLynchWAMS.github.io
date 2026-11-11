/**
 * QuestionWeights — optional per-question weighting for overall assignment scores.
 *
 * Each question keeps its own 0–100 score. A weight only changes how much that question
 * counts toward the overall percentage. Assignments without weights behave exactly as
 * before (every weight is 1, so the weighted average equals the plain average).
 *
 * Storage: `assignment.questionWeights` — an array aligned with the question index used
 * for submissions (`slideIndex`). Missing, short or invalid entries default to 1.
 *
 * functions/aura.js keeps a small copy of getWeights/weightedAverage because Cloud Functions
 * cannot import from this folder; functions/aura.test.js checks the two stay in sync.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QuestionWeights = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_WEIGHT = 1;
  const MAX_WEIGHT = 100;

  function normalizeWeight(value) {
    if (value === null || value === undefined || value === '') return DEFAULT_WEIGHT;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_WEIGHT;
    return Math.min(n, MAX_WEIGHT);
  }

  /** Weights for `count` questions (array of numbers, default 1 each). */
  function getWeights(assignment, count) {
    const stored = assignment && Array.isArray(assignment.questionWeights) ? assignment.questionWeights : [];
    const n = Number.isInteger(count) && count >= 0 ? count : stored.length;
    return Array.from({ length: n }, (_, i) => normalizeWeight(stored[i]));
  }

  function hasCustomWeights(weights) {
    return Array.isArray(weights) && weights.some(w => w !== DEFAULT_WEIGHT);
  }

  function scoreAt(scores, i) {
    return scores && typeof scores[i] === 'number' && Number.isFinite(scores[i]) ? scores[i] : 0;
  }

  /**
   * Weighted average of `scores` (index-aligned with `weights`). Missing or non-numeric
   * scores count as 0 so unattempted questions still pull the average down, like before.
   * If every weight is 0 the plain average is used instead of dividing by zero.
   */
  function weightedAverage(scores, weights) {
    const count = Array.isArray(weights) ? weights.length : 0;
    if (count === 0) return 0;
    let total = 0;
    let weightSum = 0;
    let plain = 0;
    for (let i = 0; i < count; i++) {
      const w = normalizeWeight(weights[i]);
      const s = scoreAt(scores, i);
      total += s * w;
      weightSum += w;
      plain += s;
    }
    return weightSum === 0 ? plain / count : total / weightSum;
  }

  /** Reads the number inputs `${prefix}${key}` for each key. Missing or invalid inputs give 1. */
  function readWeightInputs(keys, prefix) {
    return keys.map(key => {
      const el = typeof document !== 'undefined' ? document.getElementById(`${prefix || 'weight-'}${key}`) : null;
      return normalizeWeight(el ? el.value : undefined);
    });
  }

  /** Returns null when every weight is the default, so unweighted assignments stay unchanged in Firestore. */
  function weightsForSave(weights) {
    const list = (weights || []).map(normalizeWeight);
    return hasCustomWeights(list) ? list : null;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /** Small labelled number input shared by every editor. `inputId` must be unique per question. */
  function inputHTML(inputId, value) {
    const id = escapeAttr(inputId);
    return `<div class="question-weight-field" title="How much this question counts toward the overall score. 1 = normal, 2 = counts double, 0.5 = counts half. The question's own score is still out of 100.">
      <label class="text-sm" for="${id}">Weight</label>
      <input type="number" id="${id}" value="${normalizeWeight(value)}" min="0" max="${MAX_WEIGHT}" step="0.5" class="w-full mt-1 p-2 bg-gray-700 rounded border border-gray-600">
    </div>`;
  }

  return { DEFAULT_WEIGHT, MAX_WEIGHT, normalizeWeight, getWeights, hasCustomWeights, weightedAverage, readWeightInputs, weightsForSave, inputHTML };
});
