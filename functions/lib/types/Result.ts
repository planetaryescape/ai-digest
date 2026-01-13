/**
 * Result type for functional error handling
 * Represents either a successful value or an error
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Utilities for working with Result types
 */
export class ResultUtils {
  /**
   * Create a successful result
   */
  static ok<T>(value: T): Result<T> {
    return { ok: true, value };
  }

  /**
   * Create an error result
   */
  static err<E = Error>(error: E): Result<never, E> {
    return { ok: false, error };
  }

  /**
   * Try to execute a function and wrap result
   */
  static async try<T>(fn: () => Promise<T>): Promise<Result<T>> {
    try {
      const value = await fn();
      return ResultUtils.ok(value);
    } catch (error) {
      return ResultUtils.err(error as Error);
    }
  }

  /**
   * Try to execute a sync function and wrap result
   */
  static trySync<T>(fn: () => T): Result<T> {
    try {
      const value = fn();
      return ResultUtils.ok(value);
    } catch (error) {
      return ResultUtils.err(error as Error);
    }
  }

  /**
   * Map over a successful result
   */
  static map<T, U, E = Error>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    if (result.ok) {
      return ResultUtils.ok(fn(result.value));
    }
    return result as Result<U, E>;
  }

  /**
   * Map over an error result
   */
  static mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    if (!result.ok) {
      return ResultUtils.err(fn(result.error));
    }
    return result as Result<T, F>;
  }

  /**
   * Unwrap result or throw error
   */
  static unwrap<T, E>(result: Result<T, E>): T {
    if (result.ok) {
      return result.value;
    }
    throw result.error;
  }

  /**
   * Unwrap result or return default value
   */
  static unwrapOr<T, E = Error>(result: Result<T, E>, defaultValue: T): T {
    if (result.ok) {
      return result.value;
    }
    return defaultValue;
  }

  /**
   * Chain multiple results together
   */
  static async chain<T, U, E = Error>(
    result: Result<T, E>,
    fn: (value: T) => Promise<Result<U, E>>
  ): Promise<Result<U, E>> {
    if (result.ok) {
      return fn(result.value);
    }
    return result as Result<U, E>;
  }

  /**
   * Combine multiple results
   */
  static combine<T, E = Error>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];

    for (const result of results) {
      if (!result.ok) {
        return result as Result<T[], E>;
      }
      values.push(result.value);
    }

    return ResultUtils.ok(values);
  }
}
