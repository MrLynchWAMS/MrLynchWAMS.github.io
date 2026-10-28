'use strict';

// Pure helpers shared by the Cloud Functions. Ported from classroompicker.html so the
// server computes tiers, discounts and awards exactly like the client used to.

const DEFAULT_TEACHER_EMAIL = 'klynch@mtps.us';

// Same list as isTeacher() in firestore.rules. Keep both in sync.
const HARDCODED_TEACHERS = [
  'klynch@mtps.us',
  'mstuart@mtps.us',
  'cfiori@mtps.us',
  'mlock@mtps.us',
  'cheine@mtps.us',
  'kgray@mtps.us'
];

const DEFAULT_AURA_TIERS = [
  { id: 'rising', name: 'Rising', threshold: 0, emoji: '⚡', color: 'gray', discounts: [] },
  { id: 'focused', name: 'Focused', threshold: 50, emoji: '🔵', color: 'blue', discounts: [{ itemName: 'Fill Water Bottle', newCost: 0 }] },
  { id: 'scholar', name: 'Scholar', threshold: 150, emoji: '⭐', color: 'yellow', discounts: [{ itemName: 'Fill Water Bottle', newCost: 0 }, { itemName: 'Restroom Break', newCost: 0 }] },
  { id: 'elite', name: 'Elite', threshold: 300, emoji: '👑', color: 'purple', discounts: [{ itemName: 'Fill Water Bottle', newCost: 0 }, { itemName: 'Restroom Break', newCost: 0 }, { itemName: 'Eat During Class', newCost: 0 }] }
];

const DEFAULT_STORE_ITEMS = [
  { name: 'Listen to Music', cost: 5, icon: '🎧' },
  { name: 'Swap Seats (1 Day)', cost: 10, icon: '🪑' },
  { name: 'Homework Pass', cost: 20, icon: '🎟️' }
];

// Score a question needs for a "question_correct" Aura rule (same threshold as the video flow).
const QUESTION_CORRECT_MIN_SCORE = 90;

function normalizeTeacherEmail(email) {
  if (!email) return DEFAULT_TEACHER_EMAIL;
  return String(email).toLowerCase().replace(/\s+/g, '').trim();
}

function computeAuraTier(lifetime, tiers) {
  const safeLifetime = Number(lifetime) || 0;
  const sorted = (Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_AURA_TIERS)
    .slice().sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
  let matched = sorted[0];
  sorted.forEach(tier => {
    if (safeLifetime >= (tier.threshold || 0)) matched = tier;
  });
  return matched;
}

/**
 * Returns the price the student must pay for an item, using the store's real price
 * and the student's tier perks. Never uses a client-supplied price.
 */
function resolveItemCost(item, lifetime, tiers) {
  const baseCost = Math.max(0, parseInt(item && item.cost, 10) || 0);
  const tier = computeAuraTier(lifetime, tiers);
  let cost = baseCost;
  (tier.discounts || []).forEach(discount => {
    if (discount && discount.itemName === item.name) {
      cost = Math.max(0, parseInt(discount.newCost, 10) || 0);
    }
  });
  return { baseCost, cost, tierPerk: cost === 0 && baseCost > 0, tier };
}

function getAuraRules(assignment) {
  const rules = Array.isArray(assignment.auraRules) ? assignment.auraRules.slice() : [];
  if (rules.length === 0 && assignment.auraAmount) {
    rules.push({
      amount: parseFloat(assignment.auraAmount) || 0,
      minScore: parseFloat(assignment.auraMinScore) || 0
    });
  }
  return rules;
}

function getQuestionCount(assignment) {
  switch (assignment.type) {
    case 'pdf': return (assignment.questionZones || []).length;
    case 'video': return (assignment.videoQuestions || []).length;
    case 'simulation': return (assignment.simQuestions || []).length;
    case 'blank': return (assignment.blocks || []).filter(b => b.type === 'question').length;
    default: return (assignment.slideIds || []).length;
  }
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Latest submission score for each slideIndex (teacher regrades are newer docs, so they win). */
function latestScoresBySlide(submissions) {
  const latest = new Map();
  submissions.forEach(sub => {
    if (!Number.isInteger(sub.slideIndex)) return;
    const prev = latest.get(sub.slideIndex);
    if (!prev || toMillis(sub.timestamp) >= toMillis(prev.timestamp)) latest.set(sub.slideIndex, sub);
  });
  return latest;
}

function computeOverallAverage(submissions, questionCount) {
  if (questionCount <= 0) return 0;
  let total = 0;
  latestScoresBySlide(submissions).forEach(sub => {
    if (typeof sub.score === 'number' && Number.isFinite(sub.score)) total += sub.score;
  });
  return total / questionCount;
}

function isOnTime(assignment, now = new Date()) {
  if (!assignment.auraOnTime || !assignment.auraDueAt) return true;
  return now.getTime() <= toMillis(assignment.auraDueAt);
}

function validAmount(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function watchTimeRuleKey(rule) {
  return rule.id || `watch_time_${rule.minutesRequired || 0}`;
}

/** Highest-paying rule satisfied at submit time. `question_correct` rules never pay at submit. */
function computeSubmissionAward(assignment, { overallAverage, watchTimeSeconds }) {
  let best = 0;
  getAuraRules(assignment).forEach(rule => {
    if (rule.trigger === 'question_correct') return;
    const matches = rule.trigger === 'watch_time_reached'
      ? (watchTimeSeconds / 60) >= (rule.minutesRequired || 99999)
      : overallAverage >= (rule.minScore || 0);
    const amount = validAmount(rule.amount);
    if (matches && amount > best) best = amount;
  });
  return best;
}

function findWatchTimeRule(assignment, key) {
  return getAuraRules(assignment).find(rule => rule.trigger === 'watch_time_reached' && watchTimeRuleKey(rule) === key) || null;
}

function findQuestionRule(assignment, questionIndex) {
  return getAuraRules(assignment).find(rule =>
    rule.trigger === 'question_correct' && (rule.target === 'all' || rule.target === `q${questionIndex + 1}`)) || null;
}

module.exports = {
  DEFAULT_TEACHER_EMAIL,
  HARDCODED_TEACHERS,
  DEFAULT_AURA_TIERS,
  DEFAULT_STORE_ITEMS,
  QUESTION_CORRECT_MIN_SCORE,
  normalizeTeacherEmail,
  computeAuraTier,
  resolveItemCost,
  getAuraRules,
  getQuestionCount,
  latestScoresBySlide,
  computeOverallAverage,
  isOnTime,
  validAmount,
  watchTimeRuleKey,
  computeSubmissionAward,
  findWatchTimeRule,
  findQuestionRule
};
