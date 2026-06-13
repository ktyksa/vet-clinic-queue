import { schedulingConfig } from "./scheduling.config";

export const surgeryConfig = {
  scheduling: {
    ...schedulingConfig,

    /**
     * Surgery should later use strict resource/capacity allocation.
     */
    defaultDurationMinutes: 120,
    allowOverbooking: false,
    enableCapacityControl: true,
    defaultCapacityPerSlot: 1,

    resources: {
      requireVeterinarian: true,
      requireSurgeryRoom: true,
      requireAssistant: true,
    },
  },

  workflow: {
    requirePreOpCheck: true,
    requireConsentForm: true,
  },
};
