import { BinaryPoseidonTree } from "../src/primitives/BinaryPoseidonTree";
import { FlaxPrivKey, FlaxSigner } from "../src/crypto/crypto";
import {
  proveSpend2,
  verifySpend2Proof,
  MerkleProofInput,
  NoteInput,
  FlaxAddressInput,
  Spend2Inputs,
} from "../src/proof/spend2";
import { poseidon } from "circomlibjs";

const vk = BigInt(
  "0x28156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);
const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);

// Instantiate flax keypair and addr
const flaxPrivKey = new FlaxPrivKey(vk, sk);
const flaxSigner = new FlaxSigner(flaxPrivKey);
const flaxAddr = flaxSigner.address;

const flaxAddrInput: FlaxAddressInput = {
  h1X: flaxAddr.H1[0],
  h1Y: flaxAddr.H1[1],
  h2X: flaxAddr.H2[0],
  h2Y: flaxAddr.H2[1],
  h3X: flaxAddr.H3[0],
  h3Y: flaxAddr.H3[1],
};

// Old note input to spend
const oldNote: NoteInput = {
  owner: flaxAddrInput,
  nonce: 1n,
  type: 10n,
  value: 100n,
  id: 5n,
};
console.log(oldNote);

// H(H(owner), type, id, value)
const ownerHash = poseidon([flaxAddr.H1[0], flaxAddr.H2[0], flaxAddr.H1[0]]);
const oldNoteCommitment = poseidon([
  ownerHash,
  oldNote.type,
  oldNote.id,
  oldNote.value,
]);

// Generate valid merkle proof
const tree = new BinaryPoseidonTree();
tree.insert(oldNoteCommitment);
const merkleProof = tree.createProof(tree.count - 1);
const merkleProofInput: MerkleProofInput = {
  path: merkleProof.pathIndices.map((n) => BigInt(n)),
  siblings: merkleProof.siblings,
};
console.log(merkleProofInput);

// New note resulting from spend of 50 units
const newNote: NoteInput = {
  owner: flaxAddrInput,
  nonce: 2n,
  type: 10n,
  value: 50n,
  id: 5n,
};
console.log(newNote);

// Sign operation hash
const operationDigest = BigInt(12345);
const opSig = flaxSigner.sign(operationDigest);
console.log(opSig);

const spend2Inputs: Spend2Inputs = {
  vk,
  operationDigest,
  c: opSig.c,
  z: opSig.z,
  oldNote,
  newNote,
  merkleProof: merkleProofInput,
};
console.log(spend2Inputs);

(async () => {
  const proof = await proveSpend2(spend2Inputs);
  if (!(await verifySpend2Proof(proof))) {
    throw new Error("Proof invalid!");
  }
  console.log(proof);
})();
