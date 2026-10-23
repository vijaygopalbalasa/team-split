// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TeamSplitTestBase} from "./TeamSplit.Base.t.sol";
import {TeamSplit} from "../TeamSplit.sol";

contract TeamSplitCreateSplitTest is TeamSplitTestBase {

    // ── helpers ───────────────────────────────────────────────────────────────

    function _twoMembers() internal view returns (address[] memory m, uint256[] memory s) {
        m = new address[](2);
        m[0] = alice;
        m[1] = bob;
        s = new uint256[](2);
        s[0] = 5_000;
        s[1] = 5_000;
    }

    // ── deployment ────────────────────────────────────────────────────────────

    function test_Deploy_UsdcStored() public view {
        assertEq(address(split.usdcToken()), address(usdc));
    }

    function test_Deploy_ZeroAddressUsdcReverts() public {
        vm.expectRevert(TeamSplit.ZeroAddress.selector);
        new TeamSplit(address(0));
    }

    // ── successful creation ───────────────────────────────────────────────────

    function test_CreateSplit_SplitIdStartsAtOne() public view {
        // setUp already created splitId == 1
        assertEq(splitId, 1);
    }

    function test_CreateSplit_SplitCountIncrements() public view {
        assertEq(split.splitCount(), 1);
    }

    function test_CreateSplit_SecondSplitIdIsTwo() public {
        (address[] memory m, uint256[] memory s) = _twoMembers();
        uint256 id2 = split.createSplit(m, s, "Second");
        assertEq(id2, 2);
        assertEq(split.splitCount(), 2);
    }

    function test_CreateSplit_SplitDataStoredCorrectly() public view {
        TeamSplit.Split memory sp = split.getSplit(splitId);
        assertEq(sp.name, "Default Split");
        assertEq(sp.members.length, 3);
        assertEq(sp.members[0], alice);
        assertEq(sp.members[1], bob);
        assertEq(sp.members[2], carol);
        assertEq(sp.shares[0], 5_000);
        assertEq(sp.shares[1], 3_000);
        assertEq(sp.shares[2], 2_000);
        assertEq(sp.totalPaid, 0);
    }

    function test_CreateSplit_EmitsSplitCreated() public {
        (address[] memory m, uint256[] memory s) = _twoMembers();

        vm.expectEmit(true, false, false, true, address(split));
        emit TeamSplit.SplitCreated(2, m, s, "My Split");

        split.createSplit(m, s, "My Split");
    }

    function test_CreateSplit_MinTwoMembers() public {
        (address[] memory m, uint256[] memory s) = _twoMembers();
        uint256 id = split.createSplit(m, s, "Min");
        assertEq(id, 2);
    }

    function test_CreateSplit_MaxTwentyMembers() public {
        address[] memory m = new address[](20);
        uint256[] memory s = new uint256[](20);
        // 19 members get 500 bps, last gets remainder so total = 10 000
        for (uint256 i = 0; i < 19; i++) {
            m[i] = makeAddr(string(abi.encodePacked("member", i)));
            s[i] = 500;
        }
        m[19] = makeAddr("member19");
        s[19] = 500; // 19*500 + 500 = 10000
        uint256 id = split.createSplit(m, s, "Max");
        assertEq(id, 2);
    }

    // ── revert: array length mismatch ─────────────────────────────────────────

    function test_CreateSplit_RevertArrayLengthMismatch_ExtraShares() public {
        address[] memory m = new address[](2);
        m[0] = alice; m[1] = bob;
        uint256[] memory s = new uint256[](3);
        s[0] = 3_000; s[1] = 3_000; s[2] = 4_000;

        vm.expectRevert(TeamSplit.ArrayLengthMismatch.selector);
        split.createSplit(m, s, "X");
    }

    function test_CreateSplit_RevertArrayLengthMismatch_ExtraMembers() public {
        address[] memory m = new address[](3);
        m[0] = alice; m[1] = bob; m[2] = carol;
        uint256[] memory s = new uint256[](2);
        s[0] = 5_000; s[1] = 5_000;

        vm.expectRevert(TeamSplit.ArrayLengthMismatch.selector);
        split.createSplit(m, s, "X");
    }

    // ── revert: too few members ───────────────────────────────────────────────

    function test_CreateSplit_RevertTooFewMembers_Empty() public {
        address[] memory m = new address[](0);
        uint256[] memory s = new uint256[](0);

        vm.expectRevert(TeamSplit.TooFewMembers.selector);
        split.createSplit(m, s, "X");
    }

    function test_CreateSplit_RevertTooFewMembers_OneMember() public {
        address[] memory m = new address[](1);
        m[0] = alice;
        uint256[] memory s = new uint256[](1);
        s[0] = 10_000;

        vm.expectRevert(TeamSplit.TooFewMembers.selector);
        split.createSplit(m, s, "X");
    }

    // ── revert: too many members ──────────────────────────────────────────────

    function test_CreateSplit_RevertTooManyMembers() public {
        address[] memory m = new address[](21);
        uint256[] memory s = new uint256[](21);
        for (uint256 i = 0; i < 20; i++) {
            m[i] = makeAddr(string(abi.encodePacked("xmember", i)));
            s[i] = 476;
        }
        m[20] = makeAddr("xmember20");
        s[20] = 480; // total ≠ 10000 but TooManyMembers fires first
        // Adjust: 20*476 = 9520, +480 = 10000 , but 21 members is still too many
        vm.expectRevert(TeamSplit.TooManyMembers.selector);
        split.createSplit(m, s, "X");
    }

    // ── revert: zero address ──────────────────────────────────────────────────

    function test_CreateSplit_RevertZeroAddressFirstMember() public {
        address[] memory m = new address[](2);
        m[0] = address(0); m[1] = bob;
        uint256[] memory s = new uint256[](2);
        s[0] = 5_000; s[1] = 5_000;

        vm.expectRevert(TeamSplit.ZeroAddress.selector);
        split.createSplit(m, s, "X");
    }

    function test_CreateSplit_RevertZeroAddressSecondMember() public {
        address[] memory m = new address[](2);
        m[0] = alice; m[1] = address(0);
        uint256[] memory s = new uint256[](2);
        s[0] = 5_000; s[1] = 5_000;

        vm.expectRevert(TeamSplit.ZeroAddress.selector);
        split.createSplit(m, s, "X");
    }

    // ── revert: duplicate member ──────────────────────────────────────────────

    function test_CreateSplit_RevertDuplicateMember() public {
        address[] memory m = new address[](2);
        m[0] = alice; m[1] = alice;
        uint256[] memory s = new uint256[](2);
        s[0] = 5_000; s[1] = 5_000;

        vm.expectRevert(TeamSplit.DuplicateMember.selector);
        split.createSplit(m, s, "X");
    }

    function test_CreateSplit_RevertDuplicateMemberNonAdjacent() public {
        address[] memory m = new address[](3);
        m[0] = alice; m[1] = bob; m[2] = alice;
        uint256[] memory s = new uint256[](3);
        s[0] = 4_000; s[1] = 3_000; s[2] = 3_000;

        vm.expectRevert(TeamSplit.DuplicateMember.selector);
        split.createSplit(m, s, "X");
    }

    // ── revert: invalid shares ────────────────────────────────────────────────

    function test_CreateSplit_RevertSharesUnder10000() public {
        address[] memory m = new address[](2);
        m[0] = alice; m[1] = bob;
        uint256[] memory s = new uint256[](2);
        s[0] = 4_000; s[1] = 4_000; // total = 8 000

        vm.expectRevert(TeamSplit.InvalidShares.selector);
        split.createSplit(m, s, "X");
    }

    function test_CreateSplit_RevertSharesOver10000() public {
        address[] memory m = new address[](2);
        m[0] = alice; m[1] = bob;
        uint256[] memory s = new uint256[](2);
        s[0] = 6_000; s[1] = 6_000; // total = 12 000

        vm.expectRevert(TeamSplit.InvalidShares.selector);
        split.createSplit(m, s, "X");
    }

    function test_CreateSplit_RevertAllSharesZero() public {
        address[] memory m = new address[](2);
        m[0] = alice; m[1] = bob;
        uint256[] memory s = new uint256[](2);
        s[0] = 0; s[1] = 0;

        vm.expectRevert(TeamSplit.InvalidShares.selector);
        split.createSplit(m, s, "X");
    }

    // ── getSplit: non-existent ────────────────────────────────────────────────

    function test_GetSplit_RevertSplitNotFound() public {
        vm.expectRevert(TeamSplit.SplitNotFound.selector);
        split.getSplit(999);
    }
}
