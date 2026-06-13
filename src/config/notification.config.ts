export const notificationConfig = {
  enabled: true,

  channels: {
    email: false,
    sms: false,
    line: false,
    push: false,
  },

  queue: {
    enabled: true,
    retryLimit: 3,
  },
};
