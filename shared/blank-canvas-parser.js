/**
 * blank-canvas-parser.js
 * Pure parser/serializer for blank-assignment canvas markup.
 * No DOM dependencies. Exported as globals (no ES modules).
 *
 * API:
 *   parseCanvasToBlocks(markupText, existingBlocks = [])  → { blocks, warnings }
 *   serializeBlocksToCanvas(blocks)                        → string
 *   validateCanvas(markupText)                             → { warnings }
 */

(function () {
    // ------------------------------------------------------------------ helpers

    function genId(prefix) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let s = '';
        for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return prefix + '_' + s;
    }

    function fingerprint(block) {
        if (block.type !== 'question') return null;
        return (String(block.prompt || '').toLowerCase().trim()) + '|' + (block.questionType || 'text');
    }

    // ------------------------------------------------------------------ parser

    /**
     * parseCanvasToBlocks(markupText, existingBlocks = [])
     * Returns { blocks: [], warnings: [] }
     */
    function parseCanvasToBlocks(markupText, existingBlocks) {
        existingBlocks = existingBlocks || [];
        const warnings = [];
        const blocks = [];

        // Build fingerprint → id map from existing blocks
        const fingerprintMap = {};
        existingBlocks.forEach(b => {
            const fp = fingerprint(b);
            if (fp && b.id) fingerprintMap[fp] = b.id;
        });
        const existingCheckerIds = new Set(
            existingBlocks
                .filter(b => b.type === 'question')
                .map(b => b.id)
        );

        if (!markupText || !markupText.trim()) {
            return { blocks, warnings };
        }

        // Split into lines and group into logical chunks
        const lines = markupText.split('\n');
        let pendingTextLines = [];

        function flushText() {
            const text = pendingTextLines.join('\n').trim();
            pendingTextLines = [];
            if (text) {
                blocks.push({ id: genId('b'), type: 'text', content: text });
            }
        }

        function parseQuestionLine(promptRaw, qTagRaw) {
            // qTagRaw is the content inside [q: ...]
            const qTag = qTagRaw.trim();
            const parts = qTag.split('|').map(s => s.trim());
            const typePart = parts[0].toLowerCase();

            let questionType = 'text';
            let inlineChecker = null;
            let choices = null;
            let correctChoiceIndex = null;
            let points = 100;

            // Parse points from last part like "100pts" or "50pts"
            const lastPart = parts[parts.length - 1];
            const ptsMatch = lastPart.match(/^(\d+)\s*pts?$/i);
            if (ptsMatch) {
                points = parseInt(ptsMatch[1], 10);
                parts.pop();
            }

            if (typePart === 'text') {
                questionType = 'text';
                if (parts.length > 1) {
                    // Try to parse inline checker: contains "keyword"
                    const condPart = parts[1].trim();
                    const containsMatch = condPart.match(/^contains\s+"([^"]+)"$/i);
                    const notContainsMatch = condPart.match(/^not_contains\s+"([^"]+)"$/i);
                    if (containsMatch) {
                        inlineChecker = { op: 'contains', value: containsMatch[1], value2: null, tolerance: 0, points };
                    } else if (notContainsMatch) {
                        inlineChecker = { op: 'not_contains', value: notContainsMatch[1], value2: null, tolerance: 0, points };
                    } else {
                        warnings.push(`Unrecognized condition for text question: "${condPart}". Treating as open text.`);
                    }
                }
            } else if (typePart === 'number') {
                questionType = 'number';
                if (parts.length > 1) {
                    const condPart = parts[1].trim();
                    // answer==X | answer between X and Y | contains / not_contains also valid
                    const eqMatch = condPart.match(/^answer\s*==\s*([\d.]+)$/i);
                    const neqMatch = condPart.match(/^answer\s*!=\s*([\d.]+)$/i);
                    const gtMatch = condPart.match(/^answer\s*>\s*([\d.]+)$/i);
                    const ltMatch = condPart.match(/^answer\s*<\s*([\d.]+)$/i);
                    const betweenMatch = condPart.match(/^answer\s+between\s+([\d.]+)\s+and\s+([\d.]+)$/i);
                    const tolMatch = condPart.match(/^answer\s*==\s*([\d.]+)\s*±\s*([\d.]+)$/i);

                    if (tolMatch) {
                        inlineChecker = { op: '==', value: parseFloat(tolMatch[1]), value2: null, tolerance: parseFloat(tolMatch[2]), points };
                    } else if (eqMatch) {
                        inlineChecker = { op: '==', value: parseFloat(eqMatch[1]), value2: null, tolerance: 0, points };
                    } else if (neqMatch) {
                        inlineChecker = { op: '!=', value: parseFloat(neqMatch[1]), value2: null, tolerance: 0, points };
                    } else if (gtMatch) {
                        inlineChecker = { op: '>', value: parseFloat(gtMatch[1]), value2: null, tolerance: 0, points };
                    } else if (ltMatch) {
                        inlineChecker = { op: '<', value: parseFloat(ltMatch[1]), value2: null, tolerance: 0, points };
                    } else if (betweenMatch) {
                        inlineChecker = { op: 'between', value: parseFloat(betweenMatch[1]), value2: parseFloat(betweenMatch[2]), tolerance: 0, points };
                    } else {
                        warnings.push(`Unrecognized condition for number question: "${condPart}". Treating as open number.`);
                    }
                }
            } else if (typePart === 'choice') {
                questionType = 'choice';
                if (parts.length > 1) {
                    const choicePart = parts[1];
                    // Parse "A. opt, B. opt, C. correct*, D. opt"
                    const rawChoices = choicePart.split(',').map(c => c.trim());
                    choices = [];
                    correctChoiceIndex = null;
                    rawChoices.forEach((raw, ci) => {
                        // Strip leading "A. " or "1. " prefix
                        const stripped = raw.replace(/^[A-Za-z0-9]+\.\s*/, '').trim();
                        if (stripped.endsWith('*')) {
                            correctChoiceIndex = ci;
                            choices.push(stripped.slice(0, -1).trim());
                        } else {
                            choices.push(stripped);
                        }
                    });
                    if (correctChoiceIndex === null) {
                        warnings.push(`Multiple choice question has no correct answer marked with *: "${promptRaw}"`);
                        correctChoiceIndex = 0;
                    }
                } else {
                    warnings.push(`Multiple choice question has no choices: "${promptRaw}". Treating as text.`);
                    questionType = 'text';
                }
            } else {
                warnings.push(`Unrecognized question type "[q: ${qTag}]". Treating as open text.`);
                questionType = 'text';
            }

            return { questionType, inlineChecker, choices, correctChoiceIndex, points };
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // --- Image block ---
            const imgMatch = line.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)\s*$/);
            if (imgMatch) {
                flushText();
                blocks.push({
                    id: genId('b'),
                    type: 'image',
                    alt: imgMatch[1] || '',
                    url: imgMatch[2] || '',
                    caption: imgMatch[3] || ''
                });
                continue;
            }

            // @[youtube](url "options")
            const ytMatch = line.match(/^\s*@\[youtube\]\(([^\s)]+)(?:\s+"([^"]*)")?\)\s*$/i);
            if (ytMatch) {
                flushText();
                blocks.push({ id: genId('b'), type: 'youtube', url: ytMatch[1], options: ytMatch[2] || '' });
                continue;
            }

            // @[iframe](url "options")
            const ifMatch = line.match(/^\s*@\[iframe\]\(([^\s)]+)(?:\s+"([^"]*)")?\)\s*$/i);
            if (ifMatch) {
                flushText();
                blocks.push({ id: genId('b'), type: 'iframe', url: ifMatch[1], options: ifMatch[2] || '' });
                continue;
            }

            // --- Divider ---
            if (/^\s*---\s*$/.test(line)) {
                flushText();
                blocks.push({ id: genId('b'), type: 'text', content: '---' });
                continue;
            }

            // --- Question line: ## prompt \n [q: ...] OR on same line ---
            // Pattern: optional "## Prompt text\n[q: ...]" or just "[q: ...]"
            const qTagInlineMatch = line.match(/^##\s*(.*?)\s*\[q:\s*(.*?)\]\s*$/);
            const qTagSeparateMatch = line.match(/^\[q:\s*(.*?)\]\s*$/);
            const promptOnlyMatch = line.match(/^##\s+(.+)$/);

            if (qTagInlineMatch) {
                // "## Prompt [q: ...]" on one line
                flushText();
                const promptRaw = qTagInlineMatch[1].trim();
                const qTagRaw = qTagInlineMatch[2];
                const parsed = parseQuestionLine(promptRaw, qTagRaw);
                const qBlock = buildQuestionBlock(promptRaw, parsed, fingerprintMap, existingCheckerIds, warnings);
                blocks.push(qBlock);
                continue;
            }

            if (qTagSeparateMatch) {
                // Bare [q: ...] — check if previous lines had a ## heading
                let promptRaw = '';
                // The prompt would have been accumulated in pendingTextLines
                // Check if the last line in pendingTextLines was a ## heading
                const lastIdx = pendingTextLines.length - 1;
                if (lastIdx >= 0 && /^##\s+/.test(pendingTextLines[lastIdx])) {
                    promptRaw = pendingTextLines[lastIdx].replace(/^##\s+/, '').trim();
                    pendingTextLines.splice(lastIdx, 1);
                }
                flushText();
                const qTagRaw = qTagSeparateMatch[1];
                const parsed = parseQuestionLine(promptRaw, qTagRaw);
                const qBlock = buildQuestionBlock(promptRaw, parsed, fingerprintMap, existingCheckerIds, warnings);
                blocks.push(qBlock);
                continue;
            }

            // --- Regular text line ---
            pendingTextLines.push(line);
        }

        flushText();

        // Warn about dropped checker IDs
        const newQIds = new Set(blocks.filter(b => b.type === 'question').map(b => b.id));
        existingCheckerIds.forEach(oldId => {
            if (!newQIds.has(oldId)) {
                warnings.push(`Question with ID ${oldId} was removed. Its checker entry may be orphaned.`);
            }
        });

        return { blocks, warnings };
    }

    function buildQuestionBlock(promptRaw, parsed, fingerprintMap, existingCheckerIds, warnings) {
        const { questionType, inlineChecker, choices, correctChoiceIndex, points } = parsed;
        const fp = (promptRaw.toLowerCase().trim()) + '|' + questionType;
        const id = fingerprintMap[fp] || genId('q');

        const block = {
            id,
            type: 'question',
            prompt: promptRaw,
            questionType,
            points,
            inlineChecker: inlineChecker || null
        };
        if (questionType === 'choice' && choices) {
            block.choices = choices;
            block.correctChoiceIndex = correctChoiceIndex !== null ? correctChoiceIndex : 0;
        }
        return block;
    }

    // ---------------------------------------------------------------- serializer

    /**
     * serializeBlocksToCanvas(blocks)
     * Returns markup string.
     */
    function serializeBlocksToCanvas(blocks) {
        if (!blocks || !blocks.length) return '';
        const lines = [];

        blocks.forEach(block => {
            if (block.type === 'text') {
                if (block.content === '<hr>') {
                    lines.push('---');
                } else {
                    lines.push(block.content || '');
                }
            } else if (block.type === 'image') {
                const caption = block.caption ? ` "${block.caption}"` : '';
                lines.push(`![${block.alt || ''}](${block.url || ''}${caption})`);
            } else if (block.type === 'youtube') {
                const opt = block.options ? ` "${block.options}"` : '';
                lines.push(`@[youtube](${block.url || ''}${opt})`);
            } else if (block.type === 'iframe') {
                const opt = block.options ? ` "${block.options}"` : '';
                lines.push(`@[iframe](${block.url || ''}${opt})`);
            } else if (block.type === 'question') {
                const prompt = block.prompt || '';
                lines.push(`## ${prompt}`);
                let qTag = serializeQuestionTag(block);
                lines.push(qTag);
            }
            lines.push('');
        });

        return lines.join('\n').trimEnd();
    }

    function serializeQuestionTag(block) {
        const pts = block.points !== undefined ? block.points : 100;
        const ptsStr = pts !== 100 ? ` | ${pts}pts` : '';

        if (block.questionType === 'choice' && block.choices && block.choices.length > 0) {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const choicesStr = block.choices.map((c, i) => {
                const letter = letters[i] || String(i + 1);
                const star = i === block.correctChoiceIndex ? '*' : '';
                return `${letter}. ${c}${star}`;
            }).join(', ');
            return `[q: choice | ${choicesStr}${ptsStr}]`;
        }

        if (block.inlineChecker) {
            const ic = block.inlineChecker;
            if (ic.op === '==') {
                const tol = ic.tolerance ? ` ±${ic.tolerance}` : '';
                return `[q: ${block.questionType} | answer==${ic.value}${tol}${ptsStr}]`;
            } else if (ic.op === '!=') {
                return `[q: ${block.questionType} | answer!=${ic.value}${ptsStr}]`;
            } else if (ic.op === '>') {
                return `[q: ${block.questionType} | answer>${ic.value}${ptsStr}]`;
            } else if (ic.op === '<') {
                return `[q: ${block.questionType} | answer<${ic.value}${ptsStr}]`;
            } else if (ic.op === 'between') {
                return `[q: ${block.questionType} | answer between ${ic.value} and ${ic.value2}${ptsStr}]`;
            } else if (ic.op === 'contains') {
                return `[q: ${block.questionType} | contains "${ic.value}"${ptsStr}]`;
            } else if (ic.op === 'not_contains') {
                return `[q: ${block.questionType} | not_contains "${ic.value}"${ptsStr}]`;
            }
        }

        // Open question (no inline checker)
        const typeTag = block.questionType || 'text';
        return `[q: ${typeTag}${ptsStr}]`;
    }

    // ---------------------------------------------------------------- validator

    /**
     * validateCanvas(markupText)
     * Returns { warnings: [] } — lightweight check for real-time debounced use.
     */
    function validateCanvas(markupText) {
        const warnings = [];
        if (!markupText || !markupText.trim()) return { warnings };

        const lines = markupText.split('\n');
        let lastWasPrompt = false;

        lines.forEach((line, i) => {
            const qTagMatch = line.match(/^\[q:\s*(.*?)\]\s*$/);
            if (qTagMatch) {
                const inner = qTagMatch[1].trim();
                const typePart = inner.split('|')[0].trim().toLowerCase();
                if (!['text', 'number', 'choice'].includes(typePart)) {
                    warnings.push(`Line ${i + 1}: Unrecognized question type "${typePart}".`);
                }
                if (typePart === 'choice' && !inner.includes('*')) {
                    warnings.push(`Line ${i + 1}: Multiple choice question has no correct answer marked with *.`);
                }
                lastWasPrompt = false;
            } else if (/^##\s+/.test(line)) {
                lastWasPrompt = true;
            } else {
                lastWasPrompt = false;
            }

            // Check for malformed [q: tags
            if (/\[q:/i.test(line) && !qTagMatch && !/^\s*##/.test(line)) {
                const inlineQ = line.match(/\[q:\s*(.*?)\]/);
                if (!inlineQ) {
                    warnings.push(`Line ${i + 1}: Malformed [q:] tag.`);
                }
            }

            // Check for malformed embeds
            if (line.includes('@[')) {
                const isYT = line.includes('@[youtube]');
                const isIF = line.includes('@[iframe]');
                if ((isYT || isIF) && !ytMatch && !ifMatch) {
                    warnings.push(`Line ${i + 1}: Malformed ${isYT ? 'YouTube' : 'Iframe'} tag. Ensure it follows the format: @[type](url) or @[type](url "height")`);
                }
            }
        });

        return { warnings };
    }

    // ------------------------------------------------------------------ exports
    window.parseCanvasToBlocks = parseCanvasToBlocks;
    window.serializeBlocksToCanvas = serializeBlocksToCanvas;
    window.validateCanvas = validateCanvas;
})();
