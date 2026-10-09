// Shared teacher-side helpers: real-time grade review request scope (owned / parent / co-taught)
// and pending-count notification badges for Aura purchases and grade reviews.
(function () {
    function normalizeEmail(email) {
        return (email || '').toLowerCase().replace(/\s+/g, '').trim();
    }

    function emailVariants(email) {
        return [...new Set([email, (email || '').toLowerCase(), (email || '').toLowerCase().trim(), normalizeEmail(email)])].filter(Boolean);
    }

    function chunk(arr, size) {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
    }

    function isAuraPending(p) {
        return p.status === 'pending' || (!p.status && !p.used);
    }

    // Listens to gradeReviewRequests visible to this teacher:
    //  - requests whose teacherEmail is the teacher (any email variant) or a parent teacher (coTeachingFor)
    //  - requests linked to an assignment the teacher co-teaches (assignments.coTeachers)
    // onUpdate receives the merged, de-duplicated array of { id, ...data }. Returns an unsubscribe function.
    window.listenGradeReviewRequests = function (db, email, onUpdate, onError) {
        const unsubs = [];
        const bySource = {};
        let cancelled = false;

        function emit() {
            const merged = new Map();
            Object.values(bySource).forEach(list => list.forEach(r => merged.set(r.id, r)));
            onUpdate(Array.from(merged.values()));
        }

        function listen(key, query) {
            bySource[key] = [];
            unsubs.push(query.onSnapshot(snap => {
                bySource[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                emit();
            }, err => { if (onError) onError(err); }));
        }

        (async () => {
            const owners = new Set(emailVariants(email));
            try {
                const parents = await db.collection('teachers').where('coTeachingFor', 'array-contains', (email || '').toLowerCase()).get();
                parents.docs.forEach(d => owners.add(d.id));
            } catch (e) {
                console.error('Grade reviews: error fetching parent teachers', e);
            }
            if (cancelled) return;
            chunk(Array.from(owners), 10).forEach((ids, i) => listen(`owner-${i}`, db.collection('gradeReviewRequests').where('teacherEmail', 'in', ids)));

            try {
                const coTaught = await db.collection('assignments').where('coTeachers', 'array-contains', (email || '').toLowerCase()).get();
                if (cancelled) return;
                chunk(coTaught.docs.map(d => d.id), 10).forEach((ids, i) => listen(`coTaught-${i}`, db.collection('gradeReviewRequests').where('assignmentId', 'in', ids)));
            } catch (e) {
                console.error('Grade reviews: error fetching co-taught assignments', e);
            }
            if (!cancelled && Object.keys(bySource).length === 0) onUpdate([]);
        })();

        return () => {
            cancelled = true;
            unsubs.forEach(u => u());
        };
    };

    function setBadge(id, count, label) {
        const el = id && document.getElementById(id);
        if (!el) return;
        el.textContent = count > 99 ? '99+' : String(count);
        el.title = `${count} pending ${label}`;
        el.classList.toggle('hidden', count === 0);
    }

    // opts: { auraBadgeId, gradeBadgeId } - element ids of the red badge spans
    window.startTeacherBadges = function (db, email, opts = {}) {
        const unsubs = [];
        if (opts.auraBadgeId) {
            const bySource = {};
            chunk(emailVariants(email), 10).forEach((ids, i) => {
                unsubs.push(db.collection('auraPurchases').where('teacherEmail', 'in', ids).onSnapshot(snap => {
                    bySource[i] = snap.docs.filter(d => isAuraPending(d.data())).map(d => d.id);
                    const all = new Set(Object.values(bySource).flat());
                    setBadge(opts.auraBadgeId, all.size, 'Aura purchases');
                }, err => console.error('Aura badge listener error:', err)));
            });
        }
        if (opts.gradeBadgeId) {
            unsubs.push(window.listenGradeReviewRequests(db, email,
                list => setBadge(opts.gradeBadgeId, list.filter(r => r.status === 'pending').length, 'grade reviews'),
                err => console.error('Grade review badge listener error:', err)));
        }
        return () => unsubs.forEach(u => u());
    };
})();
