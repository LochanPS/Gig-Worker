// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice 6-decimal demo stablecoin with an owner-gated faucet. Stands in for
///         USDC on the local anvil chain. DEMO ONLY — not real USDC, no value.
/// @dev Contract interface frozen in BUILD_CONTRACTS section 6.
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("Mock USD Coin", "USDC") Ownable(msg.sender) {}

    /// @notice USDC uses 6 decimals, not the ERC20 default of 18.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Owner-only faucet. Backend mints demo funding to company wallets
    ///         at verification time.
    /// @param to     recipient wallet
    /// @param amount amount in base units (6 decimals)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
