import { AffinePoint, BabyJubJub } from "./BabyJubJub";
import { poseidon4 } from "./hashes";
import { assert } from "./utils";
import * as JSON from "bigint-json-serialization";
import { randomFr } from "./rand";
import {
  CompressedPoint,
  compressPoint,
  decompressPoint,
} from "./pointCompression";

export interface StealthAddress {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
}

export interface CompressedStealthAddress {
  h1: CompressedPoint;
  h2: CompressedPoint;
}

export interface EncryptedCanonAddress {
  c1: CompressedPoint;
  c2: CompressedPoint;
}

export type CanonAddress = AffinePoint<bigint>;

export interface AddressPoints {
  h1: AffinePoint<bigint>;
  h2: AffinePoint<bigint>;
}

export class StealthAddressTrait {
  static toPoints(flattened: StealthAddress): AddressPoints {
    return {
      h1: { x: flattened.h1X, y: flattened.h1Y },
      h2: { x: flattened.h2X, y: flattened.h2Y },
    };
  }

  static fromPoints(addressPoints: AddressPoints): StealthAddress {
    const { h1, h2 } = addressPoints;
    return {
      h1X: h1.x,
      h1Y: h1.y,
      h2X: h2.x,
      h2Y: h2.y,
    };
  }

  static decompress(address: CompressedStealthAddress): StealthAddress {
    const h1 = decompressPoint(address.h1);
    const h2 = decompressPoint(address.h2);

    if (!h1 || !h2) {
      throw new Error("Invalid stealth address");
    }

    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  static compress(address: StealthAddress): CompressedStealthAddress {
    const points = StealthAddressTrait.toPoints(address);
    const h1 = compressPoint(points.h1);
    const h2 = compressPoint(points.h2);

    return {
      h1,
      h2,
    };
  }

  static toString(address: StealthAddress): string {
    const { h1, h2 } = StealthAddressTrait.toPoints(address);
    const h1Str = BabyJubJub.toString(h1);
    const h2Str = BabyJubJub.toString(h2);

    return JSON.stringify([h1Str, h2Str]);
  }

  static fromString(str: string): StealthAddress {
    const parsed = JSON.parse(str);
    assert(Array.isArray(parsed), "StealthAddress must be an array");
    assert(parsed.length === 2, "StealthAddress must have 2 elements");
    const [h1Str, h2Str] = parsed;

    assert(typeof h1Str === "string", "StealthAddress h1 must be a string");
    assert(typeof h2Str === "string", "StealthAddress h2 must be a string");

    // both of these guarantee that the points are on curve and in subgroup
    const h1 = BabyJubJub.fromString(h1Str);
    const h2 = BabyJubJub.fromString(h2Str);

    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  static hash(address: StealthAddress): bigint {
    const { h1X, h1Y, h2X, h2Y } = address;
    return BigInt(poseidon4([h1X, h1Y, h2X, h2Y]));
  }

  static randomize(address: StealthAddress): StealthAddress {
    const points = StealthAddressTrait.toPoints(address);
    const r = randomFr();

    const pointsExt = {
      h1: BabyJubJub.ExtendedPoint.fromAffine(points.h1),
      h2: BabyJubJub.ExtendedPoint.fromAffine(points.h2),
    };

    const h1 = pointsExt.h1.multiply(r).toAffine();
    const h2 = pointsExt.h2.multiply(r).toAffine();

    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  static fromCanonAddress(canonAddr: CanonAddress): StealthAddress {
    return {
      h1X: BigInt(BabyJubJub.BasePointAffine.x),
      h1Y: BigInt(BabyJubJub.BasePointAffine.y),
      h2X: BigInt(canonAddr.x),
      h2Y: BigInt(canonAddr.y),
    };
  }
}
