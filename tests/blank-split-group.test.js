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
const { parseCanvasToBlocks, serializeBlocksToCanvas } = context.window;

const legacy = 'Intro text\n\n## What is 2+2?\n[q: number]';

test('canvas without :::split produces no splitGroup and serializes unchanged', () => {
    const { blocks } = parseCanvasToBlocks(legacy, []);
    assert.ok(blocks.every(b => !('splitGroup' in b)));
    assert.ok(!serializeBlocksToCanvas(blocks).includes(':::'));
});

test(':::split wraps blocks in one shared group and round-trips', () => {
    const markup = `Before\n\n:::split\nPassage\n\n## Q1\n[q: text]\n\n## Q2\n[q: text]\n:::end\n\n## After\n[q: text]`;
    const { blocks, warnings } = parseCanvasToBlocks(markup, []);
    assert.equal(warnings.length, 0);
    const groups = blocks.map(b => b.splitGroup);
    assert.equal(groups[0], undefined);
    assert.ok(groups[1] && groups[1] === groups[2] && groups[2] === groups[3]);
    assert.equal(groups[4], undefined);
    const again = parseCanvasToBlocks(serializeBlocksToCanvas(blocks), blocks).blocks;
    assert.deepEqual(again.map(b => !!b.splitGroup), blocks.map(b => !!b.splitGroup));
    assert.equal(again.filter(b => b.type === 'question').length, 3);
});

test('unclosed :::split warns and closes at end', () => {
    const { blocks, warnings } = parseCanvasToBlocks(':::split\nP\n\n## Q\n[q: text]', []);
    assert.equal(warnings.length, 1);
    assert.ok(blocks.every(b => b.splitGroup));
});
