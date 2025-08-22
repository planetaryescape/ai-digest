interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class InMemoryRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();

  constructor(private config: RateLimitConfig) {}

  isAllowed(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return { allowed: true };
    }

    if (entry.count < this.config.maxRequests) {
      entry.count++;
      return { allowed: true };
    }

    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

const expensiveOperationsLimiter = new InMemoryRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000,
});

setInterval(() => {
  expensiveOperationsLimiter.cleanup();
}, 60 * 1000);

export function checkRateLimit(
  userId: string,
  endpoint: string
): { allowed: boolean; retryAfter?: number } {
  const key = `${userId}:${endpoint}`;
  return expensiveOperationsLimiter.isAllowed(key);
}
