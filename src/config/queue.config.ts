import { schedulingConfig } from "./scheduling.config";

export const queueConfig = {
  /**
   * Queue Engine
   *
   * Current V1 Standard:
   * - Queue engine is prepared but disabled
   * - Appointment still allows overbooking
   * - Capacity / conflict / auto scheduling / AI queue will be enabled later
   */
  enabled: false,

  capacityControl: {
    enabled: false,
    defaultCapacityPerSlot: schedulingConfig.defaultCapacityPerSlot,
    maxAppointmentsPerSlot: null as number | null,
    maxTreatmentPerSlot: null as number | null,
    maxGroomingPerSlot: null as number | null,
    maxSurgeryPerSlot: 1,
    maxBoardingCheckInPerSlot: null as number | null,
  },

  conflictCheck: {
    enabled: false,

    checkSamePetSameTime: false,
    checkSameVetSameTime: false,
    checkSameGroomerSameTime: false,
    checkRoomAvailability: false,
    checkSurgeryRoomAvailability: false,
    checkBoardingCageAvailability: false,
  },

  overbooking: {
    allowOverbooking: schedulingConfig.allowOverbooking,
    allowTreatmentOverbooking: true,
    allowGroomingOverbooking: true,
    allowSurgeryOverbooking: false,
    allowBoardingOverbooking: false,
  },

  autoScheduling: {
    enabled: false,

    assignVeterinarianAutomatically: false,
    assignGroomerAutomatically: false,
    assignRoomAutomatically: false,
    assignQueueNumberAutomatically: false,

    strategy: "MANUAL" as
      | "MANUAL"
      | "EARLIEST_AVAILABLE"
      | "LOWEST_WORKLOAD"
      | "ROLE_BASED"
      | "AI_RECOMMENDED",
  },

  aiQueue: {
    enabled: false,

    prioritizeEmergencyCase: false,
    estimateWaitingTime: false,
    recommendBestTimeSlot: false,
    recommendBestVeterinarian: false,
    recommendBestGroomer: false,
    detectOverCapacityRisk: false,
  },

  notification: {
    notifyStaffOnNewBooking: false,
    notifyStaffOnOverbooking: false,
    notifyStaffOnQueueDelay: false,
    notifyOwnerOnQueueUpdate: false,
  },

  audit: {
    enabled: true,
    logQueueAssignment: true,
    logReschedule: true,
    logManualOverride: true,
    logAutoSchedulingDecision: true,
  },
};
