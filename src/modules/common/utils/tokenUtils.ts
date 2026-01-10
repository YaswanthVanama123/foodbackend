import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt';
import { RedisCache, CacheKeys } from '../config/redis';
import crypto from 'crypto';

interface RefreshTokenPayload {
  id: string;
  restaurantId: string;
  type: 'customer';
  tokenId: string;
  iat?: number;
  exp?: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Generate a unique token ID
 */
const generateTokenId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Generate access and refresh token pair
 * @param customerId Customer ID
 * @param restaurantId Restaurant ID
 * @returns Token pair with access and refresh tokens
 */
export const generateTokenPair = async (
  customerId: string,
  restaurantId: string
): Promise<TokenPair> => {
  const tokenId = generateTokenId();

  // Generate access token
  const accessToken = jwt.sign(
    {
      id: customerId,
      restaurantId,
      type: 'customer',
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.accessTokenExpire } as any
  );

  // Generate refresh token with unique ID
  const refreshToken = jwt.sign(
    {
      id: customerId,
      restaurantId,
      type: 'customer',
      tokenId,
    },
    jwtConfig.refreshSecret,
    { expiresIn: jwtConfig.refreshTokenExpire } as any
  );

  // Store refresh token in Redis (for rotation and revocation)
  const refreshKey = CacheKeys.refreshToken(customerId, tokenId);
  const ttl = 365 * 24 * 60 * 60; // 1 year in seconds
  await RedisCache.set(
    refreshKey,
    {
      customerId,
      restaurantId,
      tokenId,
      createdAt: Date.now(),
    },
    ttl
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: jwtConfig.accessTokenExpire,
  };
};

/**
 * Verify and decode refresh token
 * @param refreshToken Refresh token to verify
 * @returns Decoded token payload or null if invalid
 */
export const verifyRefreshToken = async (
  refreshToken: string
): Promise<RefreshTokenPayload | null> => {
  try {
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as RefreshTokenPayload;

    // Verify token exists in Redis (not revoked)
    const refreshKey = CacheKeys.refreshToken(decoded.id, decoded.tokenId);
    const exists = await RedisCache.exists(refreshKey);

    if (!exists) {
      return null; // Token was revoked
    }

    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Rotate refresh token (invalidate old, generate new)
 * @param oldRefreshToken Old refresh token
 * @returns New token pair or null if invalid
 */
export const rotateRefreshToken = async (
  oldRefreshToken: string
): Promise<TokenPair | null> => {
  const decoded = await verifyRefreshToken(oldRefreshToken);

  if (!decoded) {
    return null;
  }

  // Revoke old refresh token
  await revokeRefreshToken(decoded.id, decoded.tokenId);

  // Generate new token pair
  return generateTokenPair(decoded.id, decoded.restaurantId);
};

/**
 * Revoke a specific refresh token
 * @param customerId Customer ID
 * @param tokenId Token ID to revoke
 */
export const revokeRefreshToken = async (
  customerId: string,
  tokenId: string
): Promise<void> => {
  const refreshKey = CacheKeys.refreshToken(customerId, tokenId);
  await RedisCache.del(refreshKey);
};

/**
 * Revoke all refresh tokens for a customer
 * @param customerId Customer ID
 */
export const revokeAllRefreshTokens = async (customerId: string): Promise<void> => {
  // Delete all refresh tokens for this customer
  await RedisCache.delPattern(`refresh:${customerId}:*`);
};

/**
 * Get all active refresh tokens for a customer
 * @param customerId Customer ID
 * @returns Count of active refresh tokens
 */
export const getActiveRefreshTokenCount = async (_customerId: string): Promise<number> => {
  try {
    // This is a simple implementation - you might want to store a counter instead
    // for better performance at scale
    return 0; // Placeholder - would need Redis SCAN implementation
  } catch (error) {
    console.error('Error getting refresh token count:', error);
    return 0;
  }
};
