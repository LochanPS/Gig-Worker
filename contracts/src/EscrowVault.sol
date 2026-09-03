// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal view of IdentityRegistry used as the verified-party gate.
interface IIdentityRegistry {
    function isVerified(address subject) external view returns (bool);
}

/// @title EscrowVault
/// @notice Core settlement escrow. A verified payer funds a payment in MockUSDC;
///         the platform (or payer) releases it — payee receives amount minus fee,
///         treasury receives the fee — or refunds it. Disputes can be frozen.
/// @dev State machine: None -> Funded -> Released | Refunded, with
///      Funded <-> Frozen for dispute handling. Function signatures + events are
///      frozen in BUILD_CONTRACTS section 6. Follows checks-effects-interactions
///      and guards every fund-moving call with ReentrancyGuard.
contract EscrowVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PLATFORM_ROLE = keccak256("PLATFORM_ROLE");

    enum State {
        None,
        Funded,
        Released,
        Refunded,
        Frozen
    }

    struct Payment {
        bytes32 id;
        address payer;
        address payee;
        uint256 amount; // gross, in MockUSDC base units (6 decimals)
        uint256 fee; // platform fee, subset of amount
        bytes32 complianceHash;
        State state;
        uint64 createdAt;
        uint64 releasedAt;
    }

    IERC20 public immutable token;
    IIdentityRegistry public immutable registry;
    address public treasury;

    mapping(bytes32 => Payment) private _payments;

    event PaymentFunded(
        bytes32 indexed id,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        uint256 fee,
        bytes32 complianceHash
    );
    event PaymentReleased(bytes32 indexed id);
    event PaymentRefunded(bytes32 indexed id);
    event PaymentFrozen(bytes32 indexed id);
    event PaymentUnfrozen(bytes32 indexed id);
    event TreasuryUpdated(address indexed treasury);

    constructor(IERC20 _token, IIdentityRegistry _registry, address _treasury, address admin) {
        require(
            address(_token) != address(0) && address(_registry) != address(0) && _treasury != address(0)
                && admin != address(0),
            "EscrowVault: zero address"
        );
        token = _token;
        registry = _registry;
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PLATFORM_ROLE, admin);
    }

    /// @notice Update the fee-collection treasury address.
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "EscrowVault: zero address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /// @notice Fund a new escrow. Caller (payer) must have approved `amount` on
    ///         the token first. Both payer and payee must be verified.
    function fund(bytes32 id, address payee, uint256 amount, uint256 fee, bytes32 complianceHash)
        external
        nonReentrant
    {
        require(_payments[id].state == State.None, "EscrowVault: id exists");
        require(payee != address(0), "EscrowVault: zero payee");
        require(amount > 0, "EscrowVault: zero amount");
        require(fee <= amount, "EscrowVault: fee exceeds amount");
        require(registry.isVerified(msg.sender), "EscrowVault: payer not verified");
        require(registry.isVerified(payee), "EscrowVault: payee not verified");

        // effects
        _payments[id] = Payment({
            id: id,
            payer: msg.sender,
            payee: payee,
            amount: amount,
            fee: fee,
            complianceHash: complianceHash,
            state: State.Funded,
            createdAt: uint64(block.timestamp),
            releasedAt: 0
        });

        // interaction
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit PaymentFunded(id, msg.sender, payee, amount, fee, complianceHash);
    }

    /// @notice Release a funded payment: payee gets amount-fee, treasury gets fee.
    /// @dev Callable by the payer (work approved) or the platform.
    function release(bytes32 id) external nonReentrant {
        Payment storage p = _payments[id];
        require(p.state == State.Funded, "EscrowVault: not funded");
        require(msg.sender == p.payer || hasRole(PLATFORM_ROLE, msg.sender), "EscrowVault: not authorized");

        // effects
        p.state = State.Released;
        p.releasedAt = uint64(block.timestamp);
        uint256 payout = p.amount - p.fee;
        uint256 fee = p.fee;
        address payee = p.payee;

        // interactions
        token.safeTransfer(payee, payout);
        if (fee > 0) {
            token.safeTransfer(treasury, fee);
        }
        emit PaymentReleased(id);
    }

    /// @notice Refund a funded or frozen payment back to the payer in full.
    /// @dev Callable by the payer (pre-release) or the platform (e.g. rejected
    ///      compliance / resolved dispute).
    function refund(bytes32 id) external nonReentrant {
        Payment storage p = _payments[id];
        require(p.state == State.Funded || p.state == State.Frozen, "EscrowVault: not refundable");
        require(msg.sender == p.payer || hasRole(PLATFORM_ROLE, msg.sender), "EscrowVault: not authorized");

        // effects
        p.state = State.Refunded;
        uint256 amount = p.amount;
        address payer = p.payer;

        // interaction
        token.safeTransfer(payer, amount);
        emit PaymentRefunded(id);
    }

    /// @notice Freeze a funded payment (dispute hold). Platform only.
    function freeze(bytes32 id) external onlyRole(PLATFORM_ROLE) {
        Payment storage p = _payments[id];
        require(p.state == State.Funded, "EscrowVault: not funded");
        p.state = State.Frozen;
        emit PaymentFrozen(id);
    }

    /// @notice Unfreeze back to funded. Platform only.
    function unfreeze(bytes32 id) external onlyRole(PLATFORM_ROLE) {
        Payment storage p = _payments[id];
        require(p.state == State.Frozen, "EscrowVault: not frozen");
        p.state = State.Funded;
        emit PaymentUnfrozen(id);
    }

    /// @notice Read a payment record.
    function getPayment(bytes32 id) external view returns (Payment memory) {
        return _payments[id];
    }
}
