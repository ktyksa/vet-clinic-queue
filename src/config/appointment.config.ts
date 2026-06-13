import { schedulingConfig } from "./scheduling.config";

export const appointmentConfig = {
  scheduling: {
    ...schedulingConfig,

    /**
     * Appointment V1:
     * - Allow overbooking
     * - Allow same pet / same vet / same time slot
     * - Queue allocation will be handled later
     */
    defaultDurationMinutes: 30,

    /**
     * Enterprise check-in rule:
     * Advance booking can be checked in only within this window before startAt.
     * Walk-in is not limited by this setting because it represents arrival now.
     */
    checkInWindowMinutes: 30,

    allowSamePetMultipleAppointments: true,
    allowSameVetMultipleAppointments: true,
  },

  reminder: {
    enabled: true,
    hoursBeforeAppointment: 24,
  },

  notification: {
    createAppointment: true,
    confirmAppointment: true,
    cancelAppointment: true,
    noShowAppointment: true,
    rescheduleAppointment: true,
  },
};
