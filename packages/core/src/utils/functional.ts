import { Mutex } from "async-mutex";
import { SetWithObjectKeys } from "./collections";
import { assertOrErr } from "./error";
import * as JSON from "bigint-json-serialization";

export type ArrayElem<T> = T extends Array<infer U> ? U : never;

export function zip<T, U>(a: T[], b: U[]): [T, U][] {
  return a.map((x, i) => [x, b[i]]);
}

export function unzip<T, U>(a: [T, U][]): [T[], U[]] {
  return [a.map(([a, _]) => a), a.map(([_, b]) => b)];
}

export function range(start: number, stop?: number, step = 1): number[] {
  if (!stop) {
    stop = start;
    start = 0;
  }

  return Array(Math.ceil((stop - start) / step))
    .fill(start)
    .map((x, i) => x + i * (step as number));
}

export function groupByArr<T>(
  list: T[],
  keyGetter: (item: T) => string
): T[][] {
  const map = groupByMap(list, keyGetter);
  return Array.from(map.values());
}

export function groupByMap<T>(
  list: T[],
  keyGetter: (item: T) => string
): Map<string, T[]> {
  const map = new Map();
  for (const item of list) {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
      map.set(key, collection);
    }
  }

  return map;
}

// splits an array into two arrays based on a predicate
// returns [pass, fail], where `pass` is the array of items that pass the predicate,
// and `fail` is the array of items that fail the predicate
export function partition<T>(
  arr: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  const pass = [];
  const fail = [];
  for (const item of arr) {
    if (predicate(item)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  }
  return [pass, fail];
}

export function* iterChunks<T>(
  arr: T[],
  chunkSize: number,
  exact = false
): IterableIterator<T[]> {
  while (arr.length >= chunkSize) {
    const chunk = arr.slice(0, chunkSize);
    yield chunk;
    arr = arr.slice(chunkSize);
  }

  if (!exact && arr.length > 0) {
    yield arr;
  }
}

// returns an array with the elements at the given indices omitted
export function omitIndices<T>(arr: T[], ...indices: number[]): T[] {
  const omitted = new Set(indices);
  assertOrErr(
    omitted.size < arr.length,
    "omitIndices: more indices to omit than elements in array"
  );

  return arr.flatMap((item, i) => (omitted.has(i) ? [] : item));
}

export function min(a: bigint, b: bigint): bigint;
export function min(a: number, b: number): number;
export function min(a: number | bigint, b: number | bigint): number | bigint {
  return a < b ? a : b;
}

export function max(a: bigint, b: bigint): bigint;
export function max(a: number, b: number): number;
export function max(a: number | bigint, b: number | bigint): number | bigint {
  return a > b ? a : b;
}

export function maxNullish(
  a: number | undefined | null,
  b: number | undefined | null
): number | undefined {
  if (a === undefined || a === null) {
    return b ?? undefined;
  } else if (b === undefined || b === null) {
    return a ?? undefined;
  } else {
    return max(a, b);
  }
}

export function maxArray(arr: number[]): number;
export function maxArray(arr: bigint[]): bigint;
export function maxArray(arr: number[] | bigint[]): number | bigint {
  assertOrErr(arr.length > 0, "maxArray: array must have at least one element");
  //@ts-ignore
  return arr.reduce((curr, x) => max(curr, x));
}

export function maxByKey<T>(
  arr: T[],
  keyGetter: (item: T) => number | bigint
): T {
  assertOrErr(arr.length > 0, "maxByKey: array must have at least one element");
  return arr.reduce((curr, x) => (keyGetter(curr) > keyGetter(x) ? curr : x));
}

export type Thunk<T, P extends any[] = any[]> = (...args: P) => Promise<T>;

export function thunk<T, P extends any[] = any[]>(
  fn: (...args: P) => Promise<T>
): Thunk<T, P> {
  const mutex = new Mutex();
  const cache = new Map<string, T>(); // cached based on computed result from varying args

  return async (...args: P) =>
    await mutex.runExclusive(async () => {
      const cacheKey = JSON.stringify(args);
      if (!cache.has(cacheKey)) {
        const result = await fn(...args);
        cache.set(cacheKey, result);
      }

      return cache.get(cacheKey)!;
    });
}

export function consecutiveChunks<T>(
  arr: T[],
  idx: (item: T) => number
): T[][] {
  const chunks = [];
  let chunk: T[] = [];
  let prevIdx = -1;
  for (const item of arr) {
    const currIdx = idx(item);
    if (currIdx === prevIdx + 1) {
      chunk.push(item);
    } else {
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      chunk = [item];
    }
    prevIdx = currIdx;
  }
  if (chunk.length > 0) {
    chunks.push(chunk);
  }
  return chunks;
}

export function dedup<T>(arr: T[]): T[] {
  const set = new SetWithObjectKeys(arr.map((t) => t));
  return Array.from(set.values()).map((t) => t);
}
