// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title IdentityRegistry
/// @notice On-chain attestation of off-chain verifiable credentials. Stores
///         ONLY a credential hash + expiry per address — never PII (GDPR by
///         design, PRD NFR-3). EscrowVault reads `isVerified` as a payment gate.
/// @dev Only the owner (the backend/platform) writes. Interface frozen in
///      BUILD_CONTRACTS section 6.
contract IdentityRegistry is Ownable {
    struct Credential {
        bytes32 hash; // keccak256 of the off-chain VC document
        uint64 expiry; // unix seconds
        bool revoked;
    }

    mapping(address => Credential) private _creds;

    event CredentialSet(address indexed subject, bytes32 hash, uint64 expiry);
    event CredentialRevoked(address indexed subject);

    constructor() Ownable(msg.sender) {}

    /// @notice Attest a credential for `subject`. Overwrites any prior one.
    function setCredential(address subject, bytes32 hash, uint64 expiry) external onlyOwner {
        require(subject != address(0), "IdentityRegistry: zero address");
        require(hash != bytes32(0), "IdentityRegistry: empty hash");
        require(expiry > block.timestamp, "IdentityRegistry: expiry in past");
        _creds[subject] = Credential({hash: hash, expiry: expiry, revoked: false});
        emit CredentialSet(subject, hash, expiry);
    }

    /// @notice Revoke `subject`'s credential (e.g. compliance action).
    function revoke(address subject) external onlyOwner {
        _creds[subject].revoked = true;
        emit CredentialRevoked(subject);
    }

    /// @notice True iff `subject` has a non-empty, unrevoked, unexpired credential.
    function isVerified(address subject) external view returns (bool) {
        Credential memory c = _creds[subject];
        return c.hash != bytes32(0) && !c.revoked && c.expiry > block.timestamp;
    }

    /// @notice Read the raw credential record (hash + expiry + revoked).
    function credentialOf(address subject) external view returns (Credential memory) {
        return _creds[subject];
    }
}
