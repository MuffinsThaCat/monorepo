import {
  CanonAddress,
  CompressedStealthAddress,
  SerializedHybridCiphertext,
} from "@nocturne-xyz/crypto";
import { JoinSplitInputs, MerkleProofInput, SolidityProof } from "../proof";
import { IncludedNote, Note } from "./note";
import { EncodedAsset } from "./asset";
import { CompressedPoint } from "@nocturne-xyz/crypto/dist/src/pointCompression";

export const BN254_SCALAR_FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const SENDER_COMMITMENT_DOMAIN_SEPARATOR =
  5680996188676417870015190585682285899130949254168256752199352013418366665222n;

export type Address = string;

export type Nullifier = bigint;

export interface Action {
  contractAddress: Address;
  encodedFunction: string;
}

export interface Deposit {
  spender: Address;
  asset: Address;
  value: bigint;
  id: bigint;
  depositAddr: CompressedStealthAddress;
}

export interface OperationResult {
  opProcessed: boolean;
  failureReason: string;
  callSuccesses: boolean[];
  callResults: string[];
  verificationGas: bigint;
  executionGas: bigint;
  numRefunds: bigint;
}

export type EncryptedNote = SerializedHybridCiphertext;

export interface IncludedEncryptedNote extends EncryptedNote {
  merkleIndex: number;
  commitment: bigint;
}

export interface JoinSplitInfo {
  compressedSenderCanonAddr: CompressedPoint;
  compressedReceiverCanonAddr: CompressedPoint;
  oldMerkleIndicesWithSignBits: bigint;
  newNoteValueA: bigint;
  newNoteValueB: bigint;
  nonce: bigint;
}

export interface BaseJoinSplit {
  commitmentTreeRoot: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  newNoteACommitment: bigint;
  newNoteBCommitment: bigint;
  senderCommitment: bigint;
  joinSplitInfoCommitment: bigint;
  encodedAsset: EncodedAsset;
  publicSpend: bigint;
  newNoteAEncrypted: EncryptedNote;
  newNoteBEncrypted: EncryptedNote;
}

export interface PreSignJoinSplit extends BaseJoinSplit {
  receiver: CanonAddress;
  oldNoteA: IncludedNote;
  oldNoteB: IncludedNote;
  newNoteA: Note;
  newNoteB: Note;
  merkleProofA: MerkleProofInput;
  merkleProofB: MerkleProofInput;
  refundAddr: CompressedStealthAddress;
}

export interface PreProofJoinSplit extends BaseJoinSplit {
  opDigest: bigint;
  proofInputs: JoinSplitInputs;
  refundAddr: CompressedStealthAddress;
}

export interface ProvenJoinSplit extends BaseJoinSplit {
  proof: SolidityProof;
}

export type SignableJoinSplit = Omit<
  BaseJoinSplit,
  "encodedAsset" | "publicSpend"
>;

export interface SignablePublicJoinSplit {
  joinSplit: SignableJoinSplit;
  assetIndex: number;
  publicSpend: bigint;
}

export interface SubmittableJoinSplit extends SignableJoinSplit {
  proof: SolidityProof;
}

export interface SubmittablePublicJoinSplit
  extends Omit<SignablePublicJoinSplit, "joinSplit"> {
  joinSplit: SubmittableJoinSplit;
}

export interface NetworkInfo {
  chainId: bigint;
  tellerContract: Address;
}

export interface TrackedAsset {
  encodedAsset: EncodedAsset;
  minRefundValue: bigint;
}

export type ExpectedRefund = TrackedAsset;

export interface BaseOperation {
  networkInfo: NetworkInfo;
  refundAddr: CompressedStealthAddress;
  refunds: ExpectedRefund[];
  actions: Action[];
  encodedGasAsset: EncodedAsset;
  gasAssetRefundThreshold: bigint;
  executionGasLimit: bigint;
  gasPrice: bigint;
  deadline: bigint;
  atomicActions: boolean;
}

export interface PreSignOperation extends BaseOperation {
  joinSplits: PreSignJoinSplit[];

  // gas fee estimate for the operation denominated in `encodedGasAsset`
  // this is passed along to the snap so the user can see how much gas
  // they will front for the operation
  gasFeeEstimate: bigint;
}

export interface SignedOperation extends BaseOperation {
  joinSplits: PreProofJoinSplit[];
}

export interface ProvenOperation extends BaseOperation {
  joinSplits: ProvenJoinSplit[];
}

export interface SignableOperationWithNetworkInfo
  extends Omit<BaseOperation, "encodedRefundAssets" | "refunds"> {
  pubJoinSplits: SignablePublicJoinSplit[];
  confJoinSplits: SignableJoinSplit[];
  trackedAssets: TrackedAsset[];
}

export interface SubmittableOperationWithNetworkInfo
  extends Omit<SignableOperationWithNetworkInfo, "joinSplits"> {
  pubJoinSplits: SubmittablePublicJoinSplit[];
  confJoinSplits: SubmittableJoinSplit[];
}

export interface Bundle {
  operations: SubmittableOperationWithNetworkInfo[];
}

export type Operation = PreSignOperation | SignedOperation | ProvenOperation;

export interface DepositRequest {
  spender: string;
  encodedAsset: EncodedAsset;
  value: bigint;
  depositAddr: CompressedStealthAddress;
  nonce: bigint;
  gasCompensation: bigint;
}

export enum OperationStatus {
  QUEUED = "QUEUED",
  PRE_BATCH = "PRE_BATCH",
  IN_BATCH = "IN_BATCH",
  IN_FLIGHT = "IN_FLIGHT",
  EXECUTED_SUCCESS = "EXECUTED_SUCCESS",
  OPERATION_VALIDATION_FAILED = "OPERATION_VALIDATION_FAILED",
  OPERATION_PROCESSING_FAILED = "OPERATION_PROCESSING_FAILED",
  OPERATION_EXECUTION_FAILED = "OPERATION_EXECUTION_FAILED",
  BUNDLE_REVERTED = "BUNDLE_REVERTED",
}

export enum DepositRequestStatus {
  DoesNotExist = "DoesNotExist",
  FailedScreen = "FailedScreen",
  PassedFirstScreen = "PassedFirstScreen",
  AwaitingFulfillment = "AwaitingFulfillment",
  Completed = "Completed",
}

export interface WithTimestamp<T> {
  inner: T;
  timestampUnixMillis: number;
}

export interface CanonAddrRegistryEntry {
  ethAddress: Address;
  compressedCanonAddr: bigint;
  perCanonAddrNonce: bigint;
}
