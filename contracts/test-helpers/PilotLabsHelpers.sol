// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPilotLabsPay {
    function pay(address payable to, bytes32 paymentReference) external payable;
}

/// @dev Recipient that always reverts on receipt.
contract RevertingRecipient {
    receive() external payable {
        revert("nope");
    }
}

/// @dev Recipient with no receive/fallback (rejects plain value transfers).
contract NoReceiveRecipient {}

/// @dev Recipient that accepts value and counts receipts.
contract AcceptingRecipient {
    uint256 public received;

    receive() external payable {
        received += msg.value;
    }
}

/// @dev Recipient that re-enters pay() on receipt. If `bubble` is true the reentrancy
/// revert is propagated (making the outer payment fail); otherwise it is swallowed.
contract ReentrantRecipient {
    IPilotLabsPay public immutable router;
    address payable public immutable target;
    bool public immutable bubble;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    bytes public reentryRevertData;

    constructor(IPilotLabsPay _router, address payable _target, bool _bubble) {
        router = _router;
        target = _target;
        bubble = _bubble;
    }

    receive() external payable {
        reentryAttempted = true;
        if (bubble) {
            router.pay{value: msg.value}(target, bytes32(0));
            reentrySucceeded = true;
        } else {
            try router.pay{value: msg.value}(target, bytes32(0)) {
                reentrySucceeded = true;
            } catch (bytes memory data) {
                reentryRevertData = data;
            }
        }
    }
}
