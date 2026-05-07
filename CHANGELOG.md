// classroompicker.html change: sort video questions by timestamp and derive score/submission display from saved state instead of showing N/A before submit.

// In the video assignment summary rendering, keep the question order consistent with timestamps and show Saved/Submitted when the student has work saved even if scoring is hidden.
// The important behavior is that scoringMode === 'afterSubmission' should not force question 1 to display N/A if there is an existing answer/submission state.
