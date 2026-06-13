import { clinicConfig } from "./clinic.config";

export const schedulingConfig = {
  allowOverbooking: clinicConfig.scheduling.allowOverbooking,
  slotIntervalMinutes: clinicConfig.scheduling.slotIntervalMinutes,
  businessHours: clinicConfig.scheduling.businessHours,
  enableCapacityControl: clinicConfig.scheduling.enableCapacityControl,
  defaultCapacityPerSlot: clinicConfig.scheduling.defaultCapacityPerSlot,

  /**
   * Future Scheduling Foundation
   *
   * These switches are intentionally disabled for now.
   * Queue Engine will decide how to use them later.
   */
  conflictCheck: {
    enabled: false,
    checkSamePetSameTime: false,
    checkSameVetSameTime: false,
    checkSameGroomerSameTime: false,
  },

  autoScheduling: {
    enabled: false,
    strategy: "MANUAL" as
      | "MANUAL"
      | "EARLIEST_AVAILABLE"
      | "LOWEST_WORKLOAD"
      | "AI_RECOMMENDED",
  },

  aiQueue: {
    enabled: false,
    estimateWaitingTime: false,
    recommendBestTimeSlot: false,
  },
};
