import {
  SignedOperation,
  PreSignOperation,
  AssetWithBalance,
} from "./primitives";
import { NocturneSigner } from "./crypto";
import { handleGasForOperationRequest } from "./opRequestGas";
import { MerkleProver } from "./merkleProver";
import { prepareOperation } from "./prepareOperation";
import { OperationRequest } from "./operationRequest";
import { NocturneDB } from "./NocturneDB";
import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { signOperation } from "./signOperation";
import { loadNocturneConfig, NocturneConfig } from "@nocturne-xyz/config";
import { Asset, AssetTrait } from "./primitives/asset";
import { SyncAdapter } from "./sync";
import { syncSDK } from "./syncSDK";
import { getJoinSplitRequestTotalValue } from "./utils";

export class NocturneWalletSDK {
  protected walletContract: Wallet;
  protected merkleProver: MerkleProver;
  protected db: NocturneDB;
  protected syncAdapter: SyncAdapter;

  readonly signer: NocturneSigner;
  readonly gasAssets: Asset[];

  constructor(
    signer: NocturneSigner,
    provider: ethers.providers.Provider,
    configOrNetworkName: NocturneConfig | string,
    merkleProver: MerkleProver,
    db: NocturneDB,
    syncAdapter: SyncAdapter
  ) {
    let config: NocturneConfig;
    if (typeof configOrNetworkName == "string") {
      config = loadNocturneConfig(configOrNetworkName);
    } else {
      config = configOrNetworkName;
    }

    this.gasAssets = Array.from(config.gasAssets.values()).map((address) =>
      AssetTrait.erc20AddressToAsset(address)
    );

    this.signer = signer;
    this.walletContract = Wallet__factory.connect(
      config.walletAddress(),
      provider
    );
    this.merkleProver = merkleProver;
    this.db = db;
    this.syncAdapter = syncAdapter;
  }

  async sync(): Promise<void> {
    const deps = {
      provider: this.walletContract.provider,
      viewer: this.signer,
    };
    await syncSDK(deps, this.syncAdapter, this.db, this.merkleProver);
  }

  async prepareOperation(
    opRequest: OperationRequest
  ): Promise<PreSignOperation> {
    const deps = {
      db: this.db,
      gasAssets: this.gasAssets,
      walletContract: this.walletContract,
      merkle: this.merkleProver,
      viewer: this.signer,
    };

    const gasAccountedOpRequest = await handleGasForOperationRequest(
      deps,
      opRequest
    );
    return await prepareOperation(deps, gasAccountedOpRequest);
  }

  signOperation(preSignOperation: PreSignOperation): SignedOperation {
    return signOperation(this.signer, preSignOperation);
  }

  async getAllAssetBalances(): Promise<AssetWithBalance[]> {
    const notes = await this.db.getAllNotes();
    return Array.from(notes.entries()).map(([assetString, notes]) => {
      const asset = NocturneDB.parseAssetKey(assetString);
      const balance = notes.reduce((a, b) => a + b.value, 0n);
      return {
        asset,
        balance,
      };
    });
  }

  async hasEnoughBalanceForOperationRequest(
    opRequest: OperationRequest
  ): Promise<boolean> {
    for (const joinSplitRequest of opRequest.joinSplitRequests) {
      const requestedAmount = getJoinSplitRequestTotalValue(joinSplitRequest);
      // check that the user has enough notes to cover the request
      const notes = await this.db.getNotesForAsset(joinSplitRequest.asset);
      const balance = notes.reduce((acc, note) => acc + note.value, 0n);
      if (balance < requestedAmount) {
        return false;
      }
    }

    return true;
  }
}