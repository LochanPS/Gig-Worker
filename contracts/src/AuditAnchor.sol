// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AuditAnchor
/// @notice Tamper-evidence log. The backend anchors the keccak256 hash of every
///         compliance-decision JSON here so the off-chain audit trail can be
///         proven unaltered. Stores nothing but the event (cheap, immutable).
/// @dev anchor(bytes32) -> Anchored(hash, timestamp), frozen in BUILD_CONTRACTS §6.
contract AuditAnchor {
    event Anchored(bytes32 indexed hash, uint256 timestamp);

    /// @notice Anchor a hash on-chain. Permissionless by design — anyone can
    ///         add evidence; only the emitting party's hash matters for proofs.
    function anchor(bytes32 hash) external {
        emit Anchored(hash, block.timestamp);
    }
}
