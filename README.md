# MrLynchWAMS.github.io

## Security model: Firestore rules and the Aura economy

Aura (`auraBalance`, `auraLifetime`) is **server-authoritative**. Students can no longer write it from the browser.

- `firestore.rules` – hardened rules (source of truth; paste/deploy to Firebase).
- `functions/` – Cloud Functions (Node 20, firebase-functions v6, firebase-admin):
  - `passcodeSignIn({ email, passcode })` – verifies the passcode server-side (with a failed-attempt lockout) and returns a custom token whose `email` claim is what the rules and functions use. Without this, passcode users had no Firebase Auth identity.
  - `purchaseAuraItem({ itemName })` – reads the real price from `auraStores/{teacherEmail}`, applies tier perks from `auraTiers/{teacherEmail}`, and in one transaction checks the balance, deducts it and writes `auraPurchases` + `auraTransactions`. The client never sends a cost.
  - `awardAura({ assignmentId, triggerType, key, questionIndex })` – recomputes the award from the assignment's `auraRules`, the student's `submissions` / `submissionStatus`, and the on-time setting. Idempotent through `earnedAura/{assignmentId}_{studentEmail}` (`submittedAuraAwarded`, `awardedRuleIds`, `awardedQuestions`). Also writes `submissionStatus.auraAwarded/auraAmount`.
  - `recalculateAura({ studentEmail, apply })` – teachers only. Dry run by default; reports expected vs. current balance and purchases with negative/invalid costs.

### Deploying

Cloud Functions require the Firebase **Blaze** plan (classroom usage stays within the free quota).

```bash
npm install -g firebase-tools
firebase login
firebase use <your-project-id>      # or add a .firebaserc
(cd functions && npm install)
firebase deploy --only functions,firestore:rules
```

Deploy the functions **before or together with** the rules and the updated `classroompicker.html`, otherwise purchases/awards will fail. The `authAttempts` collection (passcode lockout) has no client rules and is therefore server-only.

### Field names assumed by the rules

- `students`: `email`, `class`, `teacherEmail`, `auraBalance`, `auraLifetime` (the app's real lifetime field; `lifetimeAura` is blocked too), `passcode`, `isArchived`.
- `submissions`, `submissionStatus`, `questionProgress`, `earnedAura`, `auraTransactions`, `simulationData`, `focusViolations`: `studentEmail` (+ `assignmentId`).
- Doc ids: `submissionStatus` = `{assignmentId}_{email}`, `questionProgress` = `{assignmentId}_{email}_{slideIndex}`, `simulationData` = `{assignmentId}_{encodeURIComponent(email)}`, `earnedAura` = `{assignmentId}_{email}`. The rules enforce these ids for student writes.
- Students cannot touch `submissionStatus.auraAwarded/auraAmount/awardedAuraRuleIds` or `questionProgress.lockedScore`, cannot lower `attemptCount`, and cannot un-lock a locked question.
- Co-teachers that are not in `/teachers` keep access to submissions/status/progress through the assignment's `coTeachers` or the owner's `coTeachingFor` list.

### Finding / fixing tampering

1. `auraPurchases` with `cost < 0` (Firebase console filter, or `recalculateAura` reports them as `suspiciousPurchases`).
2. `students` whose `auraBalance` is far above `sum(earnedAura) - sum(purchases)`.
3. From a teacher account in the browser console on any signed-in page: 
   ```js
   const fn = firebase.functions().httpsCallable('recalculateAura');
   (await fn({ studentEmail: 'student@mtps.us' })).data;               // dry run
   (await fn({ studentEmail: 'student@mtps.us', apply: true })).data;  // apply
   ```
   Manual teacher adjustments are not tracked, so review the dry-run report first.

### Manual test plan

1. As a student (Google and passcode), open the console and try `firebase.firestore().collection('students').doc(id).update({auraBalance: 1e5})` → must be `permission-denied`. Same for `auraPurchases.add(...)`, `earnedAura`, `auraTransactions`, and reading/writing another student's `submissions`.
2. Buy an item (and a free tier-perk item): balance drops by the store price, a pending `auraPurchases` doc and an `auraTransactions` doc appear; teacher approves/denies in `aura-purchases.html`.
3. Submit an assignment with aura rules: aura awarded once; resubmitting does not award again. Repeat for video question/watch-time rules and focus-mode auto-submit.
4. Teacher dashboards, export, roster and class dashboard still load for teachers and co-teachers.

### Remaining risks / follow-ups

- **Grading still runs in the browser.** Scores in `submissions` are written by the client, so the server can verify ownership, rules, timing, attempt locks and idempotency, but not that a score was honestly earned. A student could still forge a high `submissions.score`. Follow-up: run checkers server-side (or have a function write the score).
- **Passcodes are readable** by any signed-in user because `students` is readable for leaderboards. A classmate could read a passcode and sign in as someone else. Follow-up: move `passcode` to a teacher-only collection (or store a hash) and update `roster.html`.
- `question_correct` rules no longer pay out at submit time (they previously matched with `minScore = 0`); they pay only through the per-question trigger.
