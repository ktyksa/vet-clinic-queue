export const inventoryConfig = {
  stockControl: {
    enabled: false,
    allowNegativeStock: false,
  },

  expiryControl: {
    enabled: true,
    nearExpiryWarningDays: 30,
  },

  audit: {
    enabled: true,
  },
};
