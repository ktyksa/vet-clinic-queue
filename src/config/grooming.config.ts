import { schedulingConfig } from "./scheduling.config";

export const groomingConfig = {
  scheduling: {
    ...schedulingConfig,

    /**
     * Grooming jobs usually take longer than medical appointments.
     */
    defaultDurationMinutes: 90,
    maxGroomingJobsPerSlot: null as number | null,

    resources: {
      requireGroomer: true,
      requireGroomingRoom: false,
      requireBathStation: false,
    },
  },

  workflow: {
    statuses: [
      "BOOKED",
      "CONFIRMED",
      "ARRIVED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ],
  },
};
