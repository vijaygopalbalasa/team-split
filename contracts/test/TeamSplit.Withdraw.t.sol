// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TeamSplitTestBase} from "./TeamSplit.Base.t.sol";
import {TeamSplit} from "../TeamSplit.sol";

contract TeamSplitWithdrawTest is TeamSplitTestBase {

    uint256 internal constant PAY_AMOUNT = 1_000e6; // 1 000 USDC (6 dec)

    // after setUp + one payment the expected claimable amounts are:
    // alice 500e6, bob 300e6, carol 200e6

    function setUp() public override {
        super.setUp();
        // Fund one payment so there is something to withdraw
        vm.prank(payer);
        split.pay(splitId, PAY_AMOUNT, "setup payment");
    }

    // ── withdraw (caller pulls own balance) ───────────────────────────────────

    function test_Withdraw_HappyPath_Alice() public {
        uint256 expected = split.claimable(splitId, alice); // 500e6
        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        split.withdraw(splitId);

        assertEq(usdc.balanceOf(alice), balBefore + expected, "alice received");
        assertEq(split.claimable(splitId, alice), 0, "claimable zeroed");
    }

    function test_Withdraw_HappyPath_Bob() public {
        uint256 expected = split.claimable(splitId, bob); // 300e6

        vm.prank(bob);
        split.withdraw(splitId);

        assertEq(usdc.balanceOf(bob), expected);
        assertEq(split.claimable(splitId, bob), 0);
    }

    function test_Withdraw_EmitsWithdrawn() public {
        uint256 expected = split.claimable(splitId, alice);

        vm.expectEmit(true, true, false, true, address(split));
        emit TeamSplit.Withdrawn(splitId, alice, expected);

        vm.prank(alice);
        split.withdraw(splitId);
    }

    function test_Withdraw_OnlyCreditsOwnBalance() public {
        // Alice withdraws, Bob and Carol balances unchanged
        uint256 bobBefore   = split.claimable(splitId, bob);
        uint256 carolBefore = split.claimable(splitId, carol);

        vm.prank(alice);
        split.withdraw(splitId);

        assertEq(split.claimable(splitId, bob),   bobBefore,   "bob unaffected");
        assertEq(split.claimable(splitId, carol), carolBefore, "carol unaffected");
    }

    function test_Withdraw_ContractBalanceDecreases() public {
        uint256 aliceClaim = split.claimable(splitId, alice);
        uint256 contractBefore = usdc.balanceOf(address(split));

        vm.prank(alice);
        split.withdraw(splitId);

        assertEq(usdc.balanceOf(address(split)), contractBefore - aliceClaim);
    }

    function test_Withdraw_RevertSecondCallSameFunds() public {
        vm.prank(alice);
        split.withdraw(splitId);

        // Second call: claimable is now 0 → NothingToWithdraw / InvalidMember
        vm.prank(alice);
        vm.expectRevert(TeamSplit.InvalidMember.selector);
        split.withdraw(splitId);
    }

    function test_Withdraw_RevertNonMember() public {
        vm.prank(anyone);
        vm.expectRevert(TeamSplit.InvalidMember.selector);
        split.withdraw(splitId);
    }

    function test_Withdraw_RevertZeroBalance_BeforePayment() public {
        // dave is not a member of splitId
        vm.prank(dave);
        vm.expectRevert(TeamSplit.InvalidMember.selector);
        split.withdraw(splitId);
    }

    function test_Withdraw_AllMembersCanWithdraw() public {
        uint256 expA = split.claimable(splitId, alice);
        uint256 expB = split.claimable(splitId, bob);
        uint256 expC = split.claimable(splitId, carol);

        vm.prank(alice); split.withdraw(splitId);
        vm.prank(bob);   split.withdraw(splitId);
        vm.prank(carol); split.withdraw(splitId);

        assertEq(usdc.balanceOf(alice), expA);
        assertEq(usdc.balanceOf(bob),   expB);
        assertEq(usdc.balanceOf(carol), expC);
        assertEq(usdc.balanceOf(address(split)), 0, "contract drained");
    }

    // ── withdrawFor (anyone sends member their balance) ───────────────────────

    function test_WithdrawFor_HappyPath_AnyoneSendsAlice() public {
        uint256 expected = split.claimable(splitId, alice);
        uint256 balAliceBefore  = usdc.balanceOf(alice);
        uint256 balAnyoneBefore = usdc.balanceOf(anyone);

        vm.prank(anyone);
        split.withdrawFor(splitId, alice);

        assertEq(usdc.balanceOf(alice),  balAliceBefore + expected, "alice received");
        assertEq(usdc.balanceOf(anyone), balAnyoneBefore,           "caller unchanged");
        assertEq(split.claimable(splitId, alice), 0,                "claimable zeroed");
    }

    function test_WithdrawFor_MemberCanCallForThemself() public {
        uint256 expected = split.claimable(splitId, bob);

        vm.prank(bob);
        split.withdrawFor(splitId, bob);

        assertEq(usdc.balanceOf(bob), expected);
    }

    function test_WithdrawFor_EmitsWithdrawn() public {
        uint256 expected = split.claimable(splitId, bob);

        vm.expectEmit(true, true, false, true, address(split));
        emit TeamSplit.Withdrawn(splitId, bob, expected);

        vm.prank(anyone);
        split.withdrawFor(splitId, bob);
    }

    function test_WithdrawFor_SendsToMemberNotCaller() public {
        // alice's funds should go to alice, not to anyone
        vm.prank(anyone);
        split.withdrawFor(splitId, alice);

        assertEq(split.claimable(splitId, alice), 0);
        assertEq(usdc.balanceOf(anyone), 0, "caller got nothing");
    }

    function test_WithdrawFor_RevertSecondCall() public {
        vm.prank(anyone);
        split.withdrawFor(splitId, alice);

        vm.prank(anyone);
        vm.expectRevert(TeamSplit.NothingToWithdraw.selector);
        split.withdrawFor(splitId, alice);
    }

    function test_WithdrawFor_RevertNonMember() public {
        vm.prank(anyone);
        vm.expectRevert(TeamSplit.NothingToWithdraw.selector);
        split.withdrawFor(splitId, dave);
    }

    function test_WithdrawFor_ContractBalanceDecreases() public {
        uint256 carolClaim = split.claimable(splitId, carol);
        uint256 contractBefore = usdc.balanceOf(address(split));

        vm.prank(anyone);
        split.withdrawFor(splitId, carol);

        assertEq(usdc.balanceOf(address(split)), contractBefore - carolClaim);
    }

    // ── cross-split isolation ─────────────────────────────────────────────────

    function test_Withdraw_CrossSplitIsolation() public {
        // Create a second split with dave and alice
        address[] memory m = new address[](2);
        m[0] = dave; m[1] = alice;
        uint256[] memory s = new uint256[](2);
        s[0] = 6_000; s[1] = 4_000;
        uint256 split2 = split.createSplit(m, s, "Split 2");

        usdc.mint(payer, 500e6);
        vm.prank(payer);
        split.pay(split2, 500e6, "");

        // Alice withdraws from split1, her split2 claimable untouched
        uint256 aliceS2Before = split.claimable(split2, alice);
        vm.prank(alice);
        split.withdraw(splitId);

        assertEq(split.claimable(split2, alice), aliceS2Before, "split2 untouched");
    }

    // ── fuzz: full cycle ──────────────────────────────────────────────────────

    function testFuzz_Withdraw_FullCycle(uint256 amount) public {
        amount = bound(amount, 1, 999_999e6);
        usdc.mint(payer, amount);

        vm.prank(payer);
        split.pay(splitId, amount, "fuzz");

        uint256 expA = split.claimable(splitId, alice);
        uint256 expB = split.claimable(splitId, bob);
        uint256 expC = split.claimable(splitId, carol);

        // Also account for setUp payment
        uint256 aliceBase = 500e6;
        uint256 bobBase   = 300e6;
        uint256 carolBase = 200e6;

        vm.prank(alice); split.withdraw(splitId);
        vm.prank(bob);   split.withdraw(splitId);
        vm.prank(carol); split.withdraw(splitId);

        assertEq(usdc.balanceOf(alice), expA,  "alice balance");
        assertEq(usdc.balanceOf(bob),   expB,  "bob balance");
        assertEq(usdc.balanceOf(carol), expC,  "carol balance");
        assertEq(usdc.balanceOf(address(split)), 0, "no residual");

        // Suppress unused variable warnings
        (aliceBase, bobBase, carolBase);
    }
}
