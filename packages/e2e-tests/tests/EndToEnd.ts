import {
  NocturneClient,
  NocturneDB,
  OperationRequestWithMetadata,
  newOpRequestBuilder,
  proveOperation,
  signOperation,
} from "@nocturne-xyz/client";
import { NocturneConfig } from "@nocturne-xyz/config";
import {
  DepositManager,
  Handler,
  SimpleERC20Token__factory,
  Teller,
  WETH9,
} from "@nocturne-xyz/contracts";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Teller";
import {
  Asset,
  AssetTrait,
  JoinSplitProver,
  NocturneSigner,
  OperationStatus,
  SubmittableOperationWithNetworkInfo,
  queryEvents,
  sleep,
} from "@nocturne-xyz/core";
import {
  Erc20Plugin,
  EthTransferAdapterPlugin,
} from "@nocturne-xyz/op-request-plugins";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "ethers";
import { setupTestClient, setupTestDeployment } from "../src/deploy";
import { depositFundsMultiToken } from "../src/deposit";
import {
  GAS_FAUCET_DEFAULT_AMOUNT,
  GAS_PRICE,
  ONE_DAY_SECONDS,
  checkBundlerHasNf,
  submitAndProcessOperation,
} from "../src/utils";

chai.use(chaiAsPromised);

interface BundlerSubmissionSuccess {
  type: "success";
  expectedBundlerStatus: OperationStatus;
}

interface BundlerSubmissionError {
  type: "error";
  errorMessageLike: string;
}

type BundlerSubmissionResult =
  | BundlerSubmissionSuccess
  | BundlerSubmissionError;

interface TestE2EParams {
  opOrOpRequest:
    | OperationRequestWithMetadata
    | SubmittableOperationWithNetworkInfo;
  expectedResult: BundlerSubmissionResult;
  contractChecks?: () => Promise<void>;
  offchainChecks?: () => Promise<void>;
}

const PER_NOTE_AMOUNT = 100n * 1_000_000n;

describe("full system: contracts, sdk, bundler, subtree updater, and subgraph", async () => {
  let teardown: () => Promise<void>;
  let fillSubtreeBatch: () => Promise<void>;

  let provider: ethers.providers.JsonRpcProvider;
  let aliceEoa: ethers.Wallet;
  let bobEoa: ethers.Wallet;
  let bundlerEoa: ethers.Wallet;

  let config: NocturneConfig;
  let depositManager: DepositManager;
  let teller: Teller;
  let handler: Handler;
  let weth: WETH9;
  let nocturneSignerAlice: NocturneSigner;
  let nocturneDBAlice: NocturneDB;
  let nocturneClientAlice: NocturneClient;
  let nocturneDBBob: NocturneDB;
  let nocturneClientBob: NocturneClient;
  let joinSplitProver: JoinSplitProver;

  let erc20: SimpleERC20Token;
  let erc20Asset: Asset;

  let gasToken: SimpleERC20Token;
  let gasTokenAsset: Asset;

  beforeEach(async () => {
    const testDeployment = await setupTestDeployment({
      include: {
        bundler: true,
        subtreeUpdater: true,
        subgraph: true,
        depositScreener: true,
      },
    });

    ({
      provider,
      teardown,
      config,
      teller,
      handler,
      weth,
      aliceEoa,
      bobEoa,
      bundlerEoa,
      depositManager,
      fillSubtreeBatch,
    } = testDeployment);

    ({ erc20, erc20Asset, gasToken, gasTokenAsset } = testDeployment.tokens);

    ({
      nocturneDBAlice,
      nocturneSignerAlice,
      nocturneClientAlice,
      nocturneDBBob,
      nocturneClientBob,
      joinSplitProver,
    } = await setupTestClient(testDeployment.config, provider, {
      gasAssets: new Map([["GAS", gasTokenAsset.assetAddr]]),
    }));
  });

  afterEach(async () => {
    await teardown();
  });

  async function testE2E({
    opOrOpRequest,
    contractChecks,
    offchainChecks,
    expectedResult,
  }: TestE2EParams): Promise<void> {
    let operation: SubmittableOperationWithNetworkInfo;
    if ("request" in opOrOpRequest) {
      console.log("alice: Sync SDK");
      await nocturneClientAlice.sync();

      console.log("bob: Sync SDK");
      await nocturneClientBob.sync();

      const preOpNotesAlice = await nocturneDBAlice.getAllNotes();
      console.log("alice pre-op notes:", preOpNotesAlice);
      console.log(
        "alice pre-op latestCommittedMerkleIndex",
        await nocturneDBAlice.latestCommittedMerkleIndex()
      );

      console.log("prepare, sign, and prove operation with NocturneClient");
      const preSign = await nocturneClientAlice.prepareOperation(
        opOrOpRequest.request,
        1
      );
      const signed = signOperation(nocturneSignerAlice, preSign);
      operation = await proveOperation(joinSplitProver, signed);
    } else {
      operation = opOrOpRequest;
    }

    console.log("proven operation:", operation);
    if (expectedResult.type === "error") {
      try {
        await submitAndProcessOperation(operation);
        throw new Error(
          `expected error like: ${expectedResult.errorMessageLike} but got success instead`
        );
      } catch (err) {
        expect((err as Error).message).to.include(
          expectedResult.errorMessageLike
        );
      }
      return;
    }

    const status = await submitAndProcessOperation(operation);
    await contractChecks?.();
    await offchainChecks?.();

    expect(expectedResult.expectedBundlerStatus).to.eql(status);
  }

  it("bundler rejects operation with gas price < chain's gas price", async () => {
    console.log("deposit funds");
    await depositFundsMultiToken(
      depositManager,
      [
        [erc20, [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneClientAlice.viewer.generateRandomStealthAddress()
    );
    console.log("fill batch and wait for subtree update");
    await fillSubtreeBatch();

    // make an operation with gas price < chain's gas price (1 wei <<< 1 gwei)
    // HH's default gas price seems to be somewhere around 1 gwei experimentally
    // unfortunately it doesn't have a way to set it in the chain itself, only in hre
    const chainId = BigInt((await provider.getNetwork()).chainId);
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .__unwrap(erc20Asset, PER_NOTE_AMOUNT)
      .gasPrice(1n)
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .build();

    await expect(
      testE2E({
        opOrOpRequest: opRequestWithMetadata,
        expectedResult: {
          type: "success",
          expectedBundlerStatus: OperationStatus.BUNDLE_REVERTED,
        },
      })
    ).to.eventually.be.rejectedWith("gas price too low");
  });

  it("bundler rejects operation and throws call revert exception via opValidation.checkRevertError()", async () => {
    console.log("deposit funds and commit note commitments");
    await depositFundsMultiToken(
      depositManager,
      [
        [erc20, [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneClientAlice.viewer.generateRandomStealthAddress()
    );
    await fillSubtreeBatch();

    console.log("encode transfer erc20 action");
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [await bobEoa.getAddress(), PER_NOTE_AMOUNT]
      );

    const chainId = BigInt((await provider.getNetwork()).chainId);
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .__unwrap(erc20Asset, (PER_NOTE_AMOUNT * 3n) / 2n)
      .__action(erc20.address, encodedFunction)
      .gas({
        executionGasLimit: 1n, // Intentionally too low
        gasPrice: GAS_PRICE,
      })
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .build();

    await testE2E({
      opOrOpRequest: opRequestWithMetadata,
      expectedResult: {
        type: "error",
        errorMessageLike:
          "operation processing fails with: exceeded `executionGasLimit`",
      },
    });
  });

  it("bundler revalidates op and marks failed if fails", async () => {
    console.log("deposit funds");
    await depositFundsMultiToken(
      depositManager,
      [
        [erc20, [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneClientAlice.viewer.generateRandomStealthAddress()
    );
    console.log("fill batch and wait for subtree update");
    await fillSubtreeBatch();

    console.log("alice: Sync SDK");
    await nocturneClientAlice.sync();

    // Make transfer op and sign/prove up front
    const chainId = BigInt((await provider.getNetwork()).chainId);
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .use(Erc20Plugin)
      .__unwrap(erc20Asset, PER_NOTE_AMOUNT)
      .gasPrice(GAS_PRICE)
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .erc20Transfer(erc20Asset.assetAddr, bobEoa.address, 100n)
      .build();

    console.log("prepare, sign, and prove operation with NocturneClient");
    const preSign = await nocturneClientAlice.prepareOperation(
      opRequestWithMetadata.request,
      1
    );
    const signed = signOperation(nocturneSignerAlice, preSign);
    const operation = await proveOperation(joinSplitProver, signed);

    // Submit op to bundler without awaiting
    const bundlerSubmitProm = testE2E({
      opOrOpRequest: operation,
      expectedResult: {
        type: "success",
        expectedBundlerStatus: OperationStatus.OPERATION_VALIDATION_FAILED,
      },
      offchainChecks: async () => {
        // check that nfs are removed from db
        const nfs = preSign.joinSplits.flatMap(({ nullifierA, nullifierB }) => [
          nullifierA,
          nullifierB,
        ]);
        const checks = await Promise.all(
          nfs.map((nf) => checkBundlerHasNf(nf))
        );
        expect(checks.every((check) => check === false)).to.be.true;
      },
    });

    // Immediately frontrun bundler submitter so op passes validation but fails revalidation
    console.log("frontrunning bundler by directly submitting op");
    await sleep(1_000);
    await teller
      .connect(aliceEoa)
      .processBundle({ operations: [operation] }, { gasLimit: 2_000_000 });

    // awaiting prom should pass if op status ends up being OPERATION_VALIDATION_FAILED
    await bundlerSubmitProm;
  });

  it(`alice deposits four notes, public ERC20 transfers some to Bob, privately pays some to Bob`, async () => {
    const ALICE_UNWRAP_VAL = PER_NOTE_AMOUNT * 2n + (PER_NOTE_AMOUNT * 3n) / 4n; // 2.75 notes
    const ALICE_TO_BOB_PUB_VAL = PER_NOTE_AMOUNT * 2n + PER_NOTE_AMOUNT / 2n; // 2.5 notes
    const ALICE_TO_BOB_PRIV_VAL = PER_NOTE_AMOUNT / 4n; // 0.25 notes

    console.log("deposit funds and commit note commitments");
    await depositFundsMultiToken(
      depositManager,
      [
        [
          erc20,
          [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT, PER_NOTE_AMOUNT, PER_NOTE_AMOUNT],
        ],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneClientAlice.viewer.generateRandomStealthAddress()
    );
    await fillSubtreeBatch();

    console.log("encode transfer erc20 action");
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [await bobEoa.getAddress(), ALICE_TO_BOB_PUB_VAL] // transfer 2.5 notes
      );

    const chainId = BigInt((await provider.getNetwork()).chainId);
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .__unwrap(erc20Asset, ALICE_UNWRAP_VAL) // unwrap total 2.75 notes
      .confidentialPayment(
        erc20Asset,
        ALICE_TO_BOB_PRIV_VAL, // conf pay 0.25 notes
        nocturneClientBob.viewer.canonicalAddress()
      )
      .__action(erc20.address, encodedFunction)
      .gasPrice(GAS_PRICE)
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .build(); // NOTE: alice spends all 4 notes because its 2.75 unwrapped + 0.25 conf pay + gas

    const bundlerBalanceBefore = (
      await gasToken.balanceOf(await bundlerEoa.getAddress())
    ).toBigInt();
    console.log("bundler gas asset balance before op:", bundlerBalanceBefore);

    const contractChecks = async () => {
      console.log("check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await queryEvents(
        teller,
        teller.filters.OperationProcessed(),
        0,
        latestBlock
      );
      expect(events.length).to.equal(1);
      expect(events[0].args.opProcessed).to.equal(true);
      expect(events[0].args.callSuccesses[0]).to.equal(true);

      expect(
        (await erc20.balanceOf(await aliceEoa.getAddress())).toBigInt()
      ).to.equal(0n);
      expect(
        (await erc20.balanceOf(await bobEoa.getAddress())).toBigInt()
      ).to.equal(ALICE_TO_BOB_PUB_VAL);
      expect((await erc20.balanceOf(teller.address)).toBigInt()).to.equal(
        4n * PER_NOTE_AMOUNT - ALICE_TO_BOB_PUB_VAL
      );
      expect((await erc20.balanceOf(handler.address)).toBigInt()).to.equal(1n);
    };

    const offchainChecks = async () => {
      console.log("alice: Sync SDK post-operation");
      await nocturneClientAlice.sync();
      const updatedNotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc20Asset,
        { includeUncommitted: true }
      )!;
      const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);
      // alice should have 2 nonzero notes total, since all 4 notes spent, alice gets 1 output
      // note from JSs and 1 refund note (all in same token)
      expect(nonZeroNotesAlice.length).to.equal(2);
      console.log("alice post-op notes:", nonZeroNotesAlice);

      // alice should have a note with refund value from public spendk
      let foundNotesAlice = nonZeroNotesAlice.filter(
        (n) => n.value === ALICE_UNWRAP_VAL - ALICE_TO_BOB_PUB_VAL
      );
      expect(foundNotesAlice.length).to.equal(1);

      // alice should have another note with output value from private payment to bob
      foundNotesAlice = nonZeroNotesAlice.filter(
        (n) =>
          n.value ===
          4n * PER_NOTE_AMOUNT - ALICE_UNWRAP_VAL - ALICE_TO_BOB_PRIV_VAL
      );
      expect(foundNotesAlice.length).to.equal(1);

      console.log("bob: Sync SDK post-operation");
      await nocturneClientBob.sync();
      const updatedNotesBob = await nocturneDBBob.getNotesForAsset(erc20Asset, {
        includeUncommitted: true,
      })!;
      const nonZeroNotesBob = updatedNotesBob.filter((n) => n.value > 0n);
      // bob should have one nonzero note total
      expect(nonZeroNotesBob.length).to.equal(1);

      // That one note should contain the tokens sent privately from alice
      expect(nonZeroNotesBob[0].value).to.equal(ALICE_TO_BOB_PRIV_VAL);

      // check that bundler got compensated for gas
      const bundlerBalanceAfter = (
        await gasToken.balanceOf(await bundlerEoa.getAddress())
      ).toBigInt();

      console.log("bundler gas asset balance after op:", bundlerBalanceAfter);
      // for some reason, mocha `.gte` doesn't work here
      expect(bundlerBalanceAfter > bundlerBalanceBefore).to.be.true;
    };

    await testE2E({
      opOrOpRequest: opRequestWithMetadata,
      contractChecks,
      offchainChecks,
      expectedResult: {
        type: "success",
        expectedBundlerStatus: OperationStatus.EXECUTED_SUCCESS,
      },
    });
  });

  it(`alice deposits ten ${PER_NOTE_AMOUNT} and can submit op with 5 joinsplits`, async () => {
    const ALICE_UNWRAP_VAL = PER_NOTE_AMOUNT * 10n; // 10 notes
    const ALICE_TO_BOB_PUB_VAL = ALICE_UNWRAP_VAL; // 10 notes

    console.log("deposit funds and commit note commitments");
    await depositFundsMultiToken(
      depositManager,
      [
        [
          erc20,
          [
            PER_NOTE_AMOUNT,
            PER_NOTE_AMOUNT,
            PER_NOTE_AMOUNT,
            PER_NOTE_AMOUNT,
            PER_NOTE_AMOUNT,
            PER_NOTE_AMOUNT,
            PER_NOTE_AMOUNT,
            PER_NOTE_AMOUNT,
            PER_NOTE_AMOUNT,
            PER_NOTE_AMOUNT,
          ],
        ],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneSignerAlice.generateRandomStealthAddress()
    );
    await fillSubtreeBatch();

    console.log("encode transfer erc20 action");
    const encodedFunction =
      SimpleERC20Token__factory.createInterface().encodeFunctionData(
        "transfer",
        [await bobEoa.getAddress(), ALICE_TO_BOB_PUB_VAL] // transfer 2.5 notes
      );

    const chainId = BigInt((await provider.getNetwork()).chainId);
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .__unwrap(erc20Asset, ALICE_UNWRAP_VAL) // unwrap total 9.5
      .__action(erc20.address, encodedFunction)
      .gasPrice(GAS_PRICE)
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .build(); // NOTE: alice spends all 4 notes because its 2.75 unwrapped + 0.25 conf pay + gas

    const bundlerBalanceBefore = (
      await gasToken.balanceOf(await bundlerEoa.getAddress())
    ).toBigInt();
    console.log("bundler gas asset balance before op:", bundlerBalanceBefore);

    const contractChecks = async () => {
      console.log("check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await queryEvents(
        teller,
        teller.filters.OperationProcessed(),
        0,
        latestBlock
      );
      expect(events.length).to.equal(1);
      expect(events[0].args.opProcessed).to.equal(true);
      expect(events[0].args.callSuccesses[0]).to.equal(true);

      expect(
        (await erc20.balanceOf(await aliceEoa.getAddress())).toBigInt()
      ).to.equal(0n);
      expect(
        (await erc20.balanceOf(await bobEoa.getAddress())).toBigInt()
      ).to.equal(ALICE_TO_BOB_PUB_VAL);
      expect((await erc20.balanceOf(teller.address)).toBigInt()).to.equal(
        10n * PER_NOTE_AMOUNT - ALICE_TO_BOB_PUB_VAL
      );
      expect((await erc20.balanceOf(handler.address)).toBigInt()).to.equal(1n);
    };

    const offchainChecks = async () => {
      console.log("alice: Sync SDK post-operation");
      await nocturneClientAlice.sync();
      const updatedNotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc20Asset,
        { includeUncommitted: true }
      )!;
      const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);
      // alice should have 2 nonzero notes total, since all 4 notes spent, alice gets 1 output
      // note from JSs and 1 refund note (all in same token)
      expect(nonZeroNotesAlice.length).to.equal(0);
      console.log("alice post-op notes:", nonZeroNotesAlice);

      // check that bundler got compensated for gas
      const bundlerBalanceAfter = (
        await gasToken.balanceOf(await bundlerEoa.getAddress())
      ).toBigInt();

      console.log("bundler gas asset balance after op:", bundlerBalanceAfter);
      // for some reason, mocha `.gte` doesn't work here
      expect(bundlerBalanceAfter > bundlerBalanceBefore).to.be.true;
    };

    await testE2E({
      opOrOpRequest: opRequestWithMetadata,
      contractChecks,
      offchainChecks,
      expectedResult: {
        type: "success",
        expectedBundlerStatus: OperationStatus.EXECUTED_SUCCESS,
      },
    });
  });

  const COMPLETE_CONF_PAYMENT_AMOUNT = (PER_NOTE_AMOUNT * 2n * 3n) / 4n; // 3/4 of note
  it(`alice deposits one ${PER_NOTE_AMOUNT} token note and confidentially pays Bob ${COMPLETE_CONF_PAYMENT_AMOUNT} without revealing asset`, async () => {
    console.log("deposit funds and commit note commitments");
    await depositFundsMultiToken(
      depositManager,
      [
        [erc20, [PER_NOTE_AMOUNT, PER_NOTE_AMOUNT]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneClientAlice.viewer.generateRandomStealthAddress()
    );
    await fillSubtreeBatch();

    const PAYMENT_AMOUNT = (PER_NOTE_AMOUNT * 2n * 3n) / 4n; // 3/4 of total deposit amount

    const chainId = BigInt((await provider.getNetwork()).chainId);
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .confidentialPayment(
        erc20Asset,
        PAYMENT_AMOUNT, // Spend 3/4 of deposit amount for conf payment
        nocturneClientBob.viewer.canonicalAddress()
      )
      .gasPrice(GAS_PRICE)
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .build();

    const bundlerBalanceBefore = (
      await gasToken.balanceOf(await bundlerEoa.getAddress())
    ).toBigInt();
    console.log("bundler gas asset balance before op:", bundlerBalanceBefore);

    const contractChecks = async () => {
      console.log("check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await queryEvents(
        teller,
        teller.filters.OperationProcessed(),
        0,
        latestBlock
      );
      expect(events.length).to.equal(1);
      expect(events[0].args.opProcessed).to.equal(true);

      // expect all tokens to remain in Teller (only changed ownership within protocol)
      expect((await erc20.balanceOf(teller.address)).toBigInt()).to.equal(
        PER_NOTE_AMOUNT * 2n
      );
      expect((await erc20.balanceOf(handler.address)).toBigInt()).to.equal(1n);
    };

    const offchainChecks = async () => {
      console.log("alice: Sync SDK post-operation");
      await nocturneClientAlice.sync();
      const updatedNotesAlice = await nocturneDBAlice.getNotesForAsset(
        erc20Asset,
        { includeUncommitted: true }
      )!;
      const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);
      // alice should have 1 nonzero note from joinsplit output
      expect(nonZeroNotesAlice.length).to.equal(1);
      console.log("alice post-op notes:", nonZeroNotesAlice);

      // alice should have another note with output note from joinsplit that paid 3/4 to bob
      const foundNotesAlice = nonZeroNotesAlice.filter(
        (n) => n.value === PER_NOTE_AMOUNT * 2n - PAYMENT_AMOUNT
      );
      expect(foundNotesAlice.length).to.equal(1);

      console.log("bob: Sync SDK post-operation");
      await nocturneClientBob.sync();
      const updatedNotesBob = await nocturneDBBob.getNotesForAsset(erc20Asset, {
        includeUncommitted: true,
      })!;
      const nonZeroNotesBob = updatedNotesBob.filter((n) => n.value > 0n);
      // bob should have one nonzero note from conf payment
      expect(nonZeroNotesBob.length).to.equal(1);

      // That one note should contain the tokens sent privately from alice
      expect(nonZeroNotesBob[0].value).to.equal(PAYMENT_AMOUNT);

      // check that bundler got compensated for gas
      const bundlerBalanceAfter = (
        await gasToken.balanceOf(await bundlerEoa.getAddress())
      ).toBigInt();

      console.log("bundler gas asset balance after op:", bundlerBalanceAfter);
      // for some reason, mocha `.gte` doesn't work here
      expect(bundlerBalanceAfter > bundlerBalanceBefore).to.be.true;
    };

    await testE2E({
      opOrOpRequest: opRequestWithMetadata,
      contractChecks,
      offchainChecks,
      expectedResult: {
        type: "success",
        expectedBundlerStatus: OperationStatus.EXECUTED_SUCCESS,
      },
    });
  });

  it("alice transfers 2 ETH to bob via EthTransferAdapter", async () => {
    const TWO_ETH = ethers.utils.parseEther("2").toBigInt(); // 2 ETH

    console.log("deposit funds and commit note commitments");
    await depositFundsMultiToken(
      depositManager,
      [
        [weth, [TWO_ETH]],
        [gasToken, [GAS_FAUCET_DEFAULT_AMOUNT]],
      ],
      aliceEoa,
      nocturneClientAlice.viewer.generateRandomStealthAddress()
    );
    await fillSubtreeBatch();

    const chainId = BigInt((await provider.getNetwork()).chainId);
    const opRequestWithMetadata = await newOpRequestBuilder(
      provider,
      chainId,
      config
    )
      .use(EthTransferAdapterPlugin)
      .transferEth(bobEoa.address, TWO_ETH)
      .deadline(
        BigInt((await provider.getBlock("latest")).timestamp) + ONE_DAY_SECONDS
      )
      .build();

    const bobEoaEthBalanceBefore = (await bobEoa.getBalance()).toBigInt();

    const bundlerBalanceBefore = (
      await gasToken.balanceOf(await bundlerEoa.getAddress())
    ).toBigInt();
    console.log("bundler gas asset balance before op:", bundlerBalanceBefore);

    const contractChecks = async () => {
      console.log("check for OperationProcessed event");
      const latestBlock = await provider.getBlockNumber();
      const events: OperationProcessedEvent[] = await queryEvents(
        teller,
        teller.filters.OperationProcessed(),
        0,
        latestBlock
      );
      expect(events.length).to.equal(1);
      expect(events[0].args.opProcessed).to.equal(true);
      expect(events[0].args.callSuccesses[0]).to.equal(true);
      expect(events[0].args.callSuccesses[1]).to.equal(true);

      // Expect bob to have 2 more ETH and teller to have 0 ETH
      expect((await weth.balanceOf(teller.address)).toBigInt()).to.equal(0n);
      expect((await bobEoa.getBalance()).toBigInt()).to.equal(
        bobEoaEthBalanceBefore + TWO_ETH
      );

      // Ensure gas comp
      expect(
        (await gasToken.balanceOf(teller.address)).toBigInt() <
          GAS_FAUCET_DEFAULT_AMOUNT
      ).to.be.true;
    };

    const offchainChecks = async () => {
      console.log("alice: Sync SDK post-operation");
      await nocturneClientAlice.sync();
      const updatedNotesAlice = await nocturneDBAlice.getNotesForAsset(
        AssetTrait.erc20AddressToAsset(weth.address),
        { includeUncommitted: true }
      )!;
      const nonZeroNotesAlice = updatedNotesAlice.filter((n) => n.value > 0n);

      // alice should have 0 nonzero notes (all weth spent)
      expect(nonZeroNotesAlice.length).to.equal(0);

      // check that bundler got compensated for gas
      const bundlerBalanceAfter = (
        await gasToken.balanceOf(await bundlerEoa.getAddress())
      ).toBigInt();

      console.log("bundler gas asset balance after op:", bundlerBalanceAfter);
      // for some reason, mocha `.gte` doesn't work here
      expect(bundlerBalanceAfter > bundlerBalanceBefore).to.be.true;
    };

    await testE2E({
      opOrOpRequest: opRequestWithMetadata,
      contractChecks,
      offchainChecks,
      expectedResult: {
        type: "success",
        expectedBundlerStatus: OperationStatus.EXECUTED_SUCCESS,
      },
    });
  });
});
