// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IWallet.sol";
import "./interfaces/IVerifier.sol";
import "./BatchBinaryMerkleTree.sol";

import {IPoseidonT6} from "./interfaces/IPoseidon.sol";

contract CommitmentTreeManager {
    using BatchBinaryMerkleTree for IncrementalTreeData;

    IncrementalTreeData public noteCommitmentTree;
    mapping(uint256 => bool) public pastRoots;
    mapping(uint256 => bool) public nullifierSet;
    uint256 public nonce;

    IVerifier public verifier;
    IPoseidonT6 poseidonT6;

    constructor(
        address _verifier,
        address _poseidonT3,
        address _poseidonT6
    ) {
        verifier = IVerifier(_verifier);
        noteCommitmentTree.init(32, 0, _poseidonT3);
        poseidonT6 = IPoseidonT6(_poseidonT6);
    }

    function commit8FromQueue() external {
        noteCommitmentTree.commit8FromQueue();
        pastRoots[noteCommitmentTree.root] = true;
    }

    function getRoot() external view returns (uint256) {
        return noteCommitmentTree.root;
    }

    // TODO: add default noteCommitment for when there is no output note.
    function _handleSpend(
        IWallet.SpendTransaction calldata spendTx,
        bytes32 operationHash
    ) internal {
        require(
            pastRoots[spendTx.commitmentTreeRoot],
            "Given tree root not a past root"
        );
        require(!nullifierSet[spendTx.nullifier], "Nullifier already used");

        bytes32 spendHash = _hashSpend(spendTx);
        uint256 operationDigest = uint256(
            keccak256(abi.encodePacked(operationHash, spendHash))
        );

        require(
            verifier.verifyActionProof(
                [spendTx.proof[0], spendTx.proof[1]],
                [
                    [spendTx.proof[2], spendTx.proof[3]],
                    [spendTx.proof[4], spendTx.proof[5]]
                ],
                [spendTx.proof[6], spendTx.proof[7]],
                [
                    spendTx.noteCommitment,
                    spendTx.nullifier,
                    uint256(uint160(spendTx.asset)),
                    spendTx.value,
                    spendTx.commitmentTreeRoot,
                    spendTx.id,
                    operationDigest
                ]
            ),
            "Spend proof invalid"
        );

        noteCommitmentTree.insertLeafToQueue(spendTx.noteCommitment);

        nullifierSet[spendTx.nullifier] = true;
    }

    function _handleRefund(
        uint256 refundAddrHash,
        address asset,
        uint256 id,
        uint256 value
    ) internal {
        uint256 noteCommitment = poseidonT6.poseidon(
            [refundAddrHash, nonce, uint256(uint160(asset)), id, value]
        );

        nonce++;

        noteCommitmentTree.insertLeafToQueue(noteCommitment);
    }

    function _hashSpend(IWallet.SpendTransaction calldata spend)
        private
        pure
        returns (bytes32)
    {
        bytes memory payload = abi.encodePacked(
            spend.commitmentTreeRoot,
            spend.nullifier,
            spend.noteCommitment,
            spend.value,
            spend.asset,
            spend.id
        );

        return keccak256(payload);
    }
}
