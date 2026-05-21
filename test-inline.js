const ic = {
    type: 'multi', logic: 'AND', conditions: [
        { op: 'contains', value: 'game' },
        { op: 'contains', value: 'time' }
    ]
};

function checkTextCondition(studentVal, targetVal, op) {
    const userText = String(studentVal || '').toLowerCase().trim();
    const targetText = String(targetVal || '').toLowerCase().trim();
    if (op === 'contains') return userText.includes(targetText);
    return false;
}

function evaluateInlineChecker(ic, studentAnswer) {
    if (ic.type === 'multi') {
        const results = ic.conditions.map(c => {
            if (c.op === 'contains' || c.op === 'not_contains' || c.op === 'equals_str') {
                return checkTextCondition(studentAnswer, c.value, c.op);
            }
            return false;
        });
        return ic.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
    }
}

console.log(evaluateInlineChecker(ic, 'a game about time'));
