// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EscrowVault, IIdentityRegistry} from "../src/EscrowVault.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ReentrantToken} from "./mocks/ReentrantToken.sol";

contract EscrowVaultTest is Test {
    EscrowVault internal vault;
    MockUSDC internal usdc;
    IdentityRegistry internal registry;

    address internal platform = address(this);
    address internal treasury = makeAddr("treasury");
    address internal payer = makeAddr("payer");
    address internal payee = makeAddr("payee");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant ID = keccak256("payment-1");
    bytes32 internal constant CHASH = keccak256("compliance-json");
    uint256 internal constant AMOUNT = 1_000_000_000; // 1000 USDC
    uint256 internal constant FEE = 7_500_000; // 7.5 USDC (75 bps)
    uint256 internal constant PAYOUT = AMOUNT - FEE;

    function setUp() public {
        usdc = new MockUSDC();
        registry = new IdentityRegistry();
        vault = new EscrowVault(IERC20(address(usdc)), _reg(), treasury, platform);

        uint64 expiry = uint64(block.timestamp + 365 days);
        registry.setCredential(payer, keccak256("payer-vc"), expiry);
        registry.setCredential(payee, keccak256("payee-vc"), expiry);

        usdc.mint(payer, 10_000_000_000);
        vm.prank(payer);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _reg() internal view returns (IIdentityRegistry) {
        // registry cast to the minimal interface the vault expects
        return IIdentityRegistry(address(registry));
    }

    function _fund() internal {
        vm.prank(payer);
        vault.fund(ID, payee, AMOUNT, FEE, CHASH);
    }

    // ---- fund -----------------------------------------------------------------

    function test_FundEscrowsTokensAndStores() public {
        _fund();
        assertEq(usdc.balanceOf(address(vault)), AMOUNT);
        EscrowVault.Payment memory p = vault.getPayment(ID);
        assertEq(uint8(p.state), uint8(EscrowVault.State.Funded));
        assertEq(p.payer, payer);
        assertEq(p.payee, payee);
        assertEq(p.amount, AMOUNT);
        assertEq(p.fee, FEE);
        assertEq(p.complianceHash, CHASH);
    }

    function test_FundRequiresVerifiedPayer() public {
        registry.revoke(payer);
        vm.prank(payer);
        vm.expectRevert(bytes("EscrowVault: payer not verified"));
        vault.fund(ID, payee, AMOUNT, FEE, CHASH);
    }

    function test_FundRequiresVerifiedPayee() public {
        registry.revoke(payee);
        vm.prank(payer);
        vm.expectRevert(bytes("EscrowVault: payee not verified"));
        vault.fund(ID, payee, AMOUNT, FEE, CHASH);
    }

    function test_FundRejectsDuplicateId() public {
        _fund();
        vm.prank(payer);
        vm.expectRevert(bytes("EscrowVault: id exists"));
        vault.fund(ID, payee, AMOUNT, FEE, CHASH);
    }

    function test_FundRejectsFeeExceedingAmount() public {
        vm.prank(payer);
        vm.expectRevert(bytes("EscrowVault: fee exceeds amount"));
        vault.fund(ID, payee, AMOUNT, AMOUNT + 1, CHASH);
    }

    function test_FundRejectsZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(bytes("EscrowVault: zero amount"));
        vault.fund(ID, payee, 0, 0, CHASH);
    }

    // ---- release --------------------------------------------------------------

    function test_ReleasePaysPayeeAndTreasury() public {
        _fund();
        vm.prank(payer);
        vault.release(ID);
        assertEq(usdc.balanceOf(payee), PAYOUT);
        assertEq(usdc.balanceOf(treasury), FEE);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(uint8(vault.getPayment(ID).state), uint8(EscrowVault.State.Released));
    }

    function test_PlatformCanRelease() public {
        _fund();
        vault.release(ID); // platform == this
        assertEq(usdc.balanceOf(payee), PAYOUT);
    }

    function test_ReleaseUnauthorizedReverts() public {
        _fund();
        vm.prank(stranger);
        vm.expectRevert(bytes("EscrowVault: not authorized"));
        vault.release(ID);
    }

    function test_ReleaseNotFundedReverts() public {
        vm.expectRevert(bytes("EscrowVault: not funded"));
        vault.release(ID);
    }

    function test_DoubleReleaseReverts() public {
        _fund();
        vault.release(ID);
        vm.expectRevert(bytes("EscrowVault: not funded"));
        vault.release(ID);
    }

    // ---- refund ---------------------------------------------------------------

    function test_RefundReturnsFullAmountToPayer() public {
        uint256 before = usdc.balanceOf(payer);
        _fund();
        vm.prank(payer);
        vault.refund(ID);
        assertEq(usdc.balanceOf(payer), before);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(uint8(vault.getPayment(ID).state), uint8(EscrowVault.State.Refunded));
    }

    function test_RefundAfterReleaseReverts() public {
        _fund();
        vault.release(ID);
        vm.expectRevert(bytes("EscrowVault: not refundable"));
        vault.refund(ID);
    }

    function test_ReleaseAfterRefundReverts() public {
        _fund();
        vault.refund(ID); // platform refunds
        vm.expectRevert(bytes("EscrowVault: not funded"));
        vault.release(ID);
    }

    function test_RefundUnauthorizedReverts() public {
        _fund();
        vm.prank(stranger);
        vm.expectRevert(bytes("EscrowVault: not authorized"));
        vault.refund(ID);
    }

    // ---- freeze / unfreeze ----------------------------------------------------

    function test_FreezeBlocksReleaseUntilUnfrozen() public {
        _fund();
        vault.freeze(ID);
        assertEq(uint8(vault.getPayment(ID).state), uint8(EscrowVault.State.Frozen));
        vm.prank(payer);
        vm.expectRevert(bytes("EscrowVault: not funded"));
        vault.release(ID);

        vault.unfreeze(ID);
        vm.prank(payer);
        vault.release(ID);
        assertEq(usdc.balanceOf(payee), PAYOUT);
    }

    function test_FreezeOnlyPlatform() public {
        _fund();
        bytes32 role = vault.PLATFORM_ROLE(); // resolve before prank so it isn't consumed
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, role)
        );
        vault.freeze(ID);
    }

    function test_PlatformCanRefundFrozen() public {
        uint256 before = usdc.balanceOf(payer);
        _fund();
        vault.freeze(ID);
        vault.refund(ID);
        assertEq(usdc.balanceOf(payer), before);
        assertEq(uint8(vault.getPayment(ID).state), uint8(EscrowVault.State.Refunded));
    }

    // ---- reentrancy -----------------------------------------------------------

    function test_ReentrancyGuardBlocksReenteringRelease() public {
        ReentrantToken evil = new ReentrantToken();
        IdentityRegistry reg2 = new IdentityRegistry();
        EscrowVault v2 =
            new EscrowVault(IERC20(address(evil)), IIdentityRegistry(address(reg2)), treasury, platform);

        uint64 expiry = uint64(block.timestamp + 365 days);
        reg2.setCredential(payer, keccak256("p"), expiry);
        reg2.setCredential(payee, keccak256("q"), expiry);
        evil.mint(payer, AMOUNT);
        vm.prank(payer);
        evil.approve(address(v2), type(uint256).max);

        vm.prank(payer);
        v2.fund(ID, payee, AMOUNT, FEE, CHASH);

        evil.arm(v2, ID); // re-enter release() on the next transfer

        // release triggers token transfer -> token re-enters release -> guard reverts
        vm.prank(payer);
        vm.expectRevert(); // ReentrancyGuardReentrantCall bubbles up through SafeERC20
        v2.release(ID);
    }
}
