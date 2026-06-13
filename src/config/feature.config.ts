export const featureConfig = {
  appointment: {
    listView: true,
    calendarView: true,
    calendarDayView: true,
    calendarWeekView: true,
    calendarMonthView: true,
    detailSidePanel: true,
    clickEmptySlotToCreate: true,
    dragAndDropReschedule: false,
  },

  queue: {
    enabled: false,
    capacityControl: false,
    conflictCheck: false,
    autoScheduling: false,
    aiQueue: false,
  },

  grooming: {
    enabled: true,
    groomingWorkflow: false,
  },

  notification: {
    enabled: true,
    lineNotification: false,
    smsNotification: false,
    emailNotification: false,
    pushNotification: false,
  },

  payment: {
    enabled: false,
    externalBankPayment: false,
    qrPayment: false,
    cardPayment: false,
  },

  inventory: {
    enabled: false,
    stockControl: false,
    expiryControl: true,
  },
};
