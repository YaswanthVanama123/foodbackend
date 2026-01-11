import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt';
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
 * Generate access and refresh token pair (without Redis storage)
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

  return {
    accessToken,
    refreshToken,
    expiresIn: jwtConfig.accessTokenExpire,
  };
};

/**
 * Verify and decode refresh token (without Redis revocation check)
 * @param refreshToken Refresh token to verify
 * @returns Decoded token payload or null if invalid
 */
export const verifyRefreshToken = async (
  refreshToken: string
): Promise<RefreshTokenPayload | null> => {
  try {
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as RefreshTokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Rotate refresh token (generate new token pair)
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

  // Generate new token pair
  return generateTokenPair(decoded.id, decoded.restaurantId);
};

/**
 * Revoke a specific refresh token (no-op without Redis)
 * @param customerId Customer ID
 * @param tokenId Token ID to revoke
 */
export const revokeRefreshToken = async (
  _customerId: string,
  _tokenId: string
): Promise<void> => {
  // No-op without Redis
  return;
};

/**
 * Revoke all refresh tokens for a customer (no-op without Redis)
 * @param customerId Customer ID
 */
export const revokeAllRefreshTokens = async (_customerId: string): Promise<void> => {
  // No-op without Redis
  return;
};

/**
 * Get all active refresh tokens for a customer (always returns 0 without Redis)
 * @param customerId Customer ID
 * @returns Count of active refresh tokens
 */
export const getActiveRefreshTokenCount = async (_customerId: string): Promise<number> => {
  return 0;
};
