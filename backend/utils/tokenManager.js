import prisma from '../config/prisma.js'

// Configuration constants
export const MAX_TOKENS_PER_USER = 10
export const MAX_FAILURE_COUNT = 3
export const CLEANUP_REVOKED_DAYS = 30

// Platform mapping for string to enum conversion
const PLATFORM_MAPPING = {
  'ANDROID': 'ANDROID',
  'IOS': 'IOS', 
  'WEB': 'WEB',
  'android': 'ANDROID',
  'ios': 'IOS',
  'web': 'WEB'
}

/**
 * Convert platform string to DevicePlatform enum
 * @param {string} platform - Platform string
 * @returns {string} - DevicePlatform enum value
 */
function validateAndConvertPlatform(platform) {
  if (!platform) {
    throw new Error('Platform is required')
  }

  const normalizedPlatform = PLATFORM_MAPPING[platform.toUpperCase()]
  
  if (!normalizedPlatform) {
    throw new Error(`Invalid platform value: ${platform}. Valid values are: ANDROID, IOS, WEB`)
  }
  
  return normalizedPlatform
}

export class TokenManager {
  static async register(input) {
    const {
      userId,
      token,
      tokenType,
      platform,
      deviceId,
      deviceModel,
      osVersion,
      appVersion,
      expiresAt
    } = input

    // Validate and convert platform to enum
    const validatedPlatform = validateAndConvertPlatform(platform)

    // Check token limit per user
    const existingCount = await prisma.pushToken.count({
      where: { 
        userId, 
        revokedAt: null 
      }
    })

    // If at limit, revoke the oldest token
    if (existingCount >= MAX_TOKENS_PER_USER) {
      const oldestToken = await prisma.pushToken.findFirst({
        where: { 
          userId, 
          revokedAt: null 
        },
        orderBy: { lastUsedAt: 'asc' }
      })

      if (oldestToken) {
        await prisma.pushToken.update({
          where: { id: oldestToken.id },
          data: { revokedAt: new Date() }
        })
      }
    }

    return prisma.pushToken.upsert({
      where: { token },
      create: {
        userId,
        token,
        tokenType,
        platform: validatedPlatform,
        deviceId,
        deviceModel,
        osVersion,
        appVersion,
        expiresAt: tokenType === 'EXPO' ? expiresAt : null,
        lastUsedAt: new Date(),
        failureCount: 0
      },
      update: {
        userId, // handles account switch on same device
        revokedAt: null,
        lastUsedAt: new Date(),
        deviceId,
        deviceModel,
        osVersion,
        appVersion,
        expiresAt: tokenType === 'EXPO' ? expiresAt : null,
        failureCount: 0, // reset failure count on re-registration
        lastFailedAt: null
      }
    })
  }

  /**
   * Soft-revoke a token (logout / uninstall)
   * @param {string} token - Push token to revoke
   * @returns {Object} Update result with count
   */
  static async revoke(token) {
    const result = await prisma.pushToken.updateMany({
      where: {
        token,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    })

    if (result.count === 0) {
      console.warn(`Token revocation failed: token not found or already revoked - ${token}`)
    }

    return result
  }

  /**
   * Revoke all tokens for a user (security / account lock)
   * @param {string} userId - User ID
   * @returns {Object} Update result with count
   */
  static async revokeAllForUser(userId) {
    const result = await prisma.pushToken.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    })

    console.log(`Revoked ${result.count} tokens for user ${userId}`)
    return result
  }

  /**
   * Get active tokens for a user
   * @param {string} userId - User ID
   * @returns {Array} Array of active push tokens
   */
  static async getActiveTokens(userId) {
    return prisma.pushToken.findMany({
      where: {
        userId,
        revokedAt: null,
        failureCount: { lt: MAX_FAILURE_COUNT },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })
  }

  /**
   * Get active tokens grouped by provider
   * @param {string} userId - User ID
   * @returns {Object} Tokens grouped by FCM, Expo, and Web Push
   */
  static async getGroupedTokens(userId) {
    const tokens = await this.getActiveTokens(userId)
    return {
      fcm: tokens.filter(t => t.tokenType === 'FCM'),
      expo: tokens.filter(t => t.tokenType === 'EXPO'),
      web: tokens.filter(t => t.tokenType === 'WEB_PUSH')
    }
  }

  /**
   * Mark token as used (delivery success)
   * @param {string|Array<string>} tokens - Single token or array of tokens
   */
  static async touch(tokens) {
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens]
    
    return prisma.pushToken.updateMany({
      where: { 
        token: { in: tokenArray } 
      },
      data: { 
        lastUsedAt: new Date(),
        failureCount: 0, // reset on success
        lastFailedAt: null
      }
    })
  }

  /**
   * Mark token as failed and auto-revoke after max failures
   * @param {string} token - Push token
   * @param {string} [errorCode] - Optional error code
   */
  static async markFailed(token, errorCode = null) {
    const existing = await prisma.pushToken.findUnique({
      where: { token }
    })

    if (!existing) {
      console.warn(`Cannot mark failed: token not found - ${token}`)
      return null
    }

    const newFailureCount = (existing.failureCount || 0) + 1
    const shouldRevoke = newFailureCount >= MAX_FAILURE_COUNT

    const updated = await prisma.pushToken.update({
      where: { token },
      data: {
        failureCount: newFailureCount,
        lastFailedAt: new Date(),
        lastErrorCode: errorCode,
        revokedAt: shouldRevoke ? new Date() : existing.revokedAt
      }
    })

    if (shouldRevoke) {
      console.log(`Auto-revoked token after ${MAX_FAILURE_COUNT} failures: ${token}`)
    }

    return updated
  }

  /**
   * Cleanup job (run via cron)
   * @param {number} [revokedDaysThreshold=30] - Days before deleting revoked tokens
   * @returns {Object} Delete result with count
   */
  static async cleanup(revokedDaysThreshold = CLEANUP_REVOKED_DAYS) {
    const now = new Date()
    const revokedThreshold = new Date(
      now.getTime() - revokedDaysThreshold * 24 * 60 * 60 * 1000
    )

    const result = await prisma.pushToken.deleteMany({
      where: {
        OR: [
          {
            revokedAt: {
              lt: revokedThreshold
            }
          },
          {
            expiresAt: {
              lt: now
            }
          }
        ]
      }
    })

    console.log(`Cleaned up ${result.count} expired/revoked tokens`)
    return result
  }

  /**
   * Get token statistics for monitoring
   * @param {string} userId - User ID
   * @returns {Object} Token statistics
   */
  static async getStats(userId) {
    const [active, revoked, failed] = await Promise.all([
      prisma.pushToken.count({
        where: { userId, revokedAt: null }
      }),
      prisma.pushToken.count({
        where: { userId, revokedAt: { not: null } }
      }),
      prisma.pushToken.count({
        where: { 
          userId, 
          failureCount: { gte: MAX_FAILURE_COUNT } 
        }
      })
    ])

    return { active, revoked, failed }
  }
}