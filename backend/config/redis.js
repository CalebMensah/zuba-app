// utils/cache.js
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      return this.client;
    }

    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis: Too many reconnection attempts');
              return new Error('Too many reconnection attempts');
            }
            // Exponential backoff: 50ms, 100ms, 150ms, etc.
            return Math.min(retries * 50, 500);
          },
          connectTimeout: 10000, // 10 seconds
        }
      });

      // Event listeners
      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis client ready');
      });

      this.client.on('disconnect', () => {
        console.log('⚠️ Redis disconnected');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      // Don't throw - allow app to continue without cache
      return null;
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Parsed value or null
   */
  async get(key) {
    try {
      if (!this.isConnected) {
        console.warn('Redis not connected, skipping cache get');
        return null;
      }

      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttl - Time to live in seconds (default: 3600 = 1 hour)
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = 3600) {
    try {
      if (!this.isConnected) {
        console.warn('Redis not connected, skipping cache set');
        return false;
      }

      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error setting cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key or array of keys
   * @returns {Promise<boolean>}
   */
  async del(key) {
    try {
      if (!this.isConnected) {
        return false;
      }

      if (Array.isArray(key)) {
        await this.client.del(key);
      } else {
        await this.client.del(key);
      }
      return true;
    } catch (error) {
      console.error(`Error deleting cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   * @param {string} pattern - Pattern to match (e.g., 'user:*', 'products:*')
   * @returns {Promise<number>} - Number of keys deleted
   */
  async delPattern(pattern) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(keys);
      return keys.length;
    } catch (error) {
      console.error(`Error deleting cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Error checking cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param {string} key - Cache key
   * @returns {Promise<number>} - TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async ttl(key) {
    try {
      if (!this.isConnected) {
        return -2;
      }

      return await this.client.ttl(key);
    } catch (error) {
      console.error(`Error getting TTL for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Set expiration time for a key
   * @param {string} key - Cache key
   * @param {number} seconds - Expiration time in seconds
   * @returns {Promise<boolean>}
   */
  async expire(key, seconds) {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.expire(key, seconds);
      return true;
    } catch (error) {
      console.error(`Error setting expiration for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment numeric value
   * @param {string} key - Cache key
   * @param {number} amount - Amount to increment (default: 1)
   * @returns {Promise<number>} - New value after increment
   */
  async incr(key, amount = 1) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      if (amount === 1) {
        return await this.client.incr(key);
      } else {
        return await this.client.incrBy(key, amount);
      }
    } catch (error) {
      console.error(`Error incrementing key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Decrement numeric value
   * @param {string} key - Cache key
   * @param {number} amount - Amount to decrement (default: 1)
   * @returns {Promise<number>} - New value after decrement
   */
  async decr(key, amount = 1) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      if (amount === 1) {
        return await this.client.decr(key);
      } else {
        return await this.client.decrBy(key, amount);
      }
    } catch (error) {
      console.error(`Error decrementing key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Cache wrapper - Get from cache or execute function and cache result
   * @param {string} key - Cache key
   * @param {Function} fn - Async function to execute if cache miss
   * @param {number} ttl - Time to live in seconds (default: 3600)
   * @returns {Promise<any>}
   */
  async wrap(key, fn, ttl = 3600) {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Cache miss - execute function
      const result = await fn();

      // Cache the result
      if (result !== null && result !== undefined) {
        await this.set(key, result, ttl);
      }

      return result;
    } catch (error) {
      console.error(`Error in cache wrap for key ${key}:`, error);
      // If caching fails, still return the function result
      return await fn();
    }
  }

  /**
   * Clear all cache (use with caution!)
   * @returns {Promise<boolean>}
   */
  async flush() {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.flushDb();
      console.log('⚠️ Cache flushed');
      return true;
    } catch (error) {
      console.error('Error flushing cache:', error);
      return false;
    }
  }

  /**
   * Get all keys matching pattern
   * @param {string} pattern - Pattern to match (default: '*')
   * @returns {Promise<Array>} - Array of keys
   */
  async keys(pattern = '*') {
    try {
      if (!this.isConnected) {
        return [];
      }

      return await this.client.keys(pattern);
    } catch (error) {
      console.error(`Error getting keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Hash operations - Set field in hash
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @param {any} value - Value to set
   * @returns {Promise<boolean>}
   */
  async hSet(key, field, value) {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.hSet(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error setting hash field ${key}:${field}:`, error);
      return false;
    }
  }

  /**
   * Hash operations - Get field from hash
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @returns {Promise<any>}
   */
  async hGet(key, field) {
    try {
      if (!this.isConnected) {
        return null;
      }

      const value = await this.client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error getting hash field ${key}:${field}:`, error);
      return null;
    }
  }

  /**
   * Hash operations - Get all fields from hash
   * @param {string} key - Hash key
   * @returns {Promise<Object>}
   */
  async hGetAll(key) {
    try {
      if (!this.isConnected) {
        return {};
      }

      const data = await this.client.hGetAll(key);
      const parsed = {};
      
      for (const [field, value] of Object.entries(data)) {
        try {
          parsed[field] = JSON.parse(value);
        } catch {
          parsed[field] = value;
        }
      }
      
      return parsed;
    } catch (error) {
      console.error(`Error getting all hash fields ${key}:`, error);
      return {};
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      if (!this.isConnected) {
        return {
          connected: false,
          keys: 0
        };
      }

      const info = await this.client.info('stats');
      const dbSize = await this.client.dbSize();

      return {
        connected: true,
        totalKeys: dbSize,
        info: info
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        console.log('✅ Redis disconnected gracefully');
      }
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Ping Redis to check connection
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const cache = new RedisCache();

// Auto-connect on import (non-blocking)
cache.connect().catch(err => {
  console.error('Initial Redis connection failed:', err);
  console.log('⚠️ Application will continue without caching');
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await cache.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  await cache.disconnect();
  process.exit(0);
});

// Export singleton instance
export { cache };
export default cache;