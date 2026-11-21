// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IShopLike {
    function purchase(uint256 itemId, uint256 price) external;
}

/// @notice INTENTIONALLY VULNERABLE comparison fixture. DO NOT USE.
/// @dev Mirrors the common "approve unlimited, then buy" checkout pattern: the purchase
///      succeeds but an unlimited allowance stays with the shop, which can drain later.
contract VulnerableWallet {
    address public immutable owner;

    error NotOwner();

    constructor(address owner_) {
        owner = owner_;
    }

    function buy(IERC20 token, address shop, uint256 itemId, uint256 price) external {
        if (msg.sender != owner) revert NotOwner();
        // INTENTIONALLY VULNERABLE: unlimited approval that is never revoked.
        token.approve(shop, type(uint256).max);
        IShopLike(shop).purchase(itemId, price);
    }
}
