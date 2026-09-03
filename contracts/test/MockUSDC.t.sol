// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;
    address internal owner = address(this);
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();
    }

    function test_MetadataAndDecimals() public view {
        assertEq(usdc.name(), "Mock USD Coin");
        assertEq(usdc.symbol(), "USDC");
        assertEq(usdc.decimals(), 6);
    }

    function test_OwnerCanMint() public {
        usdc.mint(alice, 100_000e6);
        assertEq(usdc.balanceOf(alice), 100_000e6);
        assertEq(usdc.totalSupply(), 100_000e6);
    }

    function test_NonOwnerCannotMint() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        usdc.mint(alice, 1e6);
    }

    function test_TransferMovesTokens() public {
        usdc.mint(alice, 500e6);
        vm.prank(alice);
        usdc.transfer(bob, 200e6);
        assertEq(usdc.balanceOf(alice), 300e6);
        assertEq(usdc.balanceOf(bob), 200e6);
    }

    function testFuzz_MintCreditsRecipient(address to, uint96 amount) public {
        vm.assume(to != address(0));
        usdc.mint(to, amount);
        assertEq(usdc.balanceOf(to), amount);
    }
}
