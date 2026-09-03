// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AuditAnchor} from "../src/AuditAnchor.sol";

contract AuditAnchorTest is Test {
    AuditAnchor internal anchor;

    event Anchored(bytes32 indexed hash, uint256 timestamp);

    function setUp() public {
        anchor = new AuditAnchor();
        vm.warp(1_700_000_000);
    }

    function test_AnchorEmitsHashAndTimestamp() public {
        bytes32 h = keccak256("decision-json");
        vm.expectEmit(true, false, false, true);
        emit Anchored(h, block.timestamp);
        anchor.anchor(h);
    }

    function testFuzz_AnchorAnyHash(bytes32 h) public {
        vm.expectEmit(true, false, false, true);
        emit Anchored(h, block.timestamp);
        anchor.anchor(h);
    }
}
