/**
 * Simple in-memory rate limiter for AI endpoints
 *
 * Uses a sliding window counter approach for simplicity.
 * For production with multiple instances, consider Redis-based rate limiting.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than 1 hour
    if (now - entry.windowStart > 60 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate limited
 *
 * @param key - Unique identifier (e.g., userId or IP)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and remaining quota
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No existing entry or window has expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    rateLimitStore.set(key, {
      count: 1,
      windowStart: now,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Within window - check limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + config.windowMs,
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.windowStart + config.windowMs,
  };
}

/**
 * Pre-configured rate limits for different AI operations
 */
export const AI_RATE_LIMITS = {
  // Chat: 20 requests per minute (generous for interactive use)
  chat: { maxRequests: 20, windowMs: 60 * 1000 },

  // Task assistance: 30 per minute (inline assist)
  taskAssist: { maxRequests: 30, windowMs: 60 * 1000 },

  // Guidance/planning: 10 per minute (heavier operations)
  guidance: { maxRequests: 10, windowMs: 60 * 1000 },

  // Agentic operations: 5 per minute (most expensive)
  agentic: { maxRequests: 5, windowMs: 60 * 1000 },

  // Goal breakdown: 10 per minute
  breakdown: { maxRequests: 10, windowMs: 60 * 1000 },
} as const;
