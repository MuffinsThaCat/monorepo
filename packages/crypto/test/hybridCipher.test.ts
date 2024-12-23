import "mocha";
import { expect } from "chai";
import "./crypto";

import { BabyJubJub } from "../src/BabyJubJub";
import {
  HKDF_SHA256,
  BabyJubJubHybridCipher,
  deserializeHybridCiphertext,
  serializeHybridCiphertext,
} from "../src/hybrid-encryption";
import { randomFr } from "../src/rand";
import {
  HPKE_LABEL,
  KEM_ID,
  SUITE_ID,
  deriveBaseNonce,
} from "../src/hybrid-encryption/nonceDerivation";
import { i2osp } from "../src/utils";
import { unprefixedHexToUint8Array, range } from "./utils";
import { randomBytes } from "crypto";

const BABYJUBJUB_WIDE_REDUCTION_ENTROPY = 64;

describe("BabyJubJubHybridCipher", () => {
  it("encrypts and decrypts messages", () => {
    const cipher = new BabyJubJubHybridCipher(
      BABYJUBJUB_WIDE_REDUCTION_ENTROPY
    );

    const msg = "海賊王に、俺はなる！";
    const msgBytes = new TextEncoder().encode(msg);

    const receiverPrivateKey = randomFr();
    const receiverPublicKey =
      BabyJubJub.BasePointExtended.multiply(receiverPrivateKey).toAffine();

    const ciphertext = cipher.encrypt(msgBytes, receiverPublicKey);
    const decrypted = cipher.decrypt(ciphertext, receiverPrivateKey);
    expect(decrypted).to.deep.equal(msgBytes);
  });

  it("fails to decrypt ciphertext that has been tampered with", () => {
    const cipher = new BabyJubJubHybridCipher(
      BABYJUBJUB_WIDE_REDUCTION_ENTROPY
    );
    const msg = "海賊王に、俺はなる！";
    const msgBytes = new TextEncoder().encode(msg);

    const receiverPrivateKey = randomFr();
    const receiverPublicKey =
      BabyJubJub.BasePointExtended.multiply(receiverPrivateKey).toAffine();

    const ciphertext = cipher.encrypt(msgBytes, receiverPublicKey);
    ciphertext.ciphertextBytes[0] = randomBytes(1)[0];

    const decrypted = cipher.decrypt(ciphertext, receiverPrivateKey);
    expect(decrypted).to.be.null;
  });
});

describe("deriveBaseNonce", () => {
  // HACK: before running base nonce derivation tests, manually overwrite KEM_ID to id of DHKEM(X25519) for tests
  // afterwards, put it back
  const DHKEM_X25519_ID = i2osp(0x0020n, 2);
  const KEM_ID_COPY = new Uint8Array(KEM_ID.length);
  KEM_ID_COPY.set(KEM_ID);
  before(() => {
    KEM_ID.set(DHKEM_X25519_ID);
    SUITE_ID.set(DHKEM_X25519_ID, HPKE_LABEL.length);
  });

  after(() => {
    KEM_ID.set(KEM_ID_COPY);
    SUITE_ID.set(KEM_ID_COPY, HPKE_LABEL.length);
  });

  it("matches base setup information test vector for DHKEM(X25519)", () => {
    // test vector from https://www.rfc-editor.org/rfc/rfc9180.html#name-base-setup-information-2
    const info = unprefixedHexToUint8Array(
      "4f6465206f6e2061204772656369616e2055726e"
    );
    const sharedSecret = unprefixedHexToUint8Array(
      "0bbe78490412b4bbea4812666f7916932b828bba79942424abb65244930d69a7"
    );
    const baseNonceExpected = unprefixedHexToUint8Array(
      "5c4d98150661b848853b547f"
    );
    const baseNonce = deriveBaseNonce(HKDF_SHA256, sharedSecret, 12, info);

    expect(baseNonce).to.deep.equal(baseNonceExpected);
  });
});

describe("serialize and deserialize", () => {
  it("serializes and deserializes ciphertexts", () => {
    range(0, 100).forEach(() => {
      const ciphertextBytes = randomBytes(256);
      const encapsulatedSecretBytes = randomBytes(
        BabyJubJub.BaseField.BYTES * 2
      );
      const ciphertext = {
        ciphertextBytes,
        encapsulatedSecretBytes,
      };

      const serialized = serializeHybridCiphertext(ciphertext);
      const deserialized = deserializeHybridCiphertext(serialized);

      expect(deserialized).to.deep.equal(ciphertext);
    });
  });
});
