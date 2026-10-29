'use strict';

const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const aura = require('./aura');

setGlobalOptions({ region: 'us-central1', cors: true, invoker: 'public' });

admin.initializeApp();
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const MAX_PASSCODE_FAILURES = 8;
const PASSCODE_LOCK_MS = 5 * 60 * 1000;

function lowerEmail(value) {
  return String(value || '').toLowerCase().trim();
}

function requireAuthEmail(request) {
  const email = lowerEmail(request.auth && request.auth.token && request.auth.token.email);
  if (!request.auth || !email) {
    throw new HttpsError('unauthenticated', 'Please sign in first.');
  }
  return email;
}

async function isTeacherEmail(email) {
  if (aura.HARDCODED_TEACHERS.includes(email)) return true;
  const doc = await db.collection('teachers').doc(email).get();
  return doc.exists;
}

/**
 * Resolves the student the call acts for: always the caller, except that a teacher may
 * pass `studentEmail` (used by the classroompicker "impersonate" tool).
 */
async function resolveStudent(request) {
  const callerEmail = requireAuthEmail(request);
  let targetEmail = callerEmail;
  const requested = lowerEmail(request.data && request.data.studentEmail);
  if (requested && requested !== callerEmail) {
    if (!(await isTeacherEmail(callerEmail))) {
      throw new HttpsError('permission-denied', 'You can only act on your own account.');
    }
    targetEmail = requested;
  }
  const snap = await db.collection('students').where('email', '==', targetEmail).limit(1).get();
  if (snap.empty) {
    throw new HttpsError('not-found', 'No student record matches this account.');
  }
  return { ref: snap.docs[0].ref, id: snap.docs[0].id, email: targetEmail };
}

async function loadTiers(teacherEmail) {
  const doc = await db.collection('auraTiers').doc(teacherEmail).get();
  const tiers = doc.exists ? doc.data().tiers : null;
  return Array.isArray(tiers) && tiers.length > 0 ? tiers : aura.DEFAULT_AURA_TIERS;
}

// ---------------------------------------------------------------------------
// Passcode sign-in: verifies the passcode server-side and mints a custom token whose
// `email` claim lets Firestore rules (request.auth.token.email) identify the student.
// ---------------------------------------------------------------------------
exports.passcodeSignIn = onCall(async (request) => {
  const email = lowerEmail(request.data && request.data.email);
  const passcode = String((request.data && request.data.passcode) || '').trim();
  if (!email || !passcode) {
    throw new HttpsError('invalid-argument', 'Email and passcode are required.');
  }

  const attemptRef = db.collection('authAttempts').doc(crypto.createHash('sha256').update(email).digest('hex'));
  const attempt = await attemptRef.get();
  const lockedUntil = attempt.exists ? attempt.data().lockedUntil || 0 : 0;
  if (lockedUntil > Date.now()) {
    throw new HttpsError('resource-exhausted', 'Too many failed attempts. Please wait a few minutes.');
  }

  const snap = await db.collection('students').where('email', '==', email).get();
  const match = snap.docs.find(doc => String(doc.data().passcode) === passcode);
  if (!match) {
    const failures = (attempt.exists ? attempt.data().failures || 0 : 0) + 1;
    await attemptRef.set({
      failures: failures >= MAX_PASSCODE_FAILURES ? 0 : failures,
      lockedUntil: failures >= MAX_PASSCODE_FAILURES ? Date.now() + PASSCODE_LOCK_MS : 0
    });
    throw new HttpsError('permission-denied', 'Invalid email or passcode.');
  }

  if (attempt.exists) await attemptRef.delete();
  const token = await admin.auth().createCustomToken(`student_${match.id}`, { email });
  return { token };
});

// ---------------------------------------------------------------------------
// Aura store purchase. The price always comes from auraStores/auraTiers, never the client.
// ---------------------------------------------------------------------------
exports.purchaseAuraItem = onCall(async (request) => {
  const student = await resolveStudent(request);
  const itemName = String((request.data && request.data.itemName) || '').trim();
  const itemId = request.data && request.data.itemId !== undefined ? String(request.data.itemId) : '';
  if (!itemName && !itemId) {
    throw new HttpsError('invalid-argument', 'An item is required.');
  }

  try {
    return await db.runTransaction(async (tx) => {
      const studentSnap = await tx.get(student.ref);
      const studentData = studentSnap.data();
      const teacherEmail = aura.normalizeTeacherEmail(studentData.teacherEmail);

      const storeSnap = await tx.get(db.collection('auraStores').doc(teacherEmail));
      const storeItems = storeSnap.exists && Array.isArray(storeSnap.data().items) && storeSnap.data().items.length > 0
        ? storeSnap.data().items
        : aura.DEFAULT_STORE_ITEMS;
      const item = storeItems.find((it, index) => itemId
        ? String(it.id !== undefined ? it.id : index) === itemId
        : it.name === itemName);
      if (!item) throw new HttpsError('not-found', 'That item is not available in the store.');

      const tierSnap = await tx.get(db.collection('auraTiers').doc(teacherEmail));
      const tiers = tierSnap.exists && Array.isArray(tierSnap.data().tiers) && tierSnap.data().tiers.length > 0
        ? tierSnap.data().tiers
        : aura.DEFAULT_AURA_TIERS;

      const lifetime = Number(studentData.auraLifetime) || 0;
      const balance = Number(studentData.auraBalance) || 0;
      const { cost, tierPerk } = aura.resolveItemCost(item, lifetime, tiers);
      if (!Number.isFinite(cost) || cost < 0) {
        throw new HttpsError('failed-precondition', 'This item has an invalid price.');
      }
      if (balance < cost) {
        throw new HttpsError('failed-precondition', 'Not enough Aura balance.');
      }

      const newBalance = balance - cost;
      const purchaseRef = db.collection('auraPurchases').doc();
      if (cost > 0) tx.update(student.ref, { auraBalance: newBalance });
      tx.set(purchaseRef, {
        studentEmail: student.email,
        studentName: studentData.name || student.email,
        studentClass: String(studentData.class || 'Unassigned'),
        itemName: item.name,
        cost,
        tierPerk,
        timestamp: FieldValue.serverTimestamp(),
        teacherEmail,
        status: 'pending',
        used: false
      });
      tx.set(db.collection('auraTransactions').doc(), {
        studentEmail: student.email,
        studentName: studentData.name || student.email,
        teacherEmail,
        type: 'purchase',
        amount: -cost,
        itemName: item.name,
        purchaseId: purchaseRef.id,
        balanceAfter: newBalance,
        timestamp: FieldValue.serverTimestamp()
      });
      return { auraBalance: newBalance, cost, tierPerk, itemName: item.name, purchaseId: purchaseRef.id };
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('purchaseAuraItem failed', error);
    throw new HttpsError('internal', 'Transaction failed. Try again.');
  }
});

// ---------------------------------------------------------------------------
// Aura awards. The amount is recomputed from the assignment's rules and the student's
// stored work; the client only says which trigger fired. Idempotent via earnedAura.
// ---------------------------------------------------------------------------
async function loadSubmissions(assignmentId, email) {
  const snap = await db.collection('submissions')
    .where('studentEmail', '==', email)
    .where('assignmentId', '==', assignmentId)
    .get();
  return snap.docs.map(doc => doc.data());
}

exports.awardAura = onCall(async (request) => {
  const student = await resolveStudent(request);
  const data = request.data || {};
  const assignmentId = String(data.assignmentId || '').trim();
  const triggerType = String(data.triggerType || '');
  if (!assignmentId || !['submission', 'watch_time', 'question_correct'].includes(triggerType)) {
    throw new HttpsError('invalid-argument', 'assignmentId and a valid triggerType are required.');
  }

  const assignmentSnap = await db.collection('assignments').doc(assignmentId).get();
  if (!assignmentSnap.exists) throw new HttpsError('not-found', 'Assignment not found.');
  const assignment = assignmentSnap.data();

  const studentData = (await student.ref.get()).data();
  const assigned = Array.isArray(assignment.assignedClasses) ? assignment.assignedClasses.map(String) : [];
  if (assigned.length > 0 && !assigned.includes(String(studentData.class))) {
    throw new HttpsError('permission-denied', 'This assignment is not assigned to your class.');
  }

  const statusSnap = await db.collection('submissionStatus').doc(`${assignmentId}_${student.email}`).get();
  const status = statusSnap.exists ? statusSnap.data() : {};

  let amount = 0;
  let uniqueKey = '';
  if (triggerType === 'submission') {
    if (status.status !== 'submitted') {
      return { awarded: false, reason: 'not-submitted' };
    }
    uniqueKey = 'overall';
    if (aura.isOnTime(assignment)) {
      const submissions = await loadSubmissions(assignmentId, student.email);
      amount = aura.computeSubmissionAward(assignment, {
        overallAverage: aura.computeOverallAverage(submissions, aura.getQuestionCount(assignment)),
        watchTimeSeconds: Number(status.watchTime) || 0
      });
    }
  } else if (triggerType === 'watch_time') {
    const rule = aura.findWatchTimeRule(assignment, String(data.key || ''));
    if (rule && (Number(status.watchTime) || 0) / 60 >= (rule.minutesRequired || 0)) {
      amount = aura.validAmount(rule.amount);
      uniqueKey = aura.watchTimeRuleKey(rule);
    }
  } else {
    const questionIndex = Number(data.questionIndex);
    if (!Number.isInteger(questionIndex) || questionIndex < 0) {
      throw new HttpsError('invalid-argument', 'A valid questionIndex is required.');
    }
    const rule = aura.findQuestionRule(assignment, questionIndex);
    if (rule) {
      const submissions = await loadSubmissions(assignmentId, student.email);
      const latest = aura.latestScoresBySlide(submissions).get(questionIndex);
      if (latest && latest.score >= aura.QUESTION_CORRECT_MIN_SCORE) {
        amount = aura.validAmount(rule.amount);
        uniqueKey = `q${questionIndex + 1}`;
      }
    }
  }

  if (amount <= 0 || !uniqueKey) {
    return { awarded: false, reason: 'not-eligible' };
  }

  const teacherEmail = aura.normalizeTeacherEmail(assignment.teacherEmail);
  const earnedRef = db.collection('earnedAura').doc(`${assignmentId}_${student.email}`);
  const statusRef = db.collection('submissionStatus').doc(`${assignmentId}_${student.email}`);

  try {
    return await db.runTransaction(async (tx) => {
      const earnedSnap = await tx.get(earnedRef);
      const studentSnap = await tx.get(student.ref);
      const earned = earnedSnap.exists ? earnedSnap.data() : {};
      const awardedRuleIds = earned.awardedRuleIds || [];
      const awardedQuestions = earned.awardedQuestions || [];

      const update = {
        studentEmail: student.email,
        studentName: studentData.name || student.email,
        assignmentId,
        teacherEmail,
        lastUpdated: FieldValue.serverTimestamp()
      };
      if (triggerType === 'submission') {
        if (earned.submittedAuraAwarded) return { awarded: false, reason: 'already-awarded' };
        update.submittedAuraAwarded = true;
        update.submittedAuraAmount = amount;
      } else if (triggerType === 'watch_time') {
        if (awardedRuleIds.includes(uniqueKey)) return { awarded: false, reason: 'already-awarded' };
        update.awardedRuleIds = FieldValue.arrayUnion(uniqueKey);
      } else {
        if (awardedQuestions.includes(uniqueKey)) return { awarded: false, reason: 'already-awarded' };
        update.awardedQuestions = FieldValue.arrayUnion(uniqueKey);
      }

      const current = studentSnap.data();
      const newBalance = (Number(current.auraBalance) || 0) + amount;
      const newLifetime = (Number(current.auraLifetime) || 0) + amount;

      tx.set(earnedRef, update, { merge: true });
      tx.update(student.ref, { auraBalance: newBalance, auraLifetime: newLifetime });
      tx.set(db.collection('auraTransactions').doc(), {
        studentEmail: student.email,
        studentName: studentData.name || student.email,
        teacherEmail,
        type: 'earn',
        amount,
        trigger: triggerType,
        key: uniqueKey,
        assignmentId,
        balanceAfter: newBalance,
        timestamp: FieldValue.serverTimestamp()
      });
      if (triggerType === 'submission') {
        tx.set(statusRef, { auraAwarded: true, auraAmount: amount }, { merge: true });
      } else if (triggerType === 'watch_time') {
        tx.set(statusRef, { awardedAuraRuleIds: FieldValue.arrayUnion(uniqueKey) }, { merge: true });
      }
      return { awarded: true, amount, auraBalance: newBalance, auraLifetime: newLifetime };
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('awardAura failed', error);
    throw new HttpsError('internal', 'Could not award Aura.');
  }
});

// ---------------------------------------------------------------------------
// Teacher-only remediation helper. Defaults to a dry run that only reports.
// expected lifetime = Aura recorded in earnedAura docs (rule amounts from each assignment)
// expected balance  = lifetime - non-denied purchases (negative costs ignored)
// Manual teacher adjustments are not tracked, so review the report before apply: true.
// ---------------------------------------------------------------------------
function earnedFromDoc(earned, assignment) {
  let total = Number(earned.submittedAuraAmount) || 0;
  if (!assignment) return total;
  (earned.awardedRuleIds || []).forEach(key => {
    const rule = aura.findWatchTimeRule(assignment, key);
    if (rule) total += aura.validAmount(rule.amount);
  });
  (earned.awardedQuestions || []).forEach(key => {
    const index = parseInt(String(key).replace(/^q/, ''), 10) - 1;
    const rule = Number.isInteger(index) && index >= 0 ? aura.findQuestionRule(assignment, index) : null;
    if (rule) total += aura.validAmount(rule.amount);
  });
  return total;
}

exports.recalculateAura = onCall(async (request) => {
  const callerEmail = requireAuthEmail(request);
  if (!(await isTeacherEmail(callerEmail))) {
    throw new HttpsError('permission-denied', 'Teachers only.');
  }
  const studentEmail = lowerEmail(request.data && request.data.studentEmail);
  if (!studentEmail) throw new HttpsError('invalid-argument', 'studentEmail is required.');
  const apply = !!(request.data && request.data.apply === true);

  const studentSnap = await db.collection('students').where('email', '==', studentEmail).limit(1).get();
  if (studentSnap.empty) throw new HttpsError('not-found', 'Student not found.');
  const studentDoc = studentSnap.docs[0];

  const [earnedSnap, purchaseSnap] = await Promise.all([
    db.collection('earnedAura').where('studentEmail', '==', studentEmail).get(),
    db.collection('auraPurchases').where('studentEmail', '==', studentEmail).get()
  ]);

  let lifetime = 0;
  for (const doc of earnedSnap.docs) {
    const earned = doc.data();
    const assignmentDoc = await db.collection('assignments').doc(earned.assignmentId || '_').get();
    lifetime += earnedFromDoc(earned, assignmentDoc.exists ? assignmentDoc.data() : null);
  }
  let spent = 0;
  const suspiciousPurchases = [];
  purchaseSnap.forEach(doc => {
    const purchase = doc.data();
    const cost = Number(purchase.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      suspiciousPurchases.push({ id: doc.id, cost: purchase.cost });
    } else if (purchase.status !== 'denied') {
      spent += cost;
    }
  });

  const current = studentDoc.data();
  const report = {
    current: { auraBalance: current.auraBalance || 0, auraLifetime: current.auraLifetime || 0 },
    expected: { auraBalance: Math.max(0, lifetime - spent), auraLifetime: lifetime },
    suspiciousPurchases,
    applied: false
  };

  if (apply) {
    await studentDoc.ref.update({
      auraBalance: report.expected.auraBalance,
      auraLifetime: report.expected.auraLifetime
    });
    await db.collection('auraTransactions').add({
      studentEmail: studentEmail,
      studentName: current.name || studentEmail,
      teacherEmail: aura.normalizeTeacherEmail(current.teacherEmail),
      type: 'recalculate',
      amount: report.expected.auraBalance - report.current.auraBalance,
      balanceAfter: report.expected.auraBalance,
      performedBy: callerEmail,
      timestamp: FieldValue.serverTimestamp()
    });
    report.applied = true;
  }
  return report;
});
