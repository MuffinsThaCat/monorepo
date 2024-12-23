import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { setupTestDeployment, setupTestClient } from "../src/deploy";
import { ethers } from "ethers";
import { CanonicalAddressRegistry } from "@nocturne-xyz/contracts";
import {
  Asset,
  SolidityProof,
  computeCanonAddrRegistryEntryDigest,
  packToSolidityProof,
  CanonAddrSigCheckInputs,
  CanonAddrSigCheckProver,
} from "@nocturne-xyz/core";
import { NocturneSigner, compressPoint } from "@nocturne-xyz/crypto";

chai.use(chaiAsPromised);

describe("Canonical Address Registry", async () => {
  let teardown: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;

  let canonAddrRegistry: CanonicalAddressRegistry;
  let nocturneSignerAlice: NocturneSigner;
  let nocturneSignerBob: NocturneSigner;

  let canonAddrSigCheckProver: CanonAddrSigCheckProver;

  let gasTokenAsset: Asset;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        bundler: false,
        subtreeUpdater: false,
        subgraph: false,
        depositScreener: false,
      },
    });

    ({ provider, teardown, canonAddrRegistry, aliceEoa, bobEoa } =
      testDeployment);

    ({ gasTokenAsset } = testDeployment.tokens);

    ({ nocturneSignerAlice, nocturneSignerBob, canonAddrSigCheckProver } =
      await setupTestClient(testDeployment.config, provider, {
        gasAssets: new Map([["GAS", gasTokenAsset.assetAddr]]),
      }));
  });

  afterEach(async () => {
    await teardown();
  });

  async function generateRegisterInputs(
    eoa: ethers.Wallet,
    nocturneSigner: NocturneSigner
  ): Promise<[bigint, SolidityProof]> {
    const canonAddr = nocturneSigner.canonicalAddress();
    const compressedCanonAddr = compressPoint(canonAddr);
    const nonce = (
      await canonAddrRegistry._compressedCanonAddrToNonce(compressedCanonAddr)
    ).toBigInt();

    const digest = computeCanonAddrRegistryEntryDigest(
      {
        ethAddress: eoa.address,
        compressedCanonAddr,
        perCanonAddrNonce: nonce,
      },
      31337n,
      canonAddrRegistry.address
    );
    const sig = nocturneSigner.sign(digest);

    const spendPubKey = nocturneSigner.spendPk;
    const vkNonce = nocturneSigner.vkNonce;

    const proofInputs: CanonAddrSigCheckInputs = {
      canonAddr,
      msg: digest,
      sig,
      spendPubkey: spendPubKey,
      vkNonce,
    };

    const { proof } = await canonAddrSigCheckProver.proveCanonAddrSigCheck(
      proofInputs
    );

    return [compressedCanonAddr, packToSolidityProof(proof)];
  }

  async function register(
    eoa: ethers.Wallet,
    compressedCanonAddr: bigint,
    proof: SolidityProof
  ): Promise<ethers.ContractTransaction> {
    const nonce = (
      await canonAddrRegistry._compressedCanonAddrToNonce(compressedCanonAddr)
    ).toBigInt();

    console.log(
      `submitting call to map ${eoa.address} to ${compressedCanonAddr}...`
    );
    const tx = await canonAddrRegistry
      .connect(eoa)
      .setCanonAddr(compressedCanonAddr, proof);

    expect(
      (
        await canonAddrRegistry._compressedCanonAddrToNonce(compressedCanonAddr)
      ).toBigInt()
    ).to.equal(nonce + 1n);
    expect(
      (
        await canonAddrRegistry._ethAddressToCompressedCanonAddr(eoa.address)
      ).toBigInt()
    ).to.equal(compressedCanonAddr);

    return tx;
  }

  it("generates sig proof and registers canon addr", async () => {
    // Register alice 1st time
    let [compressedCanonAddr, proof] = await generateRegisterInputs(
      aliceEoa,
      nocturneSignerAlice
    );
    await register(aliceEoa, compressedCanonAddr, proof);

    // Register alice 2nd time
    [compressedCanonAddr, proof] = await generateRegisterInputs(
      aliceEoa,
      nocturneSignerAlice
    );
    await register(aliceEoa, compressedCanonAddr, proof);

    // Register bob 1st time using alice canon addr
    [compressedCanonAddr, proof] = await generateRegisterInputs(
      bobEoa,
      nocturneSignerAlice
    );
    await register(bobEoa, compressedCanonAddr, proof);

    // Register bob 2nd time using bob canon addr
    [compressedCanonAddr, proof] = await generateRegisterInputs(
      bobEoa,
      nocturneSignerBob
    );
    await register(bobEoa, compressedCanonAddr, proof);
  });

  it("reverts if msg.sender !match digest", async () => {
    const [compressedCanonAddr, proof] = await generateRegisterInputs(
      aliceEoa,
      nocturneSignerAlice
    );

    await expect(register(bobEoa, compressedCanonAddr, proof)).to.eventually.be
      .rejected;

    expect(
      (
        await canonAddrRegistry._ethAddressToCompressedCanonAddr(bobEoa.address)
      ).toBigInt()
    ).to.equal(0n);
  });

  it("reverts if proof is invalid", async () => {
    const [compressedCanonAddr, proof] = await generateRegisterInputs(
      aliceEoa,
      nocturneSignerAlice
    );
    proof[0] += 1n; // invalid proof

    expect(register(aliceEoa, compressedCanonAddr, proof)).to.eventually.be
      .rejected;

    expect(
      (
        await canonAddrRegistry._ethAddressToCompressedCanonAddr(
          aliceEoa.address
        )
      ).toBigInt()
    ).to.equal(0n);
  });

  it("reverts if digest is invalid", async () => {
    const canonAddr = nocturneSignerAlice.canonicalAddress();
    const compressedCanonAddr = compressPoint(canonAddr);
    const nonce = (
      await canonAddrRegistry._compressedCanonAddrToNonce(compressedCanonAddr)
    ).toBigInt();

    const digest = computeCanonAddrRegistryEntryDigest(
      {
        ethAddress: aliceEoa.address,
        compressedCanonAddr,
        perCanonAddrNonce: nonce + 10n, // make nonce incorrect
      },
      31337n,
      canonAddrRegistry.address
    );

    const sig = nocturneSignerAlice.sign(digest);

    const spendPubKey = nocturneSignerAlice.spendPk;
    const vkNonce = nocturneSignerAlice.vkNonce;

    const proofInputs: CanonAddrSigCheckInputs = {
      canonAddr,
      msg: digest,
      sig,
      spendPubkey: spendPubKey,
      vkNonce,
    };

    const { proof } = await canonAddrSigCheckProver.proveCanonAddrSigCheck(
      proofInputs
    );

    await expect(
      canonAddrRegistry
        .connect(aliceEoa)
        .setCanonAddr(compressedCanonAddr, packToSolidityProof(proof))
    ).to.eventually.be.rejected;

    expect(
      (
        await canonAddrRegistry._ethAddressToCompressedCanonAddr(
          aliceEoa.address
        )
      ).toBigInt()
    ).to.equal(0n);
  });
});
