import { createLogger } from "../logger";

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  keyGenerator?: (...args: any[]) => string;
}

/**
 * Decorator to cache method results
 */
export function Cache(options: CacheOptions = {}) {
  const {
    ttl = 60000, // Default 1 minute
    keyGenerator = (...args) => JSON.stringify(args),
  } = options;

  return (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const logger = createLogger(`${className}.${propertyKey}`);
    const cache = new Map<string, { value: any; expiry: number }>();

    descriptor.value = async function (...args: any[]) {
      const key = keyGenerator(...args);
      const now = Date.now();

      // Check cache
      const cached = cache.get(key);
      if (cached && cached.expiry > now) {
        logger.debug(`Cache hit for key: ${key}`);
        return cached.value;
      }

      // Cache miss or expired
      logger.debug(`Cache miss for key: ${key}`);

      const result = await originalMethod.apply(this, args);

      // Store in cache
      cache.set(key, {
        value: result,
        expiry: now + ttl,
      });

      // Clean up expired entries periodically
      if (cache.size > 100) {
        for (const [k, v] of cache.entries()) {
          if (v.expiry <= now) {
            cache.delete(k);
          }
        }
      }

      return result;
    };

    return descriptor;
  };
}
