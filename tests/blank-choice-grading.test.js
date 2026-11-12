const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const context = vm.createContext({ window: {}, console });
for (const file of ['shared/checker-runner.js', 'shared/blank-renderer.js', 'shared/blank-canvas-parser.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const renderer = context.window.BlankRenderer;
const choices = ['A', 'B', 'C', 'D', 'E'];
const choice = () => ({ id: 'q1', type: 'question', prompt: 'Question', questionType: 'choice', points: 100, choices: [...choices], correctChoiceIndex: 0 });
const multi = () => ({ id: 'q1', type: 'question', prompt: 'Question', questionType: 'multiselect', points: 100, choices: [...choices], correctChoiceIndexes: [0, 1, 2, 3], scoringMode: 'partial' });
function withRules(block, rules, fallback = 'builtin') {
    block.choiceGrading = { mode: 'rules', rules, fallback, questionType: block.questionType, choiceSnapshot: [...block.choices] };
    return block;
}

test('legacy built-in scoring is unchanged, including empty and wrong picks', () => {
    const auto = { mode: 'auto', code: 'function checkAnswer() { return 12; }' };
    assert.equal(renderer.scoreChoice(choice(), '0', auto), 100);
    assert.equal(renderer.scoreChoice(choice(), '1', auto), 0);
    assert.equal(renderer.scoreChoice(choice(), '', auto), 0);
    assert.equal(renderer.scoreChoice(multi(), '0,1,2', auto), 75);
    assert.equal(renderer.scoreChoice(multi(), '0,1,2,4', auto), 50);
    assert.equal(renderer.scoreChoice({ ...multi(), scoringMode: 'all-or-nothing' }, '0,1,2,3', auto), 100);
});

test('simple rules award option and exact-set credit, with built-in or zero fallback', () => {
    const single = withRules(choice(), [{ indexes: [1], points: 50 }]);
    assert.equal(renderer.scoreChoice(single, '1'), 50);
    assert.equal(renderer.scoreChoice(single, '0'), 100);
    assert.equal(renderer.scoreChoice(single, '2'), 0);
    const multiple = withRules(multi(), [{ indexes: [2, 0, 1], points: 90 }]);
    assert.equal(renderer.scoreChoice(multiple, '0,1,2'), 90);
    assert.equal(renderer.scoreChoice(multiple, '2,0,1'), 90);
    assert.equal(renderer.scoreChoice(multiple, '0,1,2,3'), 100);
    assert.equal(renderer.scoreChoice(multiple, '0,1,2,4'), 50);
    multiple.choiceGrading.fallback = 'zero';
    assert.equal(renderer.scoreChoice(multiple, '0,1,2,3'), 0);
    assert.equal(renderer.scoreChoice(multiple, ''), 0);
});

test('invalid rules and changed choices are reported, not silently graded', () => {
    const block = withRules(multi(), [{ indexes: [0, 1, 2], points: 90 }]);
    block.choices[0] = 'Changed';
    assert.throws(() => renderer.scoreChoice(block, '0,1,2'), /Choices changed/);
    block.choiceGrading.choiceSnapshot = [...block.choices];
    block.choiceGrading.rules.push({ indexes: [2, 1, 0], points: 80 });
    assert.throws(() => renderer.validateChoiceGrading(block), /duplicate/);
    block.choiceGrading.rules.pop();
    block.choiceGrading.rules[0].indexes.push(7);
    assert.throws(() => renderer.validateChoiceGrading(block), /valid choices/);
    block.choiceGrading.rules[0] = { indexes: [0], points: 101 };
    assert.throws(() => renderer.validateChoiceGrading(block), /between 0 and 100/);
});

test('custom checker executes only when opted in and errors surface', () => {
    const block = choice();
    const checker = { mode: 'advanced', code: 'function checkAnswer(answer) { return answer === "1" ? 50 : 100; }' };
    assert.equal(renderer.scoreChoice(block, '1', checker), 0);
    block.choiceGrading = { mode: 'checker' };
    assert.equal(renderer.scoreChoice(block, '1', checker), 50);
    assert.throws(() => renderer.scoreChoice(block, '1', { mode: 'auto', code: checker.code }), /Configure/);
    assert.throws(() => renderer.scoreChoice(block, '1', { mode: 'advanced', code: 'function checkAnswer() { return NaN; }' }), /must return/);
    assert.throws(() => renderer.scoreChoice(block, '1', { mode: 'advanced', code: 'function checkAnswer() { throw new Error("broken"); }' }), /broken/);
    assert.throws(() => renderer.validateChoiceGrading(block, { mode: 'advanced', code: 'function checkAnswer( {' }), /Invalid checker code|named function/);
});

test('canvas round trip retains custom rules and detects changed choices', () => {
    const block = withRules(multi(), [{ indexes: [0, 1, 2], points: 90 }]);
    const markup = context.window.serializeBlocksToCanvas([block]);
    const parsed = context.window.parseCanvasToBlocks(markup, [block]).blocks[0];
    assert.equal(parsed.id, block.id);
    assert.equal(renderer.scoreChoice(parsed, '0,1,2'), 90);
    const changed = context.window.parseCanvasToBlocks(markup.replace('A. A*', 'A. Changed*'), [block]).blocks[0];
    assert.throws(() => renderer.scoreChoice(changed, '0,1,2'), /Choices changed/);
});

test('editor save preserves custom checkers instead of replacing them with auto code', () => {
    const html = fs.readFileSync(path.join(root, 'blank-editor.html'), 'utf8');
    const start = html.indexOf("blocksToSave.filter(block => block.type === 'question'");
    const end = html.indexOf('                // Aura Rules', start);
    assert.ok(start !== -1 && end !== -1);
    const saveCheckers = new Function('blocksToSave', 'checkerFunctions', 'window', `${html.slice(start, end)}; return newCheckerFunctions;`);
    const block = choice();
    block.choiceGrading = { mode: 'checker' };
    const entry = { mode: 'advanced', code: 'function checkAnswer(answer) { return answer === "1" ? 50 : 0; }' };
    const saved = saveCheckers([block], { q1: entry }, context.window);
    assert.equal(saved.q1, entry);
    assert.equal(renderer.scoreChoice(block, '1', saved.q1), 50);
    block.choiceGrading.mode = 'builtin';
    assert.equal(saveCheckers([block], { q1: entry }, context.window).q1, entry);
    assert.equal(saveCheckers([block], { q1: { mode: 'auto', code: 'outdated' } }, context.window).q1.mode, 'auto');
});
