export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'default-secret-key',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
  accessTokenExpire: process.env.JWT_EXPIRE || '100d', // 100 days for customer tokens
  refreshTokenExpire: process.env.JWT_REFRESH_EXPIRE || '365d', // 1 year for refresh tokens
};
