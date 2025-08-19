export interface LazyOptions {
  ttl?: number; // Time to live in milliseconds
  resetOnError?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export class Lazy<T> {
  private value?: T;
  private loading = false;
  private loadedAt?: number;
  private error?: Error;
  private readonly factory: () => T | Promise<T>;
  private readonly options: LazyOptions;

  constructor(factory: () => T | Promise<T>, options: LazyOptions = {}) {
    this.factory = factory;
    this.options = options;
  }

  async get(): Promise<T> {
    if (this.shouldReload()) {
      await this.load();
    }

    if (this.error) {
      throw this.error;
    }

    return this.value!;
  }

  async getOrDefault(defaultValue: T): Promise<T> {
    try {
      return await this.get();
    } catch {
      return defaultValue;
    }
  }

  isLoaded(): boolean {
    return this.value !== undefined && !this.isExpired();
  }

  isLoading(): boolean {
    return this.loading;
  }

  hasError(): boolean {
    return this.error !== undefined;
  }

  reset(): void {
    this.value = undefined;
    this.loadedAt = undefined;
    this.error = undefined;
    this.loading = false;
  }

  async refresh(): Promise<T> {
    this.reset();
    return this.get();
  }

  private shouldReload(): boolean {
    if (this.loading) return false;
    if (this.value === undefined) return true;
    if (this.error && this.options.resetOnError) return true;
    return this.isExpired();
  }

  private isExpired(): boolean {
    if (!this.options.ttl || !this.loadedAt) return false;
    return Date.now() - this.loadedAt > this.options.ttl;
  }

  private async load(): Promise<void> {
    if (this.loading) {
      // Wait for ongoing load to complete
      while (this.loading) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return;
    }

    this.loading = true;
    this.error = undefined;

    try {
      this.options.onLoad?.();
      const result = await Promise.resolve(this.factory());
      this.value = result;
      this.loadedAt = Date.now();
    } catch (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
      this.options.onError?.(this.error);
      throw this.error;
    } finally {
      this.loading = false;
    }
  }
}

export class LazyMap<K, V> {
  private readonly map = new Map<K, Lazy<V>>();
  private readonly factory: (key: K) => V | Promise<V>;
  private readonly options: LazyOptions;

  constructor(factory: (key: K) => V | Promise<V>, options: LazyOptions = {}) {
    this.factory = factory;
    this.options = options;
  }

  async get(key: K): Promise<V> {
    if (!this.map.has(key)) {
      this.map.set(key, new Lazy(() => this.factory(key), this.options));
    }
    return this.map.get(key)!.get();
  }

  async getOrDefault(key: K, defaultValue: V): Promise<V> {
    try {
      return await this.get(key);
    } catch {
      return defaultValue;
    }
  }

  has(key: K): boolean {
    return this.map.has(key) && this.map.get(key)!.isLoaded();
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  async refresh(key: K): Promise<V> {
    if (this.map.has(key)) {
      return this.map.get(key)!.refresh();
    }
    return this.get(key);
  }

  async refreshAll(): Promise<void> {
    const promises: Promise<V>[] = [];
    for (const [key, lazy] of this.map.entries()) {
      promises.push(lazy.refresh());
    }
    await Promise.all(promises);
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  size(): number {
    return this.map.size;
  }
}

export function lazy<T>(factory: () => T | Promise<T>, options?: LazyOptions): Lazy<T> {
  return new Lazy(factory, options);
}

export function lazyMap<K, V>(
  factory: (key: K) => V | Promise<V>,
  options?: LazyOptions
): LazyMap<K, V> {
  return new LazyMap(factory, options);
}

export class LazyCache<T> {
  private readonly cache: Map<string, { value: T; expiresAt: number }> = new Map();
  private readonly ttl: number;

  constructor(ttl = 60000) {
    this.ttl = ttl;
  }

  async get(key: string, factory: () => T | Promise<T>): Promise<T> {
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await Promise.resolve(factory());
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });

    return value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  has(key: string): boolean {
    const cached = this.cache.get(key);
    return cached !== undefined && cached.expiresAt > Date.now();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}

export class LazyPromise<T> {
  private promise?: Promise<T>;
  private readonly factory: () => Promise<T>;

  constructor(factory: () => Promise<T>) {
    this.factory = factory;
  }

  get(): Promise<T> {
    if (!this.promise) {
      this.promise = this.factory();
    }
    return this.promise;
  }

  reset(): void {
    this.promise = undefined;
  }

  isInitialized(): boolean {
    return this.promise !== undefined;
  }
}

export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  options: {
    ttl?: number;
    keyGenerator?: (...args: TArgs) => string;
    maxSize?: number;
  } = {}
): (...args: TArgs) => TResult {
  const cache = new Map<string, { value: TResult; expiresAt?: number }>();
  const { ttl, keyGenerator = (...args) => JSON.stringify(args), maxSize = 100 } = options;

  return (...args: TArgs): TResult => {
    const key = keyGenerator(...args);
    const cached = cache.get(key);

    if (cached) {
      if (!ttl || !cached.expiresAt || cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    const result = fn(...args);

    // Manage cache size
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, {
      value: result,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    });

    return result;
  };
}
