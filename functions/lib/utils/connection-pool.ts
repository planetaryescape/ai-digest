import { createLogger } from "../logger";

const log = createLogger("connection-pool");

export interface PoolOptions {
  min: number;
  max: number;
  idleTimeout?: number;
  acquireTimeout?: number;
  createRetries?: number;
  validateOnBorrow?: boolean;
  evictionInterval?: number;
}

export interface PooledResource<T> {
  resource: T;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
  isValid: boolean;
}

export abstract class ConnectionPool<T> {
  protected readonly options: Required<PoolOptions>;
  protected readonly available: PooledResource<T>[] = [];
  protected readonly inUse = new Set<PooledResource<T>>();
  protected readonly waitingQueue: Array<{
    resolve: (resource: T) => void;
    reject: (error: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }> = [];
  protected evictionTimer?: NodeJS.Timer;
  protected isShuttingDown = false;

  constructor(options: PoolOptions) {
    this.options = {
      min: options.min,
      max: options.max,
      idleTimeout: options.idleTimeout ?? 30000,
      acquireTimeout: options.acquireTimeout ?? 5000,
      createRetries: options.createRetries ?? 3,
      validateOnBorrow: options.validateOnBorrow ?? true,
      evictionInterval: options.evictionInterval ?? 60000,
    };

    this.initialize();
  }

  protected abstract createResource(): Promise<T>;
  protected abstract destroyResource(resource: T): Promise<void>;
  protected abstract validateResource(resource: T): Promise<boolean>;

  private async initialize(): Promise<void> {
    // Create minimum number of connections
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.options.min; i++) {
      promises.push(this.createAndAddResource());
    }
    await Promise.all(promises);

    // Start eviction timer
    if (this.options.evictionInterval > 0) {
      this.startEvictionTimer();
    }
  }

  async acquire(): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error("Pool is shutting down");
    }

    // Try to get an available resource
    let pooled = await this.getAvailableResource();
    
    if (pooled) {
      this.inUse.add(pooled);
      pooled.lastUsedAt = Date.now();
      pooled.useCount++;
      return pooled.resource;
    }

    // Try to create a new resource if under max
    if (this.size() < this.options.max) {
      try {
        await this.createAndAddResource();
        pooled = await this.getAvailableResource();
        if (pooled) {
          this.inUse.add(pooled);
          pooled.lastUsedAt = Date.now();
          pooled.useCount++;
          return pooled.resource;
        }
      } catch (error) {
        log.error({ error }, "Failed to create new resource");
      }
    }

    // Wait for a resource to become available
    return this.waitForResource();
  }

  async release(resource: T): Promise<void> {
    const pooled = this.findPooledResource(resource);
    if (!pooled) {
      log.warn("Attempted to release unknown resource");
      return;
    }

    this.inUse.delete(pooled);

    // Validate resource before returning to pool
    if (this.options.validateOnBorrow) {
      try {
        const isValid = await this.validateResource(resource);
        pooled.isValid = isValid;
        
        if (!isValid) {
          await this.destroyPooledResource(pooled);
          await this.createAndAddResource();
          return;
        }
      } catch (error) {
        log.error({ error }, "Resource validation failed");
        await this.destroyPooledResource(pooled);
        await this.createAndAddResource();
        return;
      }
    }

    pooled.lastUsedAt = Date.now();
    this.available.push(pooled);

    // Process waiting queue
    this.processWaitingQueue();
  }

  async destroy(resource: T): Promise<void> {
    const pooled = this.findPooledResource(resource);
    if (!pooled) return;

    this.inUse.delete(pooled);
    await this.destroyPooledResource(pooled);

    // Create replacement if below minimum
    if (this.size() < this.options.min && !this.isShuttingDown) {
      await this.createAndAddResource();
    }
  }

  async drain(): Promise<void> {
    this.isShuttingDown = true;

    // Stop eviction timer
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = undefined;
    }

    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift()!;
      if (waiting.timeoutId) {
        clearTimeout(waiting.timeoutId);
      }
      waiting.reject(new Error("Pool is draining"));
    }

    // Wait for all in-use resources to be released
    while (this.inUse.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Destroy all available resources
    const destroyPromises: Promise<void>[] = [];
    while (this.available.length > 0) {
      const pooled = this.available.shift()!;
      destroyPromises.push(this.destroyPooledResource(pooled));
    }
    await Promise.all(destroyPromises);
  }

  size(): number {
    return this.available.length + this.inUse.size;
  }

  availableCount(): number {
    return this.available.length;
  }

  inUseCount(): number {
    return this.inUse.size;
  }

  waitingCount(): number {
    return this.waitingQueue.length;
  }

  getStats(): {
    total: number;
    available: number;
    inUse: number;
    waiting: number;
    created: number;
    destroyed: number;
  } {
    return {
      total: this.size(),
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waitingQueue.length,
      created: this.totalCreated,
      destroyed: this.totalDestroyed,
    };
  }

  private totalCreated = 0;
  private totalDestroyed = 0;

  private async createAndAddResource(): Promise<void> {
    let retries = this.options.createRetries;
    let lastError: Error | undefined;

    while (retries > 0) {
      try {
        const resource = await this.createResource();
        const pooled: PooledResource<T> = {
          resource,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          useCount: 0,
          isValid: true,
        };
        this.available.push(pooled);
        this.totalCreated++;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastError || new Error("Failed to create resource");
  }

  private async getAvailableResource(): Promise<PooledResource<T> | null> {
    while (this.available.length > 0) {
      const pooled = this.available.shift()!;

      // Check if resource is still valid
      if (this.options.validateOnBorrow) {
        try {
          const isValid = await this.validateResource(pooled.resource);
          if (!isValid) {
            await this.destroyPooledResource(pooled);
            continue;
          }
        } catch (error) {
          log.error({ error }, "Resource validation failed");
          await this.destroyPooledResource(pooled);
          continue;
        }
      }

      return pooled;
    }

    return null;
  }

  private async waitForResource(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.waitingQueue.findIndex((w) => w.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Acquire timeout after ${this.options.acquireTimeout}ms`));
      }, this.options.acquireTimeout);

      this.waitingQueue.push({ resolve, reject, timeoutId });
    });
  }

  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0 || this.available.length === 0) {
      return;
    }

    const waiting = this.waitingQueue.shift()!;
    if (waiting.timeoutId) {
      clearTimeout(waiting.timeoutId);
    }

    const pooled = this.available.shift()!;
    this.inUse.add(pooled);
    pooled.lastUsedAt = Date.now();
    pooled.useCount++;
    waiting.resolve(pooled.resource);
  }

  private findPooledResource(resource: T): PooledResource<T> | undefined {
    for (const pooled of this.inUse) {
      if (pooled.resource === resource) {
        return pooled;
      }
    }
    for (const pooled of this.available) {
      if (pooled.resource === resource) {
        return pooled;
      }
    }
    return undefined;
  }

  private async destroyPooledResource(pooled: PooledResource<T>): Promise<void> {
    try {
      await this.destroyResource(pooled.resource);
      this.totalDestroyed++;
    } catch (error) {
      log.error({ error }, "Failed to destroy resource");
    }
  }

  private startEvictionTimer(): void {
    this.evictionTimer = setInterval(() => {
      this.evictIdleResources();
    }, this.options.evictionInterval);
  }

  private async evictIdleResources(): Promise<void> {
    const now = Date.now();
    const toEvict: PooledResource<T>[] = [];

    // Find idle resources
    for (let i = this.available.length - 1; i >= 0; i--) {
      const pooled = this.available[i];
      const idleTime = now - pooled.lastUsedAt;

      if (idleTime > this.options.idleTimeout && this.size() > this.options.min) {
        toEvict.push(pooled);
        this.available.splice(i, 1);
      }
    }

    // Destroy evicted resources
    for (const pooled of toEvict) {
      await this.destroyPooledResource(pooled);
    }

    if (toEvict.length > 0) {
      log.info({ count: toEvict.length }, "Evicted idle resources");
    }
  }
}

export class GenericConnectionPool<T> extends ConnectionPool<T> {
  constructor(
    private readonly factory: {
      create: () => Promise<T>;
      destroy: (resource: T) => Promise<void>;
      validate: (resource: T) => Promise<boolean>;
    },
    options: PoolOptions
  ) {
    super(options);
  }

  protected createResource(): Promise<T> {
    return this.factory.create();
  }

  protected destroyResource(resource: T): Promise<void> {
    return this.factory.destroy(resource);
  }

  protected validateResource(resource: T): Promise<boolean> {
    return this.factory.validate(resource);
  }
}

export function createPool<T>(
  factory: {
    create: () => Promise<T>;
    destroy: (resource: T) => Promise<void>;
    validate: (resource: T) => Promise<boolean>;
  },
  options: PoolOptions
): GenericConnectionPool<T> {
  return new GenericConnectionPool(factory, options);
}