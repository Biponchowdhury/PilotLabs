// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PilotLabs} from "../PilotLabs.sol";
import {RevertingRecipient} from "../test-helpers/PilotLabsHelpers.sol";

contract PilotLabsHandler is Test {
    PilotLabs public router;
    address public owner;
    address[] public recipients;
    RevertingRecipient public bad;
    uint256 public ghostPaid;

    constructor(PilotLabs _router, address _owner) {
        router = _router;
        owner = _owner;
        recipients.push(makeAddr("r1"));
        recipients.push(makeAddr("r2"));
        recipients.push(makeAddr("r3"));
        bad = new RevertingRecipient();
    }

    function recipientCount() external view returns (uint256) {
        return recipients.length;
    }

    function pay(uint256 idx, uint256 amount, bytes32 ref) external {
        amount = bound(amount, 1, 100 ether);
        vm.deal(address(this), amount);
        address to = recipients[idx % recipients.length];
        try router.pay{value: amount}(payable(to), ref) {
            ghostPaid += amount;
        } catch {}
    }

    function payToReverting(uint256 amount) external {
        amount = bound(amount, 1, 100 ether);
        vm.deal(address(this), amount);
        try router.pay{value: amount}(payable(address(bad)), bytes32(0)) {
            ghostPaid += amount;
        } catch {}
    }

    function rawSend(uint256 amount) external {
        amount = bound(amount, 0, 10 ether);
        vm.deal(address(this), amount);
        (bool ok, ) = address(router).call{value: amount}("");
        ok;
    }

    function togglePause(bool p) external {
        vm.startPrank(owner);
        if (p && !router.paused()) router.pause();
        else if (!p && router.paused()) router.unpause();
        vm.stopPrank();
    }
}

contract PilotLabsInvariantTest is Test {
    PilotLabs internal router;
    PilotLabsHandler internal handler;
    address internal owner = makeAddr("owner");

    function setUp() public {
        router = new PilotLabs(owner);
        handler = new PilotLabsHandler(router, owner);
        targetContract(address(handler));
    }

    /// PROPERTY: the router never custodies funds.
    function invariant_RouterBalanceAlwaysZero() public view {
        assertEq(address(router).balance, 0);
    }

    /// PROPERTY: conservation — all value that left the payer arrived at recipients.
    function invariant_RecipientsHoldExactlyWhatWasPaid() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.recipientCount(); i++) {
            sum += handler.recipients(i).balance;
        }
        assertEq(sum, handler.ghostPaid());
        assertEq(address(handler.bad()).balance, 0);
    }
}
