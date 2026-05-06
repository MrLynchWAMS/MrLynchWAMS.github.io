/**
 * shared/blank-renderer.js
 * Centralized rendering logic for blank assignments (Markdown, Math, Tables).
 */

(function () {
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatInline(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '<em>$1</em>')
            .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    function renderTextBlockContent(content) {
        if (!content) return '';
        const lines = String(content).replace(/\r\n/g, '\n').split('\n');
        const out = [];
        let inList = false;
        let listType = null;
        let inTable = false;
        let tableRows = [];

        const closeList = () => {
            if (inList) {
                out.push(listType === 'ul' ? '</ul>' : '</ol>');
                inList = false;
                listType = null;
            }
        };

        const closeTable = () => {
            if (inTable) {
                let html = '<div class="overflow-x-auto my-4"><table class="w-full text-sm text-left border-collapse border border-gray-700">';
                tableRows.forEach((row, i) => {
                    const isHeader = i === 0;
                    const tag = isHeader ? 'th' : 'td';
                    const bg = isHeader ? 'bg-gray-900/50' : '';
                    html += `<tr class="${bg}">`;
                    row.forEach(cell => {
                        html += `<${tag} class="border border-gray-700 p-2">${formatInline(cell)}</${tag}>`;
                    });
                    html += '</tr>';
                });
                html += '</table></div>';
                out.push(html);
                inTable = false;
                tableRows = [];
            }
        };

        lines.forEach(line => {
            const trimmed = line.trim();

            // Table check
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                closeList();
                const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
                // Skip separator row like |---|---|
                if (cells.every(c => /^:?-+:?$/.test(c))) return;

                if (!inTable) inTable = true;
                tableRows.push(cells);
                return;
            }
            closeTable();

            if (!trimmed) {
                closeList();
                return;
            }
            const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
            if (heading) {
                closeList();
                const level = heading[1].length;
                out.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
                return;
            }
            if (/^---+$/.test(trimmed)) {
                closeList();
                out.push('<hr>');
                return;
            }
            const bullet = trimmed.match(/^[-*]\s+(.*)$/);
            const number = trimmed.match(/^\d+[.)]\s+(.*)$/);
            if (bullet || number) {
                const type = bullet ? 'ul' : 'ol';
                const itemText = bullet ? bullet[1] : number[1];
                if (!inList || listType !== type) {
                    closeList();
                    out.push(type === 'ul' ? '<ul>' : '<ol>');
                    inList = true;
                    listType = type;
                }
                out.push(`<li>${formatInline(itemText)}</li>`);
                return;
            }
            closeList();
            out.push(`<p>${formatInline(trimmed)}</p>`);
        });
        closeList();
        closeTable();
        return out.join('\n');
    }

    function renderMathContent(element) {
        if (window.renderMathInElement) {
            renderMathInElement(element, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        }
    }

    function evaluateInlineChecker(studentAnswer, checker) {
        if (!checker) return 0;

        // Multi-condition support (from canvas AND/OR syntax)
        if (checker.type === 'multi') {
            const ctx = {};
            const results = checker.conditions.map(c => {
                const s = String(studentAnswer || '').toLowerCase().trim();
                if (c.op === 'contains') return s.includes(String(c.value || '').toLowerCase());
                if (c.op === 'not_contains') return !s.includes(String(c.value || '').toLowerCase());
                if (c.op === 'equals_str') return s === String(c.value || '').toLowerCase();
                return false;
            });
            const pass = checker.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
            return pass ? (checker.points || 100) : 0;
        }

        const { op, value, value2, tolerance, points } = checker;
        const studentNum = parseFloat(studentAnswer);
        const checkNum = parseFloat(value);
        const checkNum2 = parseFloat(value2);
        const tol = parseFloat(tolerance || 0);

        let pass = false;
        const s = String(studentAnswer || '').toLowerCase().trim();
        const v = String(value || '').toLowerCase().trim();

        switch (op) {
            case 'contains': pass = s.includes(v); break;
            case 'not_contains': pass = !s.includes(v); break;
            case '==': pass = Math.abs(studentNum - checkNum) <= tol; break;
            case '!=': pass = Math.abs(studentNum - checkNum) > tol; break;
            case '>': pass = studentNum > checkNum; break;
            case '<': pass = studentNum < checkNum; break;
            case 'between': pass = studentNum >= checkNum && studentNum <= checkNum2; break;
        }
        return pass ? (points || 100) : 0;
    }

    function renderYoutube(url, options) {
        let videoId = '';
        const youtubeIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(youtubeIdRegex);
        if (match && match[1]) videoId = match[1];

        if (!videoId) return `<div class="bg-red-900/20 p-4 rounded text-red-400 text-sm">Invalid YouTube URL: ${escapeHtml(url)}</div>`;
        
        let style = '';
        if (options && !isNaN(options)) {
            style = `style="height: ${options}px; padding-bottom: 0;"`;
        }

        return `<div class="relative w-full pb-[56.25%] h-0 rounded-lg overflow-hidden border border-gray-700 bg-black" ${style}>
            <iframe src="https://www.youtube.com/embed/${videoId}" 
                class="absolute top-0 left-0 w-full h-full" 
                frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen></iframe>
        </div>`;
    }

    function renderIframe(url, options) {
        let height = '500px';
        if (options && !isNaN(options)) height = options + 'px';
        else if (options) height = options; // Allow strings like "80vh"

        return `<div class="relative w-full rounded-lg overflow-hidden border border-gray-700 bg-gray-900" style="height: ${height};">
            <iframe src="${escapeHtml(url)}" 
                class="w-full h-full" 
                frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen></iframe>
        </div>`;
    }

    // Export to window
    window.BlankRenderer = {
        renderTextBlockContent,
        renderMathContent,
        evaluateInlineChecker,
        renderYoutube,
        renderIframe,
        escapeHtml,
        formatInline
    };
})();
