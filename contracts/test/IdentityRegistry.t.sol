// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry internal reg;
    address internal alice = makeAddr("alice");
    bytes32 internal constant HASH = keccak256("priya-vc");

    event CredentialSet(address indexed subject, bytes32 hash, uint64 expiry);
    event CredentialRevoked(address indexed subject);

    function setUp() public {
        reg = new IdentityRegistry();
        vm.warp(1_700_000_000); // fixed "now" so expiry math is deterministic
    }

    function _futureExpiry() internal view returns (uint64) {
        return uint64(block.timestamp + 365 days);
    }

    function test_UnsetAddressIsNotVerified() public view {
        assertFalse(reg.isVerified(alice));
    }

    function test_SetCredentialVerifies() public {
        uint64 expiry = _futureExpiry();
        vm.expectEmit(true, false, false, true);
        emit CredentialSet(alice, HASH, expiry);
        reg.setCredential(alice, HASH, expiry);
        assertTrue(reg.isVerified(alice));

        IdentityRegistry.Credential memory c = reg.credentialOf(alice);
        assertEq(c.hash, HASH);
        assertEq(c.expiry, expiry);
        assertFalse(c.revoked);
    }

    function test_NonOwnerCannotSet() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        reg.setCredential(alice, HASH, _futureExpiry());
    }

    function test_RevokedCredentialNotVerified() public {
        reg.setCredential(alice, HASH, _futureExpiry());
        vm.expectEmit(true, false, false, false);
        emit CredentialRevoked(alice);
        reg.revoke(alice);
        assertFalse(reg.isVerified(alice));
    }

    function test_ExpiredCredentialNotVerified() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        reg.setCredential(alice, HASH, expiry);
        assertTrue(reg.isVerified(alice));
        vm.warp(block.timestamp + 2 days);
        assertFalse(reg.isVerified(alice));
    }

    function test_RejectsZeroAddress() public {
        vm.expectRevert(bytes("IdentityRegistry: zero address"));
        reg.setCredential(address(0), HASH, _futureExpiry());
    }

    function test_RejectsEmptyHash() public {
        vm.expectRevert(bytes("IdentityRegistry: empty hash"));
        reg.setCredential(alice, bytes32(0), _futureExpiry());
    }

    function test_RejectsPastExpiry() public {
        vm.expectRevert(bytes("IdentityRegistry: expiry in past"));
        reg.setCredential(alice, HASH, uint64(block.timestamp - 1));
    }
}
