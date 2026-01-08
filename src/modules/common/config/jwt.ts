export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'default-secret-key',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
  accessTokenExpire: process.env.JWT_EXPIRE || '15m',
  refreshTokenExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
};
