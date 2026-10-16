// Shared text-similarity helpers used for copy/paste (passage-dumping) detection.
// Plain script (no build step): attaches `Similarity` to window. All functions are pure and
// safe to call with empty / non-string input.
(function () {
    'use strict';

    // Removes HTML tags and common markdown syntax so passage text can be compared to a plain answer.
    function stripMarkup(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/<[^>]*>/g, ' ')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/\$\$[\s\S]*?\$\$/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/[*_`#>|]/g, ' ');
    }

    // Lowercase, strip punctuation, collapse whitespace.
    function normalizeText(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function toWords(str) {
        const normalized = normalizeText(str);
        return normalized ? normalized.split(' ') : [];
    }

    function wordCount(str) {
        return toWords(str).length;
    }

    function shingleSet(words, n) {
        const set = new Set();
        for (let i = 0; i + n <= words.length; i++) {
            set.add(words.slice(i, i + n).join(' '));
        }
        return set;
    }

    // Longest run of consecutive words shared by both word arrays (longest common substring over words).
    function longestCommonRun(a, b) {
        if (!a.length || !b.length) return 0;
        let prev = new Array(b.length + 1).fill(0);
        let best = 0;
        for (let i = 1; i <= a.length; i++) {
            const cur = new Array(b.length + 1).fill(0);
            for (let j = 1; j <= b.length; j++) {
                if (a[i - 1] === b[j - 1]) {
                    cur[j] = prev[j - 1] + 1;
                    if (cur[j] > best) best = cur[j];
                }
            }
            prev = cur;
        }
        return best;
    }

    /**
     * passageOverlap(answer, passageTexts, n = 5)
     * ratio: fraction of the answer's n-word shingles found in any passage (n shrinks for very short answers)
     * longestRun: longest run of consecutive answer words copied verbatim from a passage
     * matchedWords: number of answer words covered by a matching shingle
     */
    function passageOverlap(answer, passageTexts, n = 5) {
        const empty = { ratio: 0, longestRun: 0, matchedWords: 0 };
        try {
            const answerWords = toWords(answer);
            if (!answerWords.length) return empty;
            const passages = (Array.isArray(passageTexts) ? passageTexts : [passageTexts])
                .map(toWords)
                .filter(words => words.length > 0);
            if (!passages.length) return empty;

            const size = Math.max(1, Math.min(Math.floor(n) || 5, answerWords.length));
            const passageSets = passages.map(words => shingleSet(words, size));
            const covered = new Array(answerWords.length).fill(false);
            let totalShingles = 0;
            let matchedShingles = 0;
            for (let i = 0; i + size <= answerWords.length; i++) {
                totalShingles++;
                const shingle = answerWords.slice(i, i + size).join(' ');
                if (passageSets.some(set => set.has(shingle))) {
                    matchedShingles++;
                    for (let k = i; k < i + size; k++) covered[k] = true;
                }
            }

            let longestRun = 0;
            passages.forEach(words => {
                longestRun = Math.max(longestRun, longestCommonRun(answerWords, words));
            });

            return {
                ratio: totalShingles ? matchedShingles / totalShingles : 0,
                longestRun,
                matchedWords: covered.filter(Boolean).length
            };
        } catch (e) {
            return empty;
        }
    }

    // Jaccard similarity (0-1) of the two texts' word n-gram shingles. Intended for student-vs-student checks.
    function jaccardSimilarity(a, b, n = 3) {
        const wordsA = toWords(a);
        const wordsB = toWords(b);
        if (!wordsA.length || !wordsB.length) return 0;
        const size = Math.max(1, Math.min(Math.floor(n) || 3, wordsA.length, wordsB.length));
        const setA = shingleSet(wordsA, size);
        const setB = shingleSet(wordsB, size);
        let intersection = 0;
        setA.forEach(s => { if (setB.has(s)) intersection++; });
        const union = setA.size + setB.size - intersection;
        return union ? intersection / union : 0;
    }

    window.Similarity = { stripMarkup, normalizeText, wordCount, passageOverlap, jaccardSimilarity };
})();
