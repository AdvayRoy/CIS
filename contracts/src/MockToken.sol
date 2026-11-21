// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Standard mock token for the local-chain demo. 18 decimals. No real value.
contract MockToken is ERC20, Ownable {
    constructor() ERC20("CounterSign Demo USD", "CSUSD") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
