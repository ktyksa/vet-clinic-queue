# Sprint 4A Medical Queue Review

## Current review from vet-clinic(30).zip

1. `prisma/schema.prisma` already has `MedicalQueue`, `MedicalQueueStatus`, `Appointment -> MedicalQueue`, and `Owner/Pet/User -> MedicalQueue` relations.
2. `src/actions/medical-queue.actions.ts` is empty.
3. Current `/medical-queue/page.tsx` imports old `queue.actions.ts` and old `QueueStatus` values: `CALLED`, `IN_PROGRESS`, `SKIPPED`.
4. New schema uses `MedicalQueueStatus`: `CHECKED_IN`, `WAITING`, `IN_SERVICE`, `COMPLETED`, `NO_SHOW`, `CANCELLED`.
5. Existing queue creation code in `appointment.actions.ts` and `queue.actions.ts` creates `medicalQueue` without required fields: `queueDate`, `queueNumber`, `queueCode`, `source`, `ownerId`, `petId`.
6. `visit.actions.ts` currently tries to write `queueId` into `Visit`, but current `Visit` model does not have `queueId`.

## Files included in this patch

- `src/actions/medical-queue.actions.ts`
- `src/app/medical-queue/page.tsx`

## Required manual integration after copying files

### 1. Replace old import usage
Use new actions from:

```ts
@/actions/medical-queue.actions
```

Avoid old `queue.actions.ts` for Medical Queue.

### 2. Appointment check-in button
Appointment detail should call:

```ts
checkInAppointmentToMedicalQueue(formData)
```

Hidden input:

```tsx
<input type="hidden" name="appointmentId" value={appointment.appointmentId} />
```

### 3. Walk-in creation
When creating walk-in appointment, either:

- keep current auto-create queue logic but add required fields, or
- create appointment first then call queue creation/check-in logic.

Required queue fields:

```ts
queueDate
queueNumber
queueNo
queueCode
queueStatus
source
appointmentId
ownerId
petId
veterinarianId
checkedInAt
waitingAt
```

### 4. Recommended schema improvement
For enterprise traceability, add relation from `Visit` to `MedicalQueue` later:

```prisma
model Visit {
  queueId String? @unique
  queue   MedicalQueue? @relation(fields: [queueId], references: [queueId])
}

model MedicalQueue {
  visit Visit?
}
```

Then run:

```powershell
npx prisma generate
npx prisma db push
npm run build
```
