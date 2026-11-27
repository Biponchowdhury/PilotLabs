// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PilotLabs
/// @notice Optional, non-custodial native-USDC payment router for Arc Mainnet (chain ID 5042).
/// @dev Amounts use native 18-decimal units, not ERC-20 token units. Successful payments
/// forward exactly msg.value; failed payments revert atomically. No fees, approvals,
/// balance accounting, withdrawals, or upgrades exist. Ownership controls pausing only,
/// in addition to the inherited two-step ownership management and renunciation functions.
/// ETH-style forced deposits (e.g. selfdestruct) are unsupported and unrecoverable by
/// design, including by the owner. Plain transfers and unknown calls are rejected.
contract PilotLabs is Ownable2Step, Pausable, ReentrancyGuard {
    /// @notice A payment must include a positive native-USDC amount.
    error ZeroAmount();

    /// @notice The recipient cannot be the zero address.
    error ZeroAddress();

    /// @notice The recipient cannot be this router or the payer.
    error InvalidRecipient();

    /// @notice The recipient call failed; recipient revert data is not propagated.
    error TransferFailed();

    /// @notice Plain native transfers and unknown calls are not supported.
    error UnsupportedCall();

    /// @notice Ownership cannot be renounced; use the two-step transfer instead.
    error RenounceDisabled();

    /// @notice Emitted only after the recipient successfully receives the payment.
    /// @param from The payer who called pay.
    /// @param to The recipient of the native USDC.
    /// @param paymentReference Opaque invoice or memo identifier; zero is allowed.
    /// @param amount Amount forwarded in native 18-decimal units.
    event Payment(
        address indexed from,
        address indexed to,
        bytes32 indexed paymentReference,
        uint256 amount
    );

    /// @notice Creates an initially unpaused payment router.
    /// @dev Ownable rejects a zero initialOwner with OwnableInvalidOwner.
    /// @param initialOwner Non-zero address authorized to pause and unpause payments.
    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Forwards the entire attached native-USDC amount to the recipient.
    /// @dev Requires an unpaused router, positive value, and a non-zero recipient
    /// distinct from both the payer and this router. The reentrancy guard is entered
    /// before the interaction; there is no payment accounting state to update.
    /// Uses an empty-calldata low-level call and discards recipient return data.
    /// Recipient rejection, including Arc runtime restrictions, reverts the payment.
    /// @param to Recipient of the payment.
    /// @param paymentReference Opaque invoice or memo identifier; any bytes32 is allowed.
    function pay(address payable to, bytes32 paymentReference) external payable nonReentrant whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (to == address(this) || to == msg.sender) revert InvalidRecipient();

        (bool success, ) = to.call{value: msg.value}("");
        if (!success) revert TransferFailed();

        emit Payment(msg.sender, to, paymentReference, msg.value);
    }

    /// @notice Pauses payments; callable only by the owner.
    /// @dev Reverts if the caller is not the owner or payments are already paused.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes payments; callable only by the owner.
    /// @dev Reverts if the caller is not the owner or payments are not paused.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Ownership renunciation is disabled.
    /// @dev Always reverts. Renouncing while paused would make `unpause` uncallable and permanently
    /// disable payments. Hand over control with the two-step `transferOwnership` flow instead.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    /// @notice Rejects plain native-USDC transfers, including zero-value transfers.
    /// @dev Always reverts; use pay instead. Forced deposits cannot be recovered.
    receive() external payable {
        revert UnsupportedCall();
    }

    /// @notice Rejects unknown calls whether or not native USDC is attached.
    /// @dev Always reverts; no forwarding or arbitrary execution is supported.
    fallback() external payable {
        revert UnsupportedCall();
    }
}
