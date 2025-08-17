export function pipe<A, B>(value: A, fn1: (a: A) => B): B;
export function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
export function pipe<A, B, C, D>(
  value: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D
): D;
export function pipe<A, B, C, D, E>(
  value: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
  fn4: (d: D) => E
): E;
export function pipe(value: any, ...fns: Array<(a: any) => any>): any {
  return fns.reduce((v, fn) => fn(v), value);
}

export function compose<A, B>(fn1: (a: A) => B): (a: A) => B;
export function compose<A, B, C>(fn2: (b: B) => C, fn1: (a: A) => B): (a: A) => C;
export function compose<A, B, C, D>(
  fn3: (c: C) => D,
  fn2: (b: B) => C,
  fn1: (a: A) => B
): (a: A) => D;
export function compose(...fns: Array<(a: any) => any>): (a: any) => any {
  return (value: any) => fns.reduceRight((v, fn) => fn(v), value);
}

export function curry<A, B, C>(fn: (a: A, b: B) => C): (a: A) => (b: B) => C;
export function curry<A, B, C, D>(
  fn: (a: A, b: B, c: C) => D
): (a: A) => (b: B) => (c: C) => D;
export function curry(fn: Function): Function {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...nextArgs: any[]) => curried(...args, ...nextArgs);
  };
}

export function partial<A, B, C>(fn: (a: A, b: B) => C, a: A): (b: B) => C;
export function partial<A, B, C, D>(fn: (a: A, b: B, c: C) => D, a: A): (b: B, c: C) => D;
export function partial<A, B, C, D>(
  fn: (a: A, b: B, c: C) => D,
  a: A,
  b: B
): (c: C) => D;
export function partial(fn: Function, ...args: any[]): Function {
  return (...remainingArgs: any[]) => fn(...args, ...remainingArgs);
}

export const identity = <T>(x: T): T => x;

export const constant = <T>(x: T) => (): T => x;

export function map<A, B>(fn: (a: A) => B): (arr: A[]) => B[] {
  return (arr) => arr.map(fn);
}

export function filter<A>(predicate: (a: A) => boolean): (arr: A[]) => A[] {
  return (arr) => arr.filter(predicate);
}

export function reduce<A, B>(
  reducer: (acc: B, value: A) => B,
  initial: B
): (arr: A[]) => B {
  return (arr) => arr.reduce(reducer, initial);
}

export function flatMap<A, B>(fn: (a: A) => B[]): (arr: A[]) => B[] {
  return (arr) => arr.flatMap(fn);
}

export function tap<T>(fn: (x: T) => void): (x: T) => T {
  return (x) => {
    fn(x);
    return x;
  };
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | undefined;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, delay - timeSinceLastCall);
    }
  };
}

export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false;
  let result: ReturnType<T>;
  
  return ((...args: Parameters<T>) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  }) as T;
}

export interface Option<T> {
  map<U>(fn: (value: T) => U): Option<U>;
  flatMap<U>(fn: (value: T) => Option<U>): Option<U>;
  filter(predicate: (value: T) => boolean): Option<T>;
  getOrElse(defaultValue: T): T;
  fold<U>(onNone: () => U, onSome: (value: T) => U): U;
  isSome(): boolean;
  isNone(): boolean;
}

class Some<T> implements Option<T> {
  constructor(private readonly value: T) {}

  map<U>(fn: (value: T) => U): Option<U> {
    return some(fn(this.value));
  }

  flatMap<U>(fn: (value: T) => Option<U>): Option<U> {
    return fn(this.value);
  }

  filter(predicate: (value: T) => boolean): Option<T> {
    return predicate(this.value) ? this : none<T>();
  }

  getOrElse(_defaultValue: T): T {
    return this.value;
  }

  fold<U>(_onNone: () => U, onSome: (value: T) => U): U {
    return onSome(this.value);
  }

  isSome(): boolean {
    return true;
  }

  isNone(): boolean {
    return false;
  }
}

class None<T> implements Option<T> {
  map<U>(_fn: (value: T) => U): Option<U> {
    return none<U>();
  }

  flatMap<U>(_fn: (value: T) => Option<U>): Option<U> {
    return none<U>();
  }

  filter(_predicate: (value: T) => boolean): Option<T> {
    return this;
  }

  getOrElse(defaultValue: T): T {
    return defaultValue;
  }

  fold<U>(onNone: () => U, _onSome: (value: T) => U): U {
    return onNone();
  }

  isSome(): boolean {
    return false;
  }

  isNone(): boolean {
    return true;
  }
}

export function some<T>(value: T): Option<T> {
  return new Some(value);
}

export function none<T>(): Option<T> {
  return new None<T>();
}

export function fromNullable<T>(value: T | null | undefined): Option<T> {
  return value === null || value === undefined ? none<T>() : some(value);
}

export interface Either<L, R> {
  map<U>(fn: (value: R) => U): Either<L, U>;
  flatMap<U>(fn: (value: R) => Either<L, U>): Either<L, U>;
  mapLeft<U>(fn: (value: L) => U): Either<U, R>;
  fold<U>(onLeft: (value: L) => U, onRight: (value: R) => U): U;
  isLeft(): boolean;
  isRight(): boolean;
  getOrElse(defaultValue: R): R;
}

class Left<L, R> implements Either<L, R> {
  constructor(private readonly value: L) {}

  map<U>(_fn: (value: R) => U): Either<L, U> {
    return left<L, U>(this.value);
  }

  flatMap<U>(_fn: (value: R) => Either<L, U>): Either<L, U> {
    return left<L, U>(this.value);
  }

  mapLeft<U>(fn: (value: L) => U): Either<U, R> {
    return left<U, R>(fn(this.value));
  }

  fold<U>(onLeft: (value: L) => U, _onRight: (value: R) => U): U {
    return onLeft(this.value);
  }

  isLeft(): boolean {
    return true;
  }

  isRight(): boolean {
    return false;
  }

  getOrElse(defaultValue: R): R {
    return defaultValue;
  }
}

class Right<L, R> implements Either<L, R> {
  constructor(private readonly value: R) {}

  map<U>(fn: (value: R) => U): Either<L, U> {
    return right<L, U>(fn(this.value));
  }

  flatMap<U>(fn: (value: R) => Either<L, U>): Either<L, U> {
    return fn(this.value);
  }

  mapLeft<U>(_fn: (value: L) => U): Either<U, R> {
    return right<U, R>(this.value);
  }

  fold<U>(_onLeft: (value: L) => U, onRight: (value: R) => U): U {
    return onRight(this.value);
  }

  isLeft(): boolean {
    return false;
  }

  isRight(): boolean {
    return true;
  }

  getOrElse(_defaultValue: R): R {
    return this.value;
  }
}

export function left<L, R>(value: L): Either<L, R> {
  return new Left<L, R>(value);
}

export function right<L, R>(value: R): Either<L, R> {
  return new Right<L, R>(value);
}

export function tryCatch<L, R>(
  fn: () => R,
  onError: (error: unknown) => L
): Either<L, R> {
  try {
    return right(fn());
  } catch (error) {
    return left(onError(error));
  }
}

export async function tryCatchAsync<L, R>(
  fn: () => Promise<R>,
  onError: (error: unknown) => L
): Promise<Either<L, R>> {
  try {
    const result = await fn();
    return right(result);
  } catch (error) {
    return left(onError(error));
  }
}

export function partition<T>(
  arr: T[],
  predicate: (value: T) => boolean
): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];
  
  for (const item of arr) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }
  
  return [truthy, falsy];
}

export function groupBy<T, K extends string | number | symbol>(
  arr: T[],
  keyFn: (value: T) => K
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function zip<A, B>(arr1: A[], arr2: B[]): Array<[A, B]> {
  const length = Math.min(arr1.length, arr2.length);
  const result: Array<[A, B]> = [];
  
  for (let i = 0; i < length; i++) {
    result.push([arr1[i], arr2[i]]);
  }
  
  return result;
}

export function unzip<A, B>(arr: Array<[A, B]>): [A[], B[]] {
  const arr1: A[] = [];
  const arr2: B[] = [];
  
  for (const [a, b] of arr) {
    arr1.push(a);
    arr2.push(b);
  }
  
  return [arr1, arr2];
}