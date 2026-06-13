export const clinicConfig = {
  clinic: {
    timezone: "Asia/Bangkok",
    locale: "th-TH",
  },

  scheduling: {
    /**
     * Global scheduling default for clinic operation.
     * Module-specific config can override these values.
     */
    allowOverbooking: true,
    slotIntervalMinutes: 30,

    businessHours: {
      start: "08:00",
      end: "24:00",
    },

    enableCapacityControl: false,
    defaultCapacityPerSlot: null as number | null,
  },
};
