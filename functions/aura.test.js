'use strict';
const test = require('node:test');
const assert = require('node:assert');
const aura = require('./aura');

test('resolveItemCost uses store price and tier perks', () => {
  const item = { name: 'Restroom Break', cost: 10 };
  assert.deepStrictEqual(
    (({ cost, tierPerk }) => ({ cost, tierPerk }))(aura.resolveItemCost(item, 0, aura.DEFAULT_AURA_TIERS)),
    { cost: 10, tierPerk: false });
  assert.deepStrictEqual(
    (({ cost, tierPerk }) => ({ cost, tierPerk }))(aura.resolveItemCost(item, 150, aura.DEFAULT_AURA_TIERS)),
    { cost: 0, tierPerk: true });
});

test('resolveItemCost never returns a negative price', () => {
  assert.strictEqual(aura.resolveItemCost({ name: 'X', cost: -100 }, 0, null).cost, 0);
  assert.strictEqual(aura.resolveItemCost({ name: 'X', cost: 'abc' }, 0, null).cost, 0);
});

test('computeAuraTier picks the highest reached threshold', () => {
  assert.strictEqual(aura.computeAuraTier(49, null).id, 'rising');
  assert.strictEqual(aura.computeAuraTier(50, null).id, 'focused');
  assert.strictEqual(aura.computeAuraTier(1000, null).id, 'elite');
});

test('computeOverallAverage uses the latest score per slide', () => {
  const subs = [
    { slideIndex: 0, score: 0, timestamp: new Date(1000) },
    { slideIndex: 0, score: 100, timestamp: new Date(2000) },
    { slideIndex: 1, score: 50, timestamp: new Date(1500) }
  ];
  assert.strictEqual(aura.computeOverallAverage(subs, 2), 75);
  assert.strictEqual(aura.computeOverallAverage(subs, 0), 0);
});

test('computeOverallAverage applies question weights and matches the shared helper', () => {
  const QuestionWeights = require('../shared/question-weights.js');
  const subs = [
    { slideIndex: 0, score: 100, timestamp: new Date(1000) },
    { slideIndex: 1, score: 0, timestamp: new Date(1000) }
  ];
  assert.strictEqual(aura.computeOverallAverage(subs, 2, [1, 1]), 50);
  assert.ok(Math.abs(aura.computeOverallAverage(subs, 2, [2, 1]) - 200 / 3) < 1e-9);
  // Unattempted questions still count as 0 at their weight.
  assert.ok(Math.abs(aura.computeOverallAverage(subs.slice(0, 1), 3, [1, 1, 2]) - 25) < 1e-9);
  assert.strictEqual(aura.computeOverallAverage(subs, 2, [0, 0]), 50);

  const assignment = { questionWeights: [2, '0.5', 'bad', -1, 500] };
  const server = aura.getQuestionWeights(assignment, 6);
  assert.deepStrictEqual(server, QuestionWeights.getWeights(assignment, 6));
  const scores = [100, 50, 80, 10];
  assert.strictEqual(aura.weightedAverage(scores, server), QuestionWeights.weightedAverage(scores, server));
});

test('computeSubmissionAward picks the best matching rule and ignores question rules', () => {
  const assignment = { auraRules: [
    { amount: 5, minScore: 70 },
    { amount: 10, minScore: 90 },
    { amount: 99, trigger: 'question_correct', target: 'all' },
    { amount: 3, trigger: 'watch_time_reached', minutesRequired: 10 }
  ] };
  assert.strictEqual(aura.computeSubmissionAward(assignment, { overallAverage: 95, watchTimeSeconds: 0 }), 10);
  assert.strictEqual(aura.computeSubmissionAward(assignment, { overallAverage: 80, watchTimeSeconds: 0 }), 5);
  assert.strictEqual(aura.computeSubmissionAward(assignment, { overallAverage: 10, watchTimeSeconds: 0 }), 0);
});

test('legacy auraAmount fallback and on-time enforcement', () => {
  const legacy = { auraAmount: '4', auraMinScore: '50' };
  assert.strictEqual(aura.computeSubmissionAward(legacy, { overallAverage: 60, watchTimeSeconds: 0 }), 4);
  const due = { auraOnTime: true, auraDueAt: new Date('2024-01-01') };
  assert.strictEqual(aura.isOnTime(due, new Date('2024-01-02')), false);
  assert.strictEqual(aura.isOnTime(due, new Date('2023-12-31')), true);
});

test('validAmount rejects negative, NaN and zero amounts', () => {
  assert.strictEqual(aura.validAmount(-5), 0);
  assert.strictEqual(aura.validAmount('abc'), 0);
  assert.strictEqual(aura.validAmount(2), 2);
});

test('question and watch-time rule lookup', () => {
  const a = { auraRules: [
    { trigger: 'question_correct', target: 'q2', amount: 2 },
    { trigger: 'watch_time_reached', minutesRequired: 5, amount: 1 }
  ] };
  assert.strictEqual(aura.findQuestionRule(a, 1).amount, 2);
  assert.strictEqual(aura.findQuestionRule(a, 0), null);
  assert.strictEqual(aura.findWatchTimeRule(a, 'watch_time_5').amount, 1);
});
