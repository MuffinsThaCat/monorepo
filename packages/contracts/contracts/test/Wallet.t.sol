// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {IJoinSplitVerifier} from "../interfaces/IJoinSplitVerifier.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "../libs/OffchainMerkleTree.sol";
import {PoseidonHasherT3, PoseidonHasherT4, PoseidonHasherT5, PoseidonHasherT6} from "../PoseidonHashers.sol";
import {IHasherT3, IHasherT5, IHasherT6} from "../interfaces/IHasher.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {IPoseidonT3} from "../interfaces/IPoseidon.sol";
import {TestJoinSplitVerifier} from "./harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./harnesses/TestSubtreeUpdateVerifier.sol";
import {ReentrantCaller} from "./utils/ReentrantCaller.sol";
import {TokenSwapper, SwapRequest} from "./utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "./utils/TreeTest.sol";
import "./utils/NocturneUtils.sol";
import "./utils/ForgeUtils.sol";
import {Vault} from "../Vault.sol";
import {Wallet} from "../Wallet.sol";
import {CommitmentTreeManager} from "../CommitmentTreeManager.sol";
import {ParseUtils} from "./utils/ParseUtils.sol";
import {SimpleERC20Token} from "./tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "./tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "./tokens/SimpleERC1155Token.sol";
import {Utils} from "../libs/Utils.sol";
import {AssetUtils} from "../libs/AssetUtils.sol";
import "../libs/Types.sol";

contract WalletTest is Test, ParseUtils, ForgeUtils, PoseidonDeployer {
    using OffchainMerkleTree for OffchainMerkleTreeData;
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    using stdJson for string;
    using TreeTestLib for TreeTest;

    uint256 constant DEFAULT_GAS_LIMIT = 500_000;
    uint256 constant ERC20_ID = 0;

    address constant ALICE = address(1);
    address constant BOB = address(2);
    uint256 constant PER_NOTE_AMOUNT = uint256(50_000_000);

    Wallet wallet;
    Vault vault;
    TreeTest treeTest;
    IJoinSplitVerifier joinSplitVerifier;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    SimpleERC1155Token[3] ERC1155s;
    IHasherT3 hasherT3;
    IHasherT6 hasherT6;

    event RefundProcessed(
        StealthAddress refundAddr,
        uint256 nonce,
        uint256 encodedAssetAddr,
        uint256 encodedAssetId,
        uint256 value,
        uint128 merkleIndex
    );

    event JoinSplitProcessed(
        uint256 indexed oldNoteANullifier,
        uint256 indexed oldNoteBNullifier,
        uint128 newNoteAIndex,
        uint128 newNoteBIndex,
        JoinSplit joinSplit
    );

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        deployPoseidon3Through6();

        // Instantiate vault, joinSplitVerifier, tree, and wallet
        vault = new Vault();
        joinSplitVerifier = new TestJoinSplitVerifier();

        subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        wallet = new Wallet();
        wallet.initialize(
            address(vault),
            address(joinSplitVerifier),
            address(subtreeUpdateVerifier)
        );

        hasherT3 = IHasherT3(new PoseidonHasherT3(poseidonT3));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonT6));

        treeTest.initialize(hasherT3, hasherT6);

        vault.initialize(address(wallet));

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
            ERC1155s[i] = new SimpleERC1155Token();
        }
    }

    function depositFunds(
        address _spender,
        address _asset,
        uint256 _value,
        uint256 _id,
        StealthAddress memory _depositAddr
    ) public {
        wallet.depositFunds(
            Deposit({
                spender: _spender,
                encodedAssetAddr: uint256(uint160(_asset)),
                encodedAssetId: _id,
                value: _value,
                depositAddr: _depositAddr
            })
        );
    }

    function reserveAndDepositFunds(
        address recipient,
        SimpleERC20Token token,
        uint256 amount
    ) internal {
        token.reserveTokens(recipient, amount);

        vm.prank(recipient);
        token.approve(address(vault), amount);

        uint256[] memory batch = new uint256[](16);

        uint256 remainder = amount % PER_NOTE_AMOUNT;
        uint256 depositIterations = remainder == 0
            ? amount / PER_NOTE_AMOUNT
            : amount / PER_NOTE_AMOUNT + 1;

        // Deposit funds to vault
        for (uint256 i = 0; i < depositIterations; i++) {
            StealthAddress memory addr = NocturneUtils.defaultStealthAddress();
            vm.expectEmit(true, true, true, true);
            emit RefundProcessed(
                addr,
                i,
                uint256(uint160(address(token))),
                ERC20_ID,
                PER_NOTE_AMOUNT,
                uint128(i)
            );

            vm.prank(recipient);
            if (i == depositIterations - 1 && remainder != 0) {
                depositFunds(
                    recipient,
                    address(token),
                    remainder,
                    ERC20_ID,
                    addr
                );
            } else {
                depositFunds(
                    recipient,
                    address(token),
                    PER_NOTE_AMOUNT,
                    ERC20_ID,
                    addr
                );
            }

            EncodedNote memory note = EncodedNote(
                addr.h1X,
                addr.h2X,
                i,
                uint256(uint160(address(token))),
                ERC20_ID,
                100
            );
            uint256 noteCommitment = treeTest.computeNoteCommitment(note);

            batch[i] = noteCommitment;
        }

        uint256[] memory path = treeTest.computeInitialRoot(batch);
        uint256 root = path[path.length - 1];

        // fill the tree batch
        wallet.fillBatchWithZeros();

        wallet.applySubtreeUpdate(root, NocturneUtils.dummyProof());
    }

    function testDepositNotMsgSender() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, PER_NOTE_AMOUNT);
        vm.prank(ALICE);
        token.approve(address(vault), PER_NOTE_AMOUNT);

        vm.prank(BOB); // msg.sender made to BOB not ALICE, causing error
        vm.expectRevert("Spender must be the sender");
        depositFunds(
            ALICE,
            address(token),
            PER_NOTE_AMOUNT,
            ERC20_ID,
            NocturneUtils.defaultStealthAddress()
        );
    }

    function testProcessBundleTransferSingleJoinSplit() public {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation to transfer 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: true,
                failureReason: ""
            })
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = true, call[0] succeeded
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Expect BOB to have the 50M sent by alice
        // Expect vault to have alice's remaining 50M
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(PER_NOTE_AMOUNT));
    }

    function testProcessBundleTransferThreeJoinSplit() public {
        // Alice starts with 3 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 3 * PER_NOTE_AMOUNT);

        // Create operation to transfer 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 3,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 3,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(3 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: true,
                failureReason: ""
            })
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = true, call[0] succeeded
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Expect BOB to have the 50M sent by alice
        // Expect vault to have alice's remaining 100M
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(PER_NOTE_AMOUNT));
    }

    function testProcessBundleTransferSixJoinSplit() public {
        // Alice starts with 6 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 6 * PER_NOTE_AMOUNT);

        // Create operation to transfer 4 * 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 6,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 6,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    4 * PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(6 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: true,
                failureReason: ""
            })
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = true, call[0] succeeded
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Expect BOB to have the 200M sent by alice
        // Expect vault to have alice's remaining 100M
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(4 * PER_NOTE_AMOUNT));
    }

    function testProcessBundleFailureBadRoot() public {
        // Alice starts with 2 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with faulty root, will cause revert in
        // handleJoinSplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: 1 * PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.BAD_ROOT
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: false,
                failureReason: "Tree root not past root"
            })
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].failureReason, "Tree root not past root");

        // No tokens are lost from vault because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    function testProcessBundleFailureAlreadyUsedNullifier() public {
        // Alice starts with 2 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with two joinsplits where 1st uses NF included in
        // 2nd joinsplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NF_ALREADY_IN_SET
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: false,
                failureReason: "Nullifier B already used"
            })
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].failureReason, "Nullifier B already used");

        // No tokens are lost from vault because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    function testProcessBundleFailureMatchingNullifiers() public {
        // Alice starts with 2 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with one of the joinsplits has matching NFs A and B
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.JOINSPLIT_NFS_SAME
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: false,
                failureReason: "2 nfs should !equal"
            })
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].failureReason, "2 nfs should !equal");

        // No tokens are lost from vault because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    function testProcessBundleFailureReentrancyIntoProcessBundle() public {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        ReentrantCaller reentrantCaller = new ReentrantCaller(
            wallet,
            ERC20s[0]
        );

        // Encode action that calls reentrant contract
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(reentrantCaller),
            encodedFunction: abi.encodeWithSelector(
                reentrantCaller.reentrantProcessBundle.selector
            )
        });

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: actions,
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // op processed = true, as internal revert happened in action
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: true,
                failureReason: ""
            })
        );

        // Op was processed but call result has reentry failure message
        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = true, call[0] failed
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "ReentrancyGuard: reentrant call"
            )
        );

        // Alice lost some private balance due to bundler comp. Bob (acting as
        // bundler) has a little bit of tokens. Can't calculate exact amount
        // because verification uses mock verifiers + small amount of gas paid
        // out for failed transfer action.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLt(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BOB)), uint256(0)); // Bob gained funds
    }

    function testProcessBundleFailureReentrancyProcessOperationWalletCaller()
        public
    {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create internal op that is used when wallet calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Encode action for wallet to call itself via processOperation
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(wallet),
            encodedFunction: abi.encodeWithSelector(
                wallet.processOperation.selector,
                internalOp
            )
        });

        // Nest internal op into action where wallet call itself via
        // processOperation
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: actions,
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // op processed = true, as internal revert happened in action
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: true,
                failureReason: ""
            })
        );

        // Op was processed but call result has reentry failure message
        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = true, call[0] failed
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "Reentry into processOperation"
            )
        );

        // Alice lost some private balance due to bundler comp. Bob (acting as
        // bundler) has a little bit of tokens. Can't calculate exact amount
        // because verification uses mock verifiers + small amount of gas paid
        // out for failed transfer action.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLt(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BOB)), uint256(0)); // Bob gained funds
    }

    function testProcessBundleFailureReentrancyExecuteActionsWalletCaller()
        public
    {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create internal op that is used when wallet calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Encode action for wallet to call itself via executeActions
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(wallet),
            encodedFunction: abi.encodeWithSelector(
                wallet.executeActions.selector,
                internalOp
            )
        });

        // Nest internal op into action where wallet call itself via
        // executeActions
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: actions,
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // op processed = true, as internal revert happened in action
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: true,
                failureReason: ""
            })
        );

        // Op was processed but call result has reentry failure message
        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = true, call[0] failed
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "Reentry into executeActions"
            )
        );

        // Alice lost some private balance due to bundler comp. Bob (acting as
        // bundler) has a little bit of tokens. Can't calculate exact amount
        // because verification uses mock verifiers + small amount of gas paid
        // out for failed transfer action.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLt(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BOB)), uint256(0)); // Bob gained funds
    }

    // Test failing calls
    function testProcessBundleFailureTransferNotEnoughFundsInAction() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create transaction to send 3 * 50M even though only 2 * 50M is being
        // taken up by wallet
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 2,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    3 * PER_NOTE_AMOUNT
                ), // Transfer amount exceeds withdrawn
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // op processed = true, as internal revert happened in action
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: true,
                failureReason: ""
            })
        );

        // Use Bob as bundler for this call
        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = true, call[0] failed
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "transfer amount exceeds balance"
            )
        );

        // Alice lost some private balance due to bundler comp. Bob (acting as
        // bundler) has a little bit of tokens. Can't calculate exact amount
        // because verification uses mock verifiers + small amount of gas paid
        // out for failed transfer action.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLt(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BOB)), uint256(0)); // Bob gained funds
    }

    function testProcessBundleSuccessfulAllRefunds() public {
        SimpleERC20Token tokenIn = ERC20s[0];
        reserveAndDepositFunds(ALICE, tokenIn, PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();

        Action[] memory actions = new Action[](2);

        // Approve swapper to transfer tokens
        actions[0] = Action({
            contractAddress: address(tokenIn),
            encodedFunction: abi.encodeWithSelector(
                tokenIn.approve.selector,
                address(swapper),
                PER_NOTE_AMOUNT
            )
        });

        // Call swapper.swap, asking for erc20/721/1155 tokens back
        SimpleERC20Token erc20Out = ERC20s[1];
        SimpleERC721Token erc721Out = ERC721s[1];
        SimpleERC1155Token erc1155Out = ERC1155s[1];

        uint256 erc721OutId = 0x1;
        uint256 erc1155OutId = 0x2;

        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(wallet),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(tokenIn),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT,
                    erc20Out: address(erc20Out),
                    erc20OutAmount: PER_NOTE_AMOUNT,
                    erc721Out: address(erc721Out),
                    erc721OutId: erc721OutId,
                    erc1155Out: address(erc1155Out),
                    erc1155OutId: erc1155OutId,
                    erc1155OutAmount: PER_NOTE_AMOUNT
                })
            )
        });

        // Encode erc20Out as refund asset
        EncodedAsset[] memory encodedRefundAssets = new EncodedAsset[](1);
        encodedRefundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(erc20Out),
            ERC20_ID
        );

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: tokenIn,
                gasToken: tokenIn,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: encodedRefundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 4, // 4 refund assets (including joinsplit)
                gasPrice: 0,
                actions: actions,
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Ensure 50M tokensIn in vault and nothing else, swapper has 0 erc20In tokens
        assertEq(tokenIn.balanceOf(address(vault)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc20Out.balanceOf(address(vault)), uint256(0));
        assertEq(erc721Out.balanceOf(address(vault)), uint256(0));
        assertEq(
            erc1155Out.balanceOf(address(vault), erc1155OutId),
            uint256(0)
        );
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: true,
                failureReason: ""
            })
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = true, approve call and swap call both succeeded
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(2));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callSuccesses[1], true);
        assertEq(opResults[0].callResults.length, uint256(2));

        // Ensure 50M tokensIn in swapper, and all types of refund tokens back
        // in vault
        assertEq(tokenIn.balanceOf(address(vault)), uint256(0));
        assertEq(erc20Out.balanceOf(address(vault)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc721Out.balanceOf(address(vault)), uint256(1));
        assertEq(erc721Out.ownerOf(erc721OutId), address(vault));
        assertEq(
            erc1155Out.balanceOf(address(vault), erc1155OutId),
            PER_NOTE_AMOUNT
        );
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(PER_NOTE_AMOUNT));
    }

    function testProcessBundleFailureTooManyRefunds() public {
        SimpleERC20Token tokenIn = ERC20s[0];
        reserveAndDepositFunds(ALICE, tokenIn, 2 * PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();

        Action[] memory actions = new Action[](2);

        // Approve swapper to transfer tokens
        actions[0] = Action({
            contractAddress: address(tokenIn),
            encodedFunction: abi.encodeWithSelector(
                tokenIn.approve.selector,
                address(swapper),
                PER_NOTE_AMOUNT
            )
        });

        // Call swapper.swap, asking for erc20/721/1155 tokens back
        SimpleERC20Token erc20Out = ERC20s[1];
        SimpleERC721Token erc721Out = ERC721s[1];
        SimpleERC1155Token erc1155Out = ERC1155s[1];

        uint256 erc721OutId = 0x1;
        uint256 erc1155OutId = 0x2;

        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(wallet),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(tokenIn),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT,
                    erc20Out: address(erc20Out),
                    erc20OutAmount: PER_NOTE_AMOUNT,
                    erc721Out: address(erc721Out),
                    erc721OutId: erc721OutId,
                    erc1155Out: address(erc1155Out),
                    erc1155OutId: erc1155OutId,
                    erc1155OutAmount: PER_NOTE_AMOUNT
                })
            )
        });

        // Encode erc20Out as refund asset
        EncodedAsset[] memory encodedRefundAssets = new EncodedAsset[](1);
        encodedRefundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(erc20Out),
            ERC20_ID
        );

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: tokenIn,
                gasToken: tokenIn,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: encodedRefundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1, // should be 4 refund assets, 1 too few
                gasPrice: 50,
                actions: actions,
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Ensure 100M tokensIn in vault and nothing else
        // Swapper has 0 erc20In tokens
        assertEq(
            tokenIn.balanceOf(address(vault)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(erc20Out.balanceOf(address(vault)), uint256(0));
        assertEq(erc721Out.balanceOf(address(vault)), uint256(0));
        assertEq(
            erc1155Out.balanceOf(address(vault), erc1155OutId),
            uint256(0)
        );
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(0));

        // Check OperationProcessed event emits processed = false
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: false,
                failureReason: "Too many refunds"
            })
        );

        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = false, call[0] failed (too many refunds)
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].failureReason),
                "Too many refunds"
            )
        );

        // Vault lost some tokenIn to BOB due to bundler gas fee, but otherwise
        // no state changes
        assertLt(
            tokenIn.balanceOf(address(vault)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertGt(tokenIn.balanceOf(BOB), 0);
        assertEq(erc20Out.balanceOf(address(vault)), uint256(0));
        assertEq(erc721Out.balanceOf(address(vault)), uint256(0));
        assertEq(
            erc1155Out.balanceOf(address(vault), erc1155OutId),
            uint256(0)
        );
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(0));
    }

    function testProcessBundleFailureNotEnoughBundlerComp() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposit only 50M tokens
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT);

        // Unwrap 50M, not enough for bundler comp due to there being
        // maxNumRefunds = 20.
        // 20 refunds equates to at least below gas tokens:
        //    gasPrice * (10 * refundGas) = 50 * (20 * 80k) = 80M
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT / 3,
                numJoinSplits: 3,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT, // 500k
                maxNumRefunds: 20,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        assertEq(token.balanceOf(address(vault)), PER_NOTE_AMOUNT);
        assertEq(token.balanceOf(address(BOB)), 0);

        // Check OperationProcessed event emits processed = false
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: false,
                failureReason: "Too few gas tokens"
            })
        );

        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = true, call[0] failed (too few gas tokens)
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].failureReason),
                "Too few gas tokens"
            )
        );

        // No balances changed, bundler not compensated for missing this check
        assertEq(token.balanceOf(address(vault)), PER_NOTE_AMOUNT);
        assertEq(token.balanceOf(address(BOB)), 0);
    }

    function testProcessBundleFailureOOG() public {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation low executionGasLimit (not enough for transfer)
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: 100, // not enough gas for transfer
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        assertEq(token.balanceOf(address(vault)), 2 * PER_NOTE_AMOUNT);
        assertEq(token.balanceOf(address(BOB)), 0);

        // Check OperationProcessed event emits processed = false
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                wasProcessed: false,
                failureReason: "Transaction reverted silently"
            })
        );

        vm.prank(ALICE);
        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].failureReason, "Transaction reverted silently");

        // ALICE (bundler) was still paid
        assertLt(token.balanceOf(address(vault)), 2 * PER_NOTE_AMOUNT);
        assertGt(token.balanceOf(address(ALICE)), 0);
    }

    function testProcessOperationNotWalletCaller() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Attempt to call processOperation directly with ALICE as caller not
        // wallet
        vm.prank(ALICE);
        vm.expectRevert("Only the Wallet can call this");
        wallet.processOperation(op, 0, ALICE);
    }

    function testExecuteActionsNotWalletCaller() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Attempt to call executeActions directly with ALICE as caller not
        // wallet
        vm.prank(ALICE);
        vm.expectRevert("Only the Wallet can call this");
        wallet.executeActions(op);
    }
}