import { assertOrErr } from "./error";

export function zip<T, U>(a: T[], b: U[]): [T, U][] {
  return a.map((x, i) => [x, b[i]]);
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
  chunkSize: number
): IterableIterator<T[]> {
  let chunk = [];
  const i = 0;
  while (i < arr.length) {
    chunk = arr.slice(i, i + chunkSize);
    yield chunk;
    arr = arr.slice(i + chunkSize);
  }
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

export function maxArray(arr: number[]): number;
export function maxArray(arr: bigint[]): bigint;
export function maxArray(arr: number[] | bigint[]): number | bigint {
  assertOrErr(arr.length > 0, "maxArray: array must have at least one element");
  //@ts-ignore
  return arr.reduce((curr, x) => max(curr, x));
}

export type Thunk<T> = () => Promise<T>;

export function thunk<T>(fn: () => Promise<T>): Thunk<T> {
  let item: T | undefined;

  return async () => {
    if (!item) {
      item = await fn();
    }

    return item;
  };
}