// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TeamSplit is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ArrayLengthMismatch();
    error TooFewMembers();
    error TooManyMembers();
    error InvalidShares();
    error ZeroAddress();
    error DuplicateMember();
    error SplitNotFound();
    error InvalidAmount();
    error InvalidMember();
    error NothingToWithdraw();

    event SplitCreated(uint256 indexed splitId, address[] members, uint256[] shares, string name);
    event Paid(uint256 indexed splitId, address indexed payer, uint256 amount, string memo);
    event Withdrawn(uint256 indexed splitId, address indexed member, uint256 amount);

    struct Split {
        string name;
        address[] members;
        uint256[] shares;
        uint256 totalPaid;
    }

    IERC20 public immutable usdcToken;

    uint256 private _nextSplitId = 1;
    mapping(uint256 splitId => Split) private _splits;
    mapping(uint256 splitId => mapping(address member => uint256 amount)) private _claimable;

    constructor(address usdcToken_) {
        if (usdcToken_ == address(0)) revert ZeroAddress();
        usdcToken = IERC20(usdcToken_);
    }

    function createSplit(
        address[] calldata members,
        uint256[] calldata shares,
        string calldata name
    ) external returns (uint256 splitId) {
        if (members.length != shares.length) revert ArrayLengthMismatch();
        if (members.length < 2) revert TooFewMembers();
        if (members.length > 20) revert TooManyMembers();

        uint256 shareSum = 0;
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == address(0)) revert ZeroAddress();

            for (uint256 j = i + 1; j < members.length; j++) {
                if (members[i] == members[j]) revert DuplicateMember();
            }

            shareSum += shares[i];
        }

        if (shareSum != 10_000) revert InvalidShares();

        splitId = _nextSplitId;
        _nextSplitId++;

        Split storage split = _splits[splitId];
        split.name = name;
        split.members = members;
        split.shares = shares;

        emit SplitCreated(splitId, members, shares, name);
    }

    function pay(uint256 splitId, uint256 amount, string calldata memo) external {
        if (!_splitExists(splitId)) revert SplitNotFound();
        if (amount == 0) revert InvalidAmount();

        Split storage split = _splits[splitId];

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 distributed = 0;
        uint256 memberCount = split.members.length;

        for (uint256 i = 0; i < memberCount; i++) {
            uint256 memberShare = (amount * split.shares[i]) / 10_000;
            if (memberShare > 0) {
                _claimable[splitId][split.members[i]] += memberShare;
            }
            distributed += memberShare;
        }

        uint256 dust = amount - distributed;
        if (dust > 0) {
            address lastMember = split.members[memberCount - 1];
            _claimable[splitId][lastMember] += dust;
        }

        split.totalPaid += amount;

        emit Paid(splitId, msg.sender, amount, memo);
    }

    function withdraw(uint256 splitId) external nonReentrant {
        uint256 amount = _claimable[splitId][msg.sender];
        if (amount == 0) revert InvalidMember();

        _claimable[splitId][msg.sender] = 0;
        usdcToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(splitId, msg.sender, amount);
    }

    function withdrawFor(uint256 splitId, address member) external nonReentrant {
        uint256 amount = _claimable[splitId][member];
        if (amount == 0) revert NothingToWithdraw();

        _claimable[splitId][member] = 0;
        usdcToken.safeTransfer(member, amount);

        emit Withdrawn(splitId, member, amount);
    }

    function getSplit(uint256 splitId) external view returns (Split memory) {
        if (!_splitExists(splitId)) revert SplitNotFound();
        return _splits[splitId];
    }

    function claimable(uint256 splitId, address member) external view returns (uint256) {
        return _claimable[splitId][member];
    }

    function totalPaid(uint256 splitId) external view returns (uint256) {
        if (!_splitExists(splitId)) revert SplitNotFound();
        return _splits[splitId].totalPaid;
    }

    function splitCount() external view returns (uint256) {
        return _nextSplitId - 1;
    }

    function _splitExists(uint256 splitId) private view returns (bool) {
        return splitId > 0 && splitId < _nextSplitId;
    }
}
