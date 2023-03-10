import { Wallet } from "@nocturne-xyz/contracts";
import { StealthAddress } from "./crypto";
import { NocturneDB } from "./NocturneDB";
import {
  GasAccountedOperationRequest,
  JoinSplitRequest,
  OperationRequest,
} from "./operationRequest";
import {
  Operation,
  ProvenOperation,
  OperationResult,
  Asset,
  PreSignOperation,
  BLOCK_GAS_LIMIT,
  AssetType,
} from "./primitives";
import { ERC20_ID } from "./primitives/asset";
import { SolidityProof } from "./proof";
import { OpPreparer } from "./opPreparer";
import { groupByMap } from "./utils/functional";

const DUMMY_REFUND_ADDR: StealthAddress = {
  h1X: 0n,
  h1Y: 0n,
  h2X: 0n,
  h2Y: 0n,
};

const DUMMY_GAS_ASSET: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: "0x0000000000000000000000000000000000000000",
  id: ERC20_ID,
};

const PER_JOINSPLIT_GAS = 170_000n;
const PER_REFUND_GAS = 80_000n;

export interface HandleOpRequestGasDeps {
  db: NocturneDB;
  walletContract: Wallet;
  gasAssets: Asset[];

  // NOTE: this will be removed in the next PR
  opPreparer: OpPreparer;
}

interface GasEstimatedOperationRequest
  extends Omit<
    OperationRequest,
    "executionGasLimit" | "maxNumRefunds" | "gasPrice"
  > {
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
  gasPrice: bigint;
}

interface GasParams {
  gasPrice: bigint;
  executionGasLimit: bigint;
  maxNumRefunds: bigint;
}

export async function handleGasForOperationRequest(
  { walletContract, opPreparer, db, gasAssets }: HandleOpRequestGasDeps,
  opRequest: OperationRequest
): Promise<GasAccountedOperationRequest> {
  // estimate gas params for opRequest
  const { gasPrice, executionGasLimit, maxNumRefunds } =
    await estimateGasForOperationRequest(walletContract, opPreparer, opRequest);

  const gasEstimatedOpRequest: GasEstimatedOperationRequest = {
    ...opRequest,
    executionGasLimit,
    maxNumRefunds,
    gasPrice,
  };

  if (opRequest?.gasPrice == 0n) {
    // If gasPrice = 0, override dummy gas asset and don't further modify opRequest
    return {
      ...gasEstimatedOpRequest,
      gasPrice: 0n,
      gasAsset: DUMMY_GAS_ASSET,
    };
  } else {
    // Otherwise, we need to add gas compensation to the operation request

    // compute an estimate of the total amount of gas the op will cost given the gas params
    const totalGasEstimate =
      gasPrice *
      (executionGasLimit +
        BigInt(gasEstimatedOpRequest.joinSplitRequests.length) *
          PER_JOINSPLIT_GAS +
        BigInt(maxNumRefunds) * PER_REFUND_GAS);

    // attempt to update the joinSplitRequests with gas compensation
    // gasAsset will be `undefined` if the user's too broke to pay for gas
    const [joinSplitRequests, gasAsset] =
      await tryUpdateJoinSplitRequestsForGasEstimate(
        gasAssets,
        db,
        gasEstimatedOpRequest.joinSplitRequests,
        totalGasEstimate
      );

    if (!gasAsset) {
      throw new Error("Not enough owned gas tokens pay for op");
    }

    return {
      ...gasEstimatedOpRequest,
      joinSplitRequests,
      gasAsset,
    };
  }
}

// update the joinSplitRequests to include any additional gas compensation, if needed
// returns the updated JoinSplitRequests and the gas asset used to pay for gas if the user can afford gas
// if the user can't afford gas, returns an empty array and undefined.
async function tryUpdateJoinSplitRequestsForGasEstimate(
  gasAssets: Asset[],
  db: NocturneDB,
  joinSplitRequests: JoinSplitRequest[],
  gasEstimate: bigint
): Promise<[JoinSplitRequest[], Asset | undefined]> {
  // group joinSplitRequests by asset address
  const joinSplitRequestsByAsset = groupByMap(
    joinSplitRequests,
    (request) => request.asset.assetAddr
  );

  // attempt to modify an existing joinsplit request to include additional gas comp
  // iterate through each gas asset
  for (const gasAsset of gasAssets) {
    // for each, check if we're already unwrapping that asset in at least one joinsplit request
    const matchingRequests = joinSplitRequestsByAsset.get(gasAsset.assetAddr);

    // if we are, check if the user has enough of it to cover gas
    // TODO: is it possible to have empty array here?
    if (matchingRequests && matchingRequests.length > 0) {
      const totalOwnedGasAsset = await db.getBalanceForAsset(gasAsset);
      const totalAmountInMatchingRequests = matchingRequests.reduce(
        (acc, request) => {
          return acc + request.unwrapValue;
        },
        0n
      );

      // if they do, modify one of the requests to include the gas, and we're done
      if (totalOwnedGasAsset >= gasEstimate + totalAmountInMatchingRequests) {
        matchingRequests[0].unwrapValue += gasEstimate;
        joinSplitRequestsByAsset.set(gasAsset.assetAddr, matchingRequests);

        return [Array.from(joinSplitRequestsByAsset.values()).flat(), gasAsset];
      }
    }
  }

  // if we couldn't find an existing joinsplit with a supported gas asset,
  // attempt to make a new joinsplit request to include the gas comp
  // iterate through each gas asset
  for (const gasAsset of gasAssets.values()) {
    // for each, check if the user has enough of it to cover gas
    const totalOwnedGasAsset = await db.getBalanceForAsset(gasAsset);

    // if they do, create a new joinsplit request to include the gas, add it to the list, and we're done
    if (totalOwnedGasAsset >= gasEstimate) {
      const modifiedJoinSplitRequests = [
        ...joinSplitRequests,
        { asset: gasAsset, unwrapValue: gasEstimate },
      ];

      return [modifiedJoinSplitRequests, gasAsset];
    }
  }

  // if we get here, the user can't afford the gas
  return [[], undefined];
}

// estimate gas params for opRequest
async function estimateGasForOperationRequest(
  walletContract: Wallet,
  opPreparer: OpPreparer,
  opRequest: OperationRequest
): Promise<GasParams> {
  let { executionGasLimit, maxNumRefunds, gasPrice } = opRequest;

  // if either `executionGasLimit` or `maxNumRefunds` is not provided, we need to simulate
  if (!executionGasLimit || !maxNumRefunds) {
    // make a operation request with dummy gas params and refund addr for simulation purposes
    const { joinSplitRequests, refundAssets } = opRequest;
    const dummyOpRequest: GasAccountedOperationRequest = {
      ...opRequest,
      maxNumRefunds:
        maxNumRefunds ??
        BigInt(joinSplitRequests.length + refundAssets.length) + 5n,
      executionGasLimit: BLOCK_GAS_LIMIT,
      refundAddr: DUMMY_REFUND_ADDR,
      // Use 0 gas price and dummy asset for simulation
      gasPrice: 0n,
      gasAsset: DUMMY_GAS_ASSET,
    };

    // prepare the request into an operation
    const simulationOp = await opPreparer.prepareOperation(dummyOpRequest);

    // simulate the operation
    const result = await simulateOperation(
      walletContract,
      simulationOp as PreSignOperation
    );
    if (!result.opProcessed) {
      throw Error("Cannot estimate gas with Error: " + result.failureReason);
    }

    // set executionGasLimit with 20% buffer above the simulation result
    executionGasLimit = (result.executionGas * 12n) / 10n;

    // set maxNumRefunds to the number of refunds from simulation result
    maxNumRefunds = result.numRefunds;
  }

  // if gasPrice is not specified, get it from RPC node
  // TODO - add conversion logic to set gasPrice if gasAsset isn't ETH
  gasPrice =
    gasPrice ?? (await walletContract.provider.getGasPrice()).toBigInt();

  return {
    executionGasLimit,
    maxNumRefunds,
    gasPrice,
  };
}

async function simulateOperation(
  walletContract: Wallet,
  op: Operation
): Promise<OperationResult> {
  // We need to do staticCall, which fails if wallet is connected to a signer
  // https://github.com/ethers-io/ethers.js/discussions/3327#discussioncomment-3539505
  // Switching to a regular provider underlying the signer
  if (walletContract.signer) {
    walletContract = walletContract.connect(walletContract.provider);
  }

  // Fill-in the some fake proof
  const provenOp = fakeProvenOperation(op);

  // Set gasPrice to 0 so that gas payment does not interfere with amount of
  // assets unwrapped pre gas estimation
  // ?: does this actually do anything if it's after `fakeProvenOperation` dummy provenOp?
  op.gasPrice = 0n;

  // Set dummy parameters which should not affect operation simulation
  const verificationGasForOp = 0n;
  const bundler = walletContract.address;

  const result = await walletContract.callStatic.processOperation(
    provenOp,
    verificationGasForOp,
    bundler,
    {
      from: walletContract.address,
    }
  );
  const {
    opProcessed,
    failureReason,
    callSuccesses,
    callResults,
    verificationGas,
    executionGas,
    numRefunds,
  } = result;

  return {
    opProcessed,
    failureReason,
    callSuccesses,
    callResults,
    verificationGas: verificationGas.toBigInt(),
    executionGas: executionGas.toBigInt(),
    numRefunds: numRefunds.toBigInt(),
  };
}

function fakeProvenOperation(op: Operation): ProvenOperation {
  const provenJoinSplits = op.joinSplits.map((joinSplit) => {
    return {
      commitmentTreeRoot: joinSplit.commitmentTreeRoot,
      nullifierA: joinSplit.nullifierA,
      nullifierB: joinSplit.nullifierB,
      newNoteACommitment: joinSplit.newNoteACommitment,
      newNoteBCommitment: joinSplit.newNoteBCommitment,
      encodedAsset: joinSplit.encodedAsset,
      publicSpend: joinSplit.publicSpend,
      newNoteAEncrypted: joinSplit.newNoteAEncrypted,
      newNoteBEncrypted: joinSplit.newNoteBEncrypted,
      proof: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as SolidityProof,
    };
  });
  return {
    refundAddr: op.refundAddr,
    encodedRefundAssets: op.encodedRefundAssets,
    actions: op.actions,
    encodedGasAsset: op.encodedGasAsset,
    executionGasLimit: op.executionGasLimit,
    maxNumRefunds: op.maxNumRefunds,
    gasPrice: op.gasPrice,
    joinSplits: provenJoinSplits,
  };
}