import { assertOrErr } from "./error";

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Histogram {
  name: string;
  needsSort: boolean;
  values: number[];

  constructor(name: string) {
    this.name = name;
    this.values = [];
    this.needsSort = false;
  }

  // adds a list of values to the histogram
  sample(...values: number[]): void {
    this.values.push(...values);
    this.needsSort = true;
  }

  // clears the histogram
  clear(): void {
    this.values = [];
    this.needsSort = false;
  }

  // computes the mean
  mean(): number {
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  // computes the standard deviation
  stddev(): number {
    const mean = this.mean();
    const variance =
      this.values.reduce((a, b) => a + (b - mean) ** 2, 0) / this.values.length;
    return Math.sqrt(variance);
  }

  // computes percentiles given a list of percentiles in percent
  // e.g. percentiles([10, 50, 90]) returns [p10, p50, p90]
  // percentiles can be fractional (e.g. the "0.1th" percentile)
  percentiles(percentiles: number[]): number[] {
    assertOrErr(
      percentiles.every((p) => p >= 0),
      "percentiles must be >= 0"
    );
    assertOrErr(
      percentiles.every((p) => p <= 100),
      "percentiles must be <= 100"
    );

    if (this.needsSort) {
      this.values.sort();
      this.needsSort = false;
    }

    if (this.values.length === 0) {
      return new Array(percentiles.length).fill(NaN);
    } else if (this.values.length == 1) {
      return new Array(percentiles.length).fill(this.values[0]);
    }

    return percentiles
      .map((p) => {
        const r = (p / 100) * (this.values.length - 1);
        return [Math.floor(r), r - Math.floor(r)];
      })
      .map(
        ([ri, rf]) =>
          this.values[ri] + rf * (this.values[ri + 1] - this.values[ri])
      );
  }

  // prints mean, stddev, given percentiles (defaults to p1, p10, p50, p90, p99)
  print(percentiles?: number[]): void {
    const ps = this.percentiles(percentiles ?? [1, 10, 50, 90, 99]);
    console.log(
      `${this.name}: mean=${this.mean().toFixed(
        2
      )} stddev=${this.stddev().toFixed(2)} p1=${ps[0].toFixed(
        2
      )} p10=${ps[1].toFixed(2)} p50=${ps[2].toFixed(2)} p90=${ps[3].toFixed(
        2
      )} p99=${ps[4].toFixed(2)}`
    );
  }
}

export async function timedAsync<T>(f: () => Promise<T>): Promise<[T, number]> {
  const startTime = Date.now();
  const result = await f();
  const endTime = Date.now();
  return [result, endTime - startTime];
}

export function timed<T>(f: () => T): [T, number] {
  const startTime = Date.now();
  const result = f();
  const endTime = Date.now();
  return [result, endTime - startTime];
}
