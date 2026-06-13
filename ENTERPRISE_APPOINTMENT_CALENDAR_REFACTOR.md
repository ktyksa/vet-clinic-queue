# Enterprise Appointment Calendar Refactor

## Final Design

Medical-only appointment flow is now designed as an enterprise scheduling workspace:

```text
Appointment Calendar
  -> New Medical Appointment Panel
  -> Advance Booking / Walk-in
  -> Check-in
  -> Medical Queue
  -> Visit
```

## Main Changes

- `/appointments` now redirects to `/appointments/calendar`.
- `/appointments/calendar` is the main scheduling workspace.
- New Medical Appointment is a right-side panel in the calendar page.
- Header keeps user profile / role on top. No global Ctrl+K search.
- Appointment uses explicit time range:
  - `startAt`
  - `endAt`
  - `durationMinutes`
- Old single-slot behavior is replaced by time range selection.
- Medical Queue has its own page: `/medical-queue`.
- Grooming remains out of runtime scope for this sprint.

## Schema Changes

Appointment now stores enterprise time range fields:

```prisma
startAt         DateTime
endAt           DateTime
durationMinutes Int @default(30)
```

`appointmentDate` is still kept as a compatibility/date anchor and is written from `startAt`.

## Required Commands

After replacing files:

```powershell
npx prisma generate
npm run build
```

If your current database already has Appointment rows, add the new columns and backfill existing rows before using the screen:

```sql
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 30;

UPDATE "Appointment"
SET "startAt" = COALESCE("startAt", "appointmentDate"),
    "endAt" = COALESCE("endAt", "appointmentDate" + INTERVAL '30 minutes')
WHERE "startAt" IS NULL OR "endAt" IS NULL;

ALTER TABLE "Appointment" ALTER COLUMN "startAt" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "endAt" SET NOT NULL;
```
