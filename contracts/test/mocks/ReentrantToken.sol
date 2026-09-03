// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EscrowVault} from "../../src/EscrowVault.sol";

/// @notice Malicious ERC20 that attempts to re-enter EscrowVault.release during
///         a token transfer. Used to prove the ReentrancyGuard holds.
contract ReentrantToken is ERC20 {
    EscrowVault public vault;
    bytes32 public targetId;
    bool public armed;
    bool internal _inCallback;

    constructor() ERC20("Reentrant", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Arm the attack for a specific payment id (call after funding).
    function arm(EscrowVault _vault, bytes32 _id) external {
        vault = _vault;
        targetId = _id;
        armed = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (armed && !_inCallback) {
            _inCallback = true;
            vault.release(targetId); // re-entry attempt; guard must revert this
            _inCallback = false;
        }
    }
}
