import { decomposeCompressedPoint } from "@nocturne-xyz/crypto";
import {
  PreProofJoinSplit,
  SignedOperation,
  ProvenJoinSplit,
  ProvenOperation,
  OperationTrait,
  SubmittableOperationWithNetworkInfo,
  JoinSplitProver,
  joinSplitPublicSignalsFromArray,
  packToSolidityProof,
  iterChunks,
} from "@nocturne-xyz/core";

// SDK will fire off at most this many provers in parallel
const MAX_PARALLEL_PROVERS = 4;

export async function proveOperation(
  prover: JoinSplitProver,
  op: SignedOperation
): Promise<SubmittableOperationWithNetworkInfo> {
  const joinSplits: ProvenJoinSplit[] = [];
  for (const batch of iterChunks(op.joinSplits, MAX_PARALLEL_PROVERS)) {
    const provenBatch = await Promise.all(
      batch.map((joinSplit) => proveJoinSplit(prover, joinSplit))
    );
    joinSplits.push(...provenBatch);
  }

  const operation: ProvenOperation = {
    ...op,
    joinSplits,
  };

  return OperationTrait.toSubmittable(operation);
}

async function proveJoinSplit(
  prover: JoinSplitProver,
  signedJoinSplit: PreProofJoinSplit
): Promise<ProvenJoinSplit> {
  const {
    opDigest,
    proofInputs,
    refundAddr,
    senderCommitment,
    joinSplitInfoCommitment,
    ...baseJoinSplit
  } = signedJoinSplit;
  console.log("proving joinSplit", {
    proofInputs,
    merkleProofA: proofInputs.merkleProofA,
    merkleProofB: proofInputs.merkleProofB,
  });

  const proof = await prover.proveJoinSplit(proofInputs);

  const [, refundAddrH1CompressedY] = decomposeCompressedPoint(refundAddr.h1);
  const [, refundAddrH2CompressedY] = decomposeCompressedPoint(refundAddr.h2);

  // Check that snarkjs output is consistent with our precomputed joinsplit values
  const publicSignals = joinSplitPublicSignalsFromArray(proof.publicSignals);
  if (
    baseJoinSplit.newNoteACommitment !== publicSignals.newNoteACommitment ||
    baseJoinSplit.newNoteBCommitment !== publicSignals.newNoteBCommitment ||
    baseJoinSplit.commitmentTreeRoot !== publicSignals.commitmentTreeRoot ||
    baseJoinSplit.publicSpend !== publicSignals.publicSpend ||
    baseJoinSplit.nullifierA !== publicSignals.nullifierA ||
    baseJoinSplit.nullifierB !== publicSignals.nullifierB ||
    opDigest !== publicSignals.opDigest ||
    refundAddrH1CompressedY !== publicSignals.refundAddrH1CompressedY ||
    refundAddrH2CompressedY !== publicSignals.refundAddrH2CompressedY ||
    senderCommitment !== publicSignals.senderCommitment ||
    joinSplitInfoCommitment !== publicSignals.joinSplitInfoCommitment
  ) {
    console.error("successfully generated proof, but PIs don't match", {
      publicSignalsFromProof: publicSignals,
      publicSignalsExpected: {
        newNoteACommitment: baseJoinSplit.newNoteACommitment,
        newNoteBCommitment: baseJoinSplit.newNoteBCommitment,
        commitmentTreeRoot: baseJoinSplit.commitmentTreeRoot,
        publicSpend: baseJoinSplit.publicSpend,
        nullifierA: baseJoinSplit.nullifierA,
        nullifierB: baseJoinSplit.nullifierB,
        senderCommitment,
        joinSplitInfoCommitment,
        opDigest,
        pubEncododedAssetAddrWithSignBits:
          proofInputs.pubEncodedAssetAddrWithSignBits,
        pubEncodedAssetID: proofInputs.pubEncodedAssetId,
        refundAddrH1CompressedY: refundAddrH1CompressedY,
        refundAddrH2CompressedY: refundAddrH2CompressedY,
      },
    });

    throw new Error(
      `snarkjs generated public input differs from precomputed ones`
    );
  }

  console.log("successfully generated proofs", {
    proofWithPublicSignals: proof,
  });

  const solidityProof = packToSolidityProof(proof.proof);
  return {
    proof: solidityProof,
    senderCommitment,
    joinSplitInfoCommitment,
    ...baseJoinSplit,
  };
}
