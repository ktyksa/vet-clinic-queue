# Sprint 4A Diagnosis Foundation V2 Patch

## Scope

This patch upgrades the SOAP Diagnosis section so UAT can continue from SOAP Draft to Diagnosis and Finalize SOAP.

## Files changed

- `src/actions/soap.actions.ts`
- `src/app/visits/[id]/soap/page.tsx`

## What changed

### 1. Diagnosis UI upgraded

The old simple form:

- Diagnosis Type
- Diagnosis Text
- Add Diagnosis

was replaced with an enterprise-ready foundation:

- Diagnosis Type
- Diagnosis Master dropdown
- Free text / Clinical note
- Add Diagnosis
- Diagnosis cards with type badge, code, name, note, created time, remove action

### 2. Diagnosis Master support

Added server action:

```ts
getActiveDiagnosisCodes()
```

The SOAP page now loads active `DiagnosisCode` records and shows them in a dropdown.

If no master is available, users can still choose `Free text / Not in master` and enter Diagnosis Text.

### 3. Safer add diagnosis action

`addVisitDiagnosis()` now:

- validates diagnosis type
- accepts either diagnosis master or free text
- checks active diagnosis code when selected
- prevents duplicate active diagnosis for the same visit/type
- auto-fills `soapNote.diagnosisSummary` if empty
- writes audit log
- revalidates SOAP page

## UAT expected result

From SOAP Draft:

1. Add Diagnosis using Free Text or Diagnosis Master
2. Readiness Check changes from 4/5 to 5/5
3. SOAP Score changes to 100%
4. Finalize SOAP becomes available

## Notes

This is still Diagnosis Foundation V2, not full clinical coding governance. Future enterprise steps can add:

- Diagnosis master management page
- diagnosis severity
- suspected/confirmed/final diagnosis status
- ICD/SNOMED/Vet code mapping
- diagnosis-based prescription/lab suggestions
