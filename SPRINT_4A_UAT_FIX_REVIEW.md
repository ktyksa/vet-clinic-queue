# Sprint 4A UAT Fix Review

## Fixed items

1. Diagnosis UAT blocker
   - Add Diagnosis now redirects back with clear error message instead of unhandled exception.
   - Diagnosis section is visually highlighted by URL target.
   - Diagnosis text help text is clearer for UAT and clinical use.
   - Diagnosis text also updates SOAP diagnosisSummary when the SOAP draft has no diagnosis summary yet.

2. Visit status from Medical Queue
   - Create Visit from Medical Queue now creates Visit as IN_PROGRESS, not CHECKED_IN.
   - This matches enterprise workflow: Queue IN_SERVICE -> Visit IN_PROGRESS.

3. Complete validation
   - Complete Visit requires FINALIZED SOAP and at least one active diagnosis.
   - Complete Medical Queue requires Visit, FINALIZED SOAP, and at least one active diagnosis.
   - Completing Queue also completes Visit and Appointment in one transaction.

4. Medical Queue visibility
   - Queue board now shows SOAP status and diagnosis count.
   - Open Visit becomes Continue SOAP when SOAP is DRAFT.
   - Complete button is locked until SOAP is FINALIZED and Diagnosis exists.

5. Visit List improvement
   - Summary cards changed to Today Visits / In Progress / SOAP Draft / Completed.
   - Visit table shows SOAP status and Diagnosis count.

## UAT target after patch

Appointment -> Medical Queue -> Visit -> SOAP Draft -> Diagnosis -> Finalize SOAP -> Complete Visit/Queue

Expected: UAT should no longer be blocked at SOAP Draft if Add Diagnosis succeeds.

## Notes

- Vital Signs are still a future foundation module.
- Prescription/Billing/Pharmacy remain future Sprint 5 modules.
