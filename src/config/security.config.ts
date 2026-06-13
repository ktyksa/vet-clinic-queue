export const securityConfig = {
  auth: {
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    sessionMaxAgeSeconds: 8 * 60 * 60,
  },
  password: {
    minLength: 8,
    bcryptRounds: 12,
  },
};
