import "mocha";
import { expect } from "chai";
import { newOpRequestBuilder, OperationRequest } from "../src";
import {
  range,
  NocturneSigner,
  generateRandomSpendingKey,
  AssetTrait,
} from "@nocturne-xyz/core";
import {
  shitcoin,
  ponzi,
  stablescam,
  monkey,
  plutocracy,
  getDummyHex,
  DUMMY_CONTRACT_ADDR,
  DUMMY_CONFIG,
} from "./utils";
import { ethers } from "ethers";

describe("OpRequestBuilder", () => {
  let provider: ethers.providers.JsonRpcProvider;
  beforeEach(() => {
    provider = ethers.getDefaultProvider() as ethers.providers.JsonRpcProvider;
  });
  it("builds OperationRequest with 1 action, 1 unwrap, 0 payments, no params set", async () => {
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
        },
      ],
      refunds: [
        { encodedAsset: AssetTrait.encode(shitcoin), minRefundValue: 1n },
      ],
      actions: [
        {
          contractAddress: DUMMY_CONTRACT_ADDR,
          encodedFunction: getDummyHex(0),
        },
      ],
      chainId: 1n,
      tellerContract: DUMMY_CONFIG.tellerAddress,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 3n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });

  it("builds OperationRequest with 1 action, 1 unwrap, 1 payment, no params set", async () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const receiver = signer.canonicalAddress();

    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
          payment: {
            receiver,
            value: 1n,
          },
        },
      ],
      refunds: [
        { encodedAsset: AssetTrait.encode(shitcoin), minRefundValue: 1n },
      ],
      actions: [
        {
          contractAddress: DUMMY_CONTRACT_ADDR,
          encodedFunction: getDummyHex(0),
        },
      ],
      chainId: 1n,
      tellerContract: DUMMY_CONFIG.tellerAddress,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 3n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .confidentialPayment(shitcoin, 1n, receiver)
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });

  it("builds OperationRuqestion with 1 action, 1 unwrap, 0 payments, all params set", async () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const refundAddr = signer.generateRandomStealthAddress();

    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
        },
      ],
      refunds: [
        { encodedAsset: AssetTrait.encode(shitcoin), minRefundValue: 1n },
      ],
      actions: [
        {
          contractAddress: DUMMY_CONTRACT_ADDR,
          encodedFunction: getDummyHex(0),
        },
      ],
      refundAddr,
      executionGasLimit: 20n,
      gasPrice: 30n,
      chainId: 1n,
      tellerContract: DUMMY_CONFIG.tellerAddress,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__unwrap(shitcoin, 3n)
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .refundAddr(refundAddr)
      .gas({
        executionGasLimit: 20n,
        gasPrice: 30n,
      })
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });

  it("builds operation with 0 actions, 0 unwraps, 2 payments, no params set", async () => {
    const receivers = range(2)
      .map((_) => generateRandomSpendingKey())
      .map((sk) => new NocturneSigner(sk))
      .map((signer) => signer.canonicalAddress());

    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 0n,
          payment: {
            receiver: receivers[0],
            value: 1n,
          },
        },
        {
          asset: stablescam,
          unwrapValue: 0n,
          payment: {
            receiver: receivers[1],
            value: 2n,
          },
        },
      ],
      refunds: [],
      actions: [],
      chainId: 1n,
      tellerContract: DUMMY_CONFIG.tellerAddress,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .confidentialPayment(shitcoin, 1n, receivers[0])
      .confidentialPayment(stablescam, 2n, receivers[1])
      .deadline(2n)
      .build();

    // joinSplitRequests may not necessarily be in the same order, sort them by asset
    expected.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );
    opRequest.request.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );

    expect(opRequest.request).to.eql(expected);
  });

  it("builds OperationRequest with 2 actions, 5 unwraps, 3 payments, 5 different assets, refund addr set", async () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const refundAddr = signer.generateRandomStealthAddress();

    const receivers = range(3)
      .map((_) => generateRandomSpendingKey())
      .map((sk) => new NocturneSigner(sk))
      .map((signer) => signer.canonicalAddress());

    const actions = range(2).map((i) => ({
      contractAddress: DUMMY_CONTRACT_ADDR,
      encodedFunction: getDummyHex(i),
    }));
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 3n,
          payment: {
            receiver: receivers[0],
            value: 1n,
          },
        },
        {
          asset: ponzi,
          unwrapValue: 69n,
          payment: {
            receiver: receivers[1],
            value: 2n,
          },
        },
        {
          asset: stablescam,
          unwrapValue: 420n,
        },
        {
          asset: monkey,
          unwrapValue: 1n,
          payment: {
            receiver: receivers[2],
            value: 1n,
          },
        },
        {
          asset: plutocracy,
          unwrapValue: 100n,
        },
      ],
      refunds: [
        { encodedAsset: AssetTrait.encode(shitcoin), minRefundValue: 1n },
        { encodedAsset: AssetTrait.encode(ponzi), minRefundValue: 1n },
        { encodedAsset: AssetTrait.encode(stablescam), minRefundValue: 1n },
        { encodedAsset: AssetTrait.encode(plutocracy), minRefundValue: 1n },
      ],
      refundAddr: refundAddr,
      actions,
      chainId: 1n,
      tellerContract: DUMMY_CONFIG.tellerAddress,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(1))
      .__unwrap(shitcoin, 3n)
      .__unwrap(ponzi, 69n)
      .__unwrap(stablescam, 420n)
      .__unwrap(monkey, 1n)
      .__unwrap(plutocracy, 100n)
      .confidentialPayment(shitcoin, 1n, receivers[0])
      .confidentialPayment(ponzi, 2n, receivers[1])
      .confidentialPayment(monkey, 1n, receivers[2])
      .__refund({ asset: shitcoin, minRefundValue: 1n })
      .__refund({ asset: ponzi, minRefundValue: 1n })
      .__refund({ asset: stablescam, minRefundValue: 1n })
      .__refund({ asset: plutocracy, minRefundValue: 1n })
      .refundAddr(refundAddr)
      .deadline(2n)
      .build();

    // joinSplitRequests may not necessarily be in the same order, sort them by asset
    expected.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );
    opRequest.request.joinSplitRequests.sort((a, b) =>
      a.asset.assetAddr.localeCompare(b.asset.assetAddr)
    );

    expect(opRequest.request).to.eql(expected);
  });

  it("combines joinsplit requests of same asset when no conf payments", async () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const refundAddr = signer.generateRandomStealthAddress();

    const actions = range(2).map((i) => ({
      contractAddress: DUMMY_CONTRACT_ADDR,
      encodedFunction: getDummyHex(i),
    }));
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 300n,
        },
        {
          asset: ponzi,
          unwrapValue: 300n,
        },
      ],
      refunds: [],
      refundAddr: refundAddr,
      actions,
      chainId: 1n,
      tellerContract: DUMMY_CONFIG.tellerAddress,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(1))
      .__unwrap(shitcoin, 100n)
      .__unwrap(ponzi, 100n)
      .__unwrap(shitcoin, 100n)
      .__unwrap(ponzi, 100n)
      .__unwrap(shitcoin, 100n)
      .__unwrap(ponzi, 100n)
      .refundAddr(refundAddr)
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });

  it("combines refunds for same asset", async () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const refundAddr = signer.generateRandomStealthAddress();

    const actions = range(2).map((i) => ({
      contractAddress: DUMMY_CONTRACT_ADDR,
      encodedFunction: getDummyHex(i),
    }));
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 100n,
        },
      ],
      refunds: [
        { encodedAsset: AssetTrait.encode(ponzi), minRefundValue: 400n },
        { encodedAsset: AssetTrait.encode(monkey), minRefundValue: 400n },
      ],
      refundAddr: refundAddr,
      actions,
      chainId: 1n,
      tellerContract: DUMMY_CONFIG.tellerAddress,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(0))
      .__action(DUMMY_CONTRACT_ADDR, getDummyHex(1))
      .__unwrap(shitcoin, 100n)
      .__refund({ asset: ponzi, minRefundValue: 100n })
      .__refund({ asset: ponzi, minRefundValue: 100n })
      .__refund({ asset: ponzi, minRefundValue: 200n })
      .__refund({ asset: monkey, minRefundValue: 200n })
      .__refund({ asset: monkey, minRefundValue: 200n })
      .refundAddr(refundAddr)
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });

  it("handles sequence of unwraps and refunds for same asset", async () => {
    const sk = generateRandomSpendingKey();
    const signer = new NocturneSigner(sk);
    const refundAddr = signer.generateRandomStealthAddress();

    // NOTE: because the below op builder request effectively swaps back and forth with the same 50
    // tokens of the same asset, we only need to unwrap 50 tokens total and expect back the same 50
    const expected: OperationRequest = {
      joinSplitRequests: [
        {
          asset: shitcoin,
          unwrapValue: 50n,
        },
        {
          asset: ponzi,
          unwrapValue: 50n,
        },
      ],
      refunds: [
        { encodedAsset: AssetTrait.encode(shitcoin), minRefundValue: 60n },
        { encodedAsset: AssetTrait.encode(ponzi), minRefundValue: 50n },
      ],
      actions: [],
      refundAddr: refundAddr,
      chainId: 1n,
      tellerContract: DUMMY_CONFIG.tellerAddress,
      deadline: 2n,
    };

    const builder = newOpRequestBuilder(provider, 1n, DUMMY_CONFIG);
    const opRequest = await builder
      .__unwrap(shitcoin, 50n) // -unwrap 50 shitcoin
      .__refund({ asset: shitcoin, minRefundValue: 50n }) // +expect the 50 shitcoin back
      .__unwrap(ponzi, 50n) // -unwrap 50 ponzi
      .__refund({ asset: shitcoin, minRefundValue: 50n }) // +expect 50 more shitcoin (100 shitcoin)
      .__unwrap(shitcoin, 50n) // -50 shitcoin from existing 100 (50 left)
      .__refund({ asset: ponzi, minRefundValue: 100n }) // +get back 100 ponzi
      .__unwrap(ponzi, 50n) // -use 50 of the 100 ponzi (50 left)
      .__refund({ asset: shitcoin, minRefundValue: 10n }) // expect 10 more shitcoin back (60)
      .refundAddr(refundAddr)
      .deadline(2n)
      .build();

    expect(opRequest.request).to.eql(expected);
  });
});
