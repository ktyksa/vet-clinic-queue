import { schedulingConfig } from "./scheduling.config";

export const boardingConfig = {
  scheduling: {
    ...schedulingConfig,

    /**
     * Boarding is capacity/resource based, usually by cage/room and date range.
     */
    allowOverbooking: false,
    enableCapacityControl: true,

    resources: {
      requireCage: true,
      requireRoom: false,
    },
  },

  stay: {
    allowOvernight: true,
    requireCheckIn: true,
    requireCheckOut: true,
  },
};
