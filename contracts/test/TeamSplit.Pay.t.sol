// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TeamSplitTestBase} from "./TeamSplit.Base.t.sol";
import {TeamSplit} from "../TeamSplit.sol";

contract TeamSplitPayTest is TeamSplitTestBase {

    // ── happy path ────────────────────────────────────────────────────────────

    function test_Pay_EmitsPaid() public {
        uint256 amount = 1_000e6;

        vm.expectEmit(true, true, false, true, address(split));
        emit TeamSplit.Paid(splitId, payer, amount, "hello");

        vm.prank(payer);
        split.pay(splitId, amount, "hello");
    }

    function test_Pay_ExactEvenSplit() public {
        // 1 000 USDC, shares 50/30/20 → 500 / 300 / 200 (no dust)
        uint256 amount = 1_000e6;
        (uint256 ca, uint256 cb, uint256 cc) = _pay(amount);

        assertEq(ca, 500e6, "alice share");
        assertEq(cb, 300e6, "bob share");
        assertEq(cc, 200e6, "carol share");
        assertEq(ca + cb + cc, amount, "sum == amount");
    }

    function test_Pay_DustGoesToLastMember() public {
        // 3 USDC, 50 % of 3 = 1.5 (floors to 1), 30 % = 0.9 (floors to 0),
        // 20 % = 0.6 (floors to 0).  dust = 3 - 1 = 2; goes to carol (last).
        // Use 3 micro-USDC (3 units with 6 decimals would be tiny; use raw units).
        uint256 amount = 3; // 3 raw units (0.000003 USDC)

        vm.prank(payer);
        split.pay(splitId, amount, "dust test");

        uint256 ca = split.claimable(splitId, alice);
        uint256 cb = split.claimable(splitId, bob);
        uint256 cc = split.claimable(splitId, carol);

        // 50 % of 3 = 1, 30 % of 3 = 0, 20 % of 3 = 0
        assertEq(ca, 1, "alice");
        assertEq(cb, 0, "bob");
        // dust = 3 - 1 = 2 → to carol
        assertEq(cc, 2, "carol gets dust");
        assertEq(ca + cb + cc, amount, "conservation");
    }

    function test_Pay_TotalPaidUpdated() public {
        uint256 a1 = 1_000e6;
        uint256 a2 = 500e6;

        vm.prank(payer);
        split.pay(splitId, a1, "p1");
        vm.prank(payer);
        split.pay(splitId, a2, "p2");

        assertEq(split.totalPaid(splitId), a1 + a2);
    }

    function test_Pay_UsdcTransferredToContract() public {
        uint256 amount = 100e6;
        uint256 before = usdc.balanceOf(address(split));

        vm.prank(payer);
        split.pay(splitId, amount, "");

        assertEq(usdc.balanceOf(address(split)), before + amount);
    }

    // ── revert paths ──────────────────────────────────────────────────────────

    function test_Pay_RevertSplitNotFound() public {
        vm.prank(payer);
        vm.expectRevert(TeamSplit.SplitNotFound.selector);
        split.pay(999, 100e6, "");
    }

    function test_Pay_RevertInvalidAmountZero() public {
        vm.prank(payer);
        vm.expectRevert(TeamSplit.InvalidAmount.selector);
        split.pay(splitId, 0, "");
    }

    function test_Pay_RevertInsufficientAllowance() public {
        address stingy = makeAddr("stingy");
        usdc.mint(stingy, 100e6);
        // No approval given

        vm.prank(stingy);
        vm.expectRevert();
        split.pay(splitId, 100e6, "");
    }

    // ── fuzz: arithmetic correctness ──────────────────────────────────────────

    /// @dev Every member's claimable equals floor(amount * share / 10_000);
    ///      dust (amount - sum-of-floors) lands entirely on the last member.
    function testFuzz_Pay_SharesAreCorrect(uint256 amount) public {
        // Keep amount in a realistic USDC range: 1 unit … 1 M USDC (6 dec)
        amount = bound(amount, 1, 1_000_000e6);

        // Mint & approve for payer (setUp already approved but let's ensure enough)
        usdc.mint(payer, amount);

        vm.prank(payer);
        split.pay(splitId, amount, "fuzz");

        uint256 ca = split.claimable(splitId, alice);
        uint256 cb = split.claimable(splitId, bob);
        uint256 cc = split.claimable(splitId, carol);

        // Expected floors
        uint256 expA = (amount * 5_000) / 10_000;
        uint256 expB = (amount * 3_000) / 10_000;
        uint256 expC = (amount * 2_000) / 10_000;
        uint256 dust  = amount - expA - expB - expC;

        assertEq(ca, expA,         "alice claimable");
        assertEq(cb, expB,         "bob claimable");
        assertEq(cc, expC + dust,  "carol claimable (incl. dust)");

        // Conservation: nothing is lost or created
        assertEq(ca + cb + cc, amount, "sum == amount");
    }

    /// @dev Multiple successive payments leave contract balance == sum of claimable.
    function testFuzz_Pay_NoUsdcStuck(uint256 a1, uint256 a2, uint256 a3) public {
        a1 = bound(a1, 1, 333_333e6);
        a2 = bound(a2, 1, 333_333e6);
        a3 = bound(a3, 1, 333_333e6);

        // Ensure payer has enough (setUp minted 1 M; top up to be safe)
        usdc.mint(payer, a1 + a2 + a3);

        vm.startPrank(payer);
        split.pay(splitId, a1, "p1");
        split.pay(splitId, a2, "p2");
        split.pay(splitId, a3, "p3");
        vm.stopPrank();

        uint256 contractBalance = usdc.balanceOf(address(split));
        uint256 sumClaimable    = _totalClaimable();

        assertEq(contractBalance, sumClaimable, "no USDC stuck");
        assertEq(sumClaimable, a1 + a2 + a3,   "total claimable == total paid");
    }
}
