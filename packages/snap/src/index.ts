import {
  NocturneWalletSDK,
  NocturneSigner,
  SparseMerkleProver,
  OperationRequest,
  NocturneDB,
  SubgraphSDKSyncAdapter,
  MockEthToTokenConverter,
} from "@nocturne-xyz/sdk";
import { BabyJubJub } from "@nocturne-xyz/circuit-utils";
import { ethers } from "ethers";
import { getBIP44AddressKeyDeriver } from "@metamask/key-tree";
import { OnRpcRequestHandler } from "@metamask/snaps-types";
import { SnapKvStore } from "./snapdb";
import * as JSON from "bigint-json-serialization";
import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
import { panel, text, heading } from "@metamask/snaps-ui";

const RPC_URL = "http://127.0.0.1:8545/";
const SUBGRAPH_API_URL = "http://127.0.0.1:8000/subgraphs/name/nocturne";

const config = loadNocturneConfigBuiltin("localhost");

const Fr = BabyJubJub.ScalarField;

const NOCTURNE_BIP44_COINTYPE = 6789;

async function getNocturneSignerFromBIP44(): Promise<NocturneSigner> {
  const nocturneNode = await snap.request({
    method: "snap_getBip44Entropy",
    params: {
      coinType: NOCTURNE_BIP44_COINTYPE,
    },
  });
  const addressKeyDeriver = await getBIP44AddressKeyDeriver(
    nocturneNode as any
  );
  const keyNode = await addressKeyDeriver(0);
  const sk = Fr.reduce(BigInt(keyNode.privateKey as string));
  const nocturnePrivKey = new NocturneSigner(sk);
  return nocturnePrivKey;
}

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns `null` if the request succeeded.
 * @throws If the request method is not valid for this snap.
 * @throws If the `snap_dialog` call failed.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  const kvStore = new SnapKvStore();
  const nocturneDB = new NocturneDB(kvStore);
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  const signer = await getNocturneSignerFromBIP44();
  console.log("Snap Nocturne Canonical Address: ", signer.canonicalAddress());

  const merkleProver = await SparseMerkleProver.loadFromKV(kvStore);
  // const syncAdapter = new RPCSyncAdapter(provider, WALLET_ADDRESS);
  const syncAdapter = new SubgraphSDKSyncAdapter(SUBGRAPH_API_URL);
  const sdk = new NocturneWalletSDK(
    signer,
    provider,
    config,
    merkleProver,
    nocturneDB,
    syncAdapter,
    new MockEthToTokenConverter()
  );

  console.log("Switching on method: ", request.method);
  switch (request.method) {
    case "nocturne_getRandomizedAddr":
      return JSON.stringify(signer.generateRandomStealthAddress());
    case "nocturne_getAllBalances":
      await sdk.sync();
      return JSON.stringify(await sdk.getAllAssetBalances());
    case "nocturne_sync":
      try {
        // set `skipMerkle` to true because we're not using the merkle tree during this RPC call
        await sdk.sync();
        console.log(
          "Synced. state is now: ",
          //@ts-ignore
          JSON.stringify(await kvStore.kv())
        );
      } catch (e) {
        console.log("Error syncing notes: ", e);
        throw e;
      }
      return;
    case "nocturne_signOperation":
      console.log("Request params: ", request.params);

      await sdk.sync();

      console.log("done syncing");

      const operationRequest = JSON.parse(
        (request.params as any).operationRequest
      ) as OperationRequest;

      // Ensure user has minimum balance for request
      if (!(await sdk.hasEnoughBalanceForOperationRequest(operationRequest))) {
        throw new Error("Insufficient balance for operation request");
      }

      // Confirm spend sig auth
      const res = await snap.request({
        method: "snap_dialog",
        params: {
          type: "confirmation",
          // TODO: make this UI better
          content: panel([
            heading(
              `${origin} would like to perform an operation via Nocturne`
            ),
            text(`operation request: ${JSON.stringify(operationRequest)}`),
          ]),
        },
      });

      if (!res) {
        throw new Error("rejected by user");
      }

      console.log("Operation request: ", operationRequest);

      // fetch gas price from chain and set it in the operation request if it's not already set
      if (!operationRequest.gasPrice) {
        const gasPrice = await provider.getGasPrice();
        operationRequest.gasPrice = gasPrice.toBigInt();
      }

      console.log("Operation gas price: ", operationRequest.gasPrice);

      try {
        const preSignOp = await sdk.prepareOperation(operationRequest);
        const signedOp = await sdk.signOperation(preSignOp);
        console.log(
          "PreProofOperationInputsAndProofInputs: ",
          JSON.stringify(signedOp)
        );
        return JSON.stringify(signedOp);
      } catch (err) {
        console.log("Error getting pre-proof operation:", err);
        throw err;
      }

    case "nocturne_clearDb":
      await kvStore.clear();
      console.log(
        "Cleared DB, state: ",
        //@ts-ignore
        JSON.stringify(await kvStore.kv())
      );
      return;
    default:
      throw new Error("Method not found.");
  }
};
