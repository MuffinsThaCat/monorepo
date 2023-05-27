import { expect } from "chai";
import { ethers } from "ethers";
import { DepositManager } from "@nocturne-xyz/contracts";
import {
  SDKSyncAdapter,
  SubgraphSDKSyncAdapter,
  NocturneViewer,
  NoteTrait,
  IncludedNote,
  NocturneSigner,
} from "@nocturne-xyz/sdk";
import { sleep } from "../src/utils";
import { setupTestDeployment, SUBGRAPH_URL } from "../src/deploy";
import { depositFundsSingleToken } from "../src/deposit";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

describe("SDKSubgraphSyncAdapter", async () => {
  let teardown: () => Promise<void>;

  let aliceEoa: ethers.Wallet;

  let depositManager: DepositManager;
  let token: SimpleERC20Token;
  let syncAdapter: SDKSyncAdapter;
  let viewer: NocturneViewer;
  let provider: ethers.providers.Provider;

  beforeEach(async () => {
    // only doing deposits, so don't need bundler
    // only querying notes, so don't need subtree updater
    const testDeployment = await setupTestDeployment({
      include: {
        subgraph: true,
        depositScreener: true,
      },
    });

    ({ teardown, aliceEoa, provider, depositManager, provider } =
      testDeployment);

    syncAdapter = new SubgraphSDKSyncAdapter(SUBGRAPH_URL);
    viewer = new NocturneSigner(2n).viewer();

    token = testDeployment.tokens.erc20;
    console.log("Token deployed at: ", token.address);
  });

  afterEach(async () => {
    await teardown();
  });

  it("pulls only data for the given block range", async () => {
    // deposit a bunch of notes
    await depositFundsSingleToken(
      depositManager,
      token,
      aliceEoa,
      viewer.generateRandomStealthAddress(),
      [100n, 100n, 100n]
    );

    const firstRangeEndBlockExpected = await provider.getBlockNumber();
    console.log("firstRangeEndBlockExpected: ", firstRangeEndBlockExpected);
    // wait for subgraph
    await sleep(3_000);

    // check that diffs include 3 notes
    // check that there's no duplicate notes
    // check that endBlock is correct
    const notesFirstRange = new Set();
    let firstRangeEndBlock = 0;
    {
      const diffs = syncAdapter.iterStateDiffs(0, {
        endBlock: firstRangeEndBlockExpected,
      });
      for await (const { notes, blockNumber } of diffs.iter) {
        notes.forEach(({ inner }) => {
          const note = inner;
          expect(NoteTrait.isEncryptedNote(note)).to.be.false;
          const commitment = NoteTrait.toCommitment(note as IncludedNote);

          expect(notesFirstRange.has(commitment)).to.be.false;
          notesFirstRange.add(commitment);
        });
        firstRangeEndBlock = blockNumber;
      }
      expect(firstRangeEndBlock).to.equal(firstRangeEndBlockExpected);
      expect(notesFirstRange.size).to.equal(3);
    }

    // deposit more notes
    await depositFundsSingleToken(
      depositManager,
      token,
      aliceEoa,
      viewer.generateRandomStealthAddress(),
      [200n, 200n, 200n, 200n]
    );

    const secondRangeEndBlockExpected = await provider.getBlockNumber();
    console.log("firstRangeEndBlockExpected: ", firstRangeEndBlockExpected);
    // wait for subgraph
    await sleep(3_000);

    // check that diffs include 4 notes
    // check that there's no duplicate notes
    // check that none of the notes were in the previous range
    // check the `blockNumber` of every diff > firstRangeEndBlock
    // check that endBlock is correct
    const notesSecondRange = new Set();
    let secondRangeEndBlock = 0;
    {
      const diffs = syncAdapter.iterStateDiffs(firstRangeEndBlock, {
        endBlock: secondRangeEndBlockExpected,
      });
      for await (const { notes, blockNumber } of diffs.iter) {
        notes.forEach(({ inner }) => {
          const note = inner;
          expect(NoteTrait.isEncryptedNote(note)).to.be.false;
          const commitment = NoteTrait.toCommitment(note as IncludedNote);

          expect(notesSecondRange.has(commitment)).to.be.false;
          expect(notesFirstRange.has(commitment)).to.be.false;
          notesSecondRange.add(commitment);
        });

        expect(blockNumber).to.be.greaterThan(firstRangeEndBlock);
        secondRangeEndBlock = blockNumber;
      }
      expect(secondRangeEndBlock).to.equal(secondRangeEndBlockExpected);
      expect(notesSecondRange.size).to.equal(4);
    }
  });
});
