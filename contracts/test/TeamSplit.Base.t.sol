// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {TeamSplit} from "../TeamSplit.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Shared fixtures for all TeamSplit test categories.
abstract contract TeamSplitTestBase is Test {
    // ── actors ────────────────────────────────────────────────────────────────
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal carol   = makeAddr("carol");
    address internal dave    = makeAddr("dave");
    address internal payer   = makeAddr("payer");
    address internal anyone  = makeAddr("anyone");

    // ── contracts ─────────────────────────────────────────────────────────────
    MockERC20  internal usdc;
    TeamSplit  internal split;

    // ── well-known split ID created in setUp ──────────────────────────────────
    uint256 internal splitId;

    // ── default members / shares (total = 10 000 bps) ─────────────────────────
    // alice 50 %, bob 30 %, carol 20 %
    address[] internal defaultMembers;
    uint256[] internal defaultShares;

    // ── funding helpers ────────────────────────────────────────────────────────
    uint256 internal constant MINT_AMOUNT = 1_000_000e6; // 1 M USDC (6 dec)

    function setUp() public virtual {
        usdc  = new MockERC20("Mock USDC", "mUSDC", 6);
        split = new TeamSplit(address(usdc));

        defaultMembers = new address[](3);
        defaultMembers[0] = alice;
        defaultMembers[1] = bob;
        defaultMembers[2] = carol;

        defaultShares = new uint256[](3);
        defaultShares[0] = 5_000; // 50 %
        defaultShares[1] = 3_000; // 30 %
        defaultShares[2] = 2_000; // 20 %

        splitId = split.createSplit(defaultMembers, defaultShares, "Default Split");

        // Give the payer plenty of USDC and pre-approve
        usdc.mint(payer, MINT_AMOUNT);
        vm.prank(payer);
        usdc.approve(address(split), type(uint256).max);
    }

    /// @dev Convenience: make a payment and return the three claimable amounts.
    function _pay(uint256 amount) internal returns (uint256 ca, uint256 cb, uint256 cc) {
        vm.prank(payer);
        split.pay(splitId, amount, "test");
        ca = split.claimable(splitId, alice);
        cb = split.claimable(splitId, bob);
        cc = split.claimable(splitId, carol);
    }

    /// @dev Sum claimable balances for the default three members.
    function _totalClaimable() internal view returns (uint256) {
        return split.claimable(splitId, alice)
             + split.claimable(splitId, bob)
             + split.claimable(splitId, carol);
    }
}
