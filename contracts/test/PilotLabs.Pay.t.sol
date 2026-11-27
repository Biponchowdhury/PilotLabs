// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PilotLabsTestBase} from "./PilotLabs.Base.t.sol";
import {PilotLabs} from "../PilotLabs.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    RevertingRecipient,
    NoReceiveRecipient,
    AcceptingRecipient,
    ReentrantRecipient,
    IPilotLabsPay
} from "../test-helpers/PilotLabsHelpers.sol";

contract PilotLabsPayTest is PilotLabsTestBase {
    // ---------- happy path ----------

    function test_Pay_ForwardsExactValueToEOA() public {
        vm.prank(alice);
        router.pay{value: 5 ether}(payable(bob), REF);
        assertEq(bob.balance, 5 ether);
        assertEq(alice.balance, 995 ether);
        assertEq(address(router).balance, 0);
    }

    function test_Pay_ForwardsToContractRecipient() public {
        AcceptingRecipient rec = new AcceptingRecipient();
        vm.prank(alice);
        router.pay{value: 3 ether}(payable(address(rec)), REF);
        assertEq(address(rec).balance, 3 ether);
        assertEq(rec.received(), 3 ether);
        assertEq(address(router).balance, 0);
    }

    function test_Pay_OneWeiWorks() public {
        vm.prank(alice);
        router.pay{value: 1}(payable(bob), REF);
        assertEq(bob.balance, 1);
    }

    function test_Pay_ZeroReferenceAllowed() public {
        vm.prank(alice);
        router.pay{value: 1 ether}(payable(bob), bytes32(0));
        assertEq(bob.balance, 1 ether);
    }

    function test_Pay_EmitsPayment() public {
        vm.expectEmit(true, true, true, true, address(router));
        emit Payment(alice, bob, REF, 2 ether);
        vm.prank(alice);
        router.pay{value: 2 ether}(payable(bob), REF);
    }

    function test_Pay_EmitsPaymentWithZeroReference() public {
        vm.expectEmit(true, true, true, true, address(router));
        emit Payment(alice, bob, bytes32(0), 7);
        vm.prank(alice);
        router.pay{value: 7}(payable(bob), bytes32(0));
    }

    function test_Pay_MultiplePaymentsAccumulateAtRecipient() public {
        vm.startPrank(alice);
        router.pay{value: 1 ether}(payable(bob), REF);
        router.pay{value: 2 ether}(payable(bob), REF);
        vm.stopPrank();
        assertEq(bob.balance, 3 ether);
        assertEq(address(router).balance, 0);
    }

    function test_Pay_WorksAfterUnpause() public {
        vm.prank(owner);
        router.pause();
        vm.prank(owner);
        router.unpause();
        vm.prank(alice);
        router.pay{value: 1 ether}(payable(bob), REF);
        assertEq(bob.balance, 1 ether);
    }

    // ---------- revert paths ----------

    function test_RevertWhen_ZeroValue() public {
        vm.prank(alice);
        vm.expectRevert(PilotLabs.ZeroAmount.selector);
        router.pay{value: 0}(payable(bob), REF);
    }

    function test_RevertWhen_ZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(PilotLabs.ZeroAddress.selector);
        router.pay{value: 1 ether}(payable(address(0)), REF);
    }

    function test_RevertWhen_RecipientIsSelf() public {
        vm.prank(alice);
        vm.expectRevert(PilotLabs.InvalidRecipient.selector);
        router.pay{value: 1 ether}(payable(alice), REF);
    }

    function test_RevertWhen_RecipientIsRouter() public {
        vm.prank(alice);
        vm.expectRevert(PilotLabs.InvalidRecipient.selector);
        router.pay{value: 1 ether}(payable(address(router)), REF);
    }

    function test_RevertWhen_Paused() public {
        vm.prank(owner);
        router.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.pay{value: 1 ether}(payable(bob), REF);
        assertEq(bob.balance, 0);
        assertEq(alice.balance, 1_000 ether);
    }

    function test_RevertWhen_PausedAndZeroValue_PausedCheckedFirst() public {
        vm.prank(owner);
        router.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.pay{value: 0}(payable(address(0)), REF);
    }

    function test_RevertWhen_ZeroValueAndZeroAddress_ZeroAmountFirst() public {
        vm.prank(alice);
        vm.expectRevert(PilotLabs.ZeroAmount.selector);
        router.pay{value: 0}(payable(address(0)), REF);
    }

    function test_RevertWhen_RecipientReverts() public {
        RevertingRecipient rec = new RevertingRecipient();
        vm.prank(alice);
        vm.expectRevert(PilotLabs.TransferFailed.selector);
        router.pay{value: 1 ether}(payable(address(rec)), REF);
        assertEq(alice.balance, 1_000 ether);
        assertEq(address(router).balance, 0);
    }

    function test_RevertWhen_RecipientHasNoReceive() public {
        NoReceiveRecipient rec = new NoReceiveRecipient();
        vm.prank(alice);
        vm.expectRevert(PilotLabs.TransferFailed.selector);
        router.pay{value: 1 ether}(payable(address(rec)), REF);
        assertEq(address(router).balance, 0);
    }

    function test_RevertWhen_ReentrantRecipientBubblesRevert() public {
        ReentrantRecipient rec = new ReentrantRecipient(IPilotLabsPay(address(router)), payable(carol), true);
        vm.prank(alice);
        vm.expectRevert(PilotLabs.TransferFailed.selector);
        router.pay{value: 1 ether}(payable(address(rec)), REF);
        // atomic: nothing moved
        assertEq(carol.balance, 0);
        assertEq(address(rec).balance, 0);
        assertEq(alice.balance, 1_000 ether);
        assertEq(address(router).balance, 0);
    }

    function test_ReentrantRecipientSwallowing_ReentryBlockedOuterPaymentSucceeds() public {
        ReentrantRecipient rec = new ReentrantRecipient(IPilotLabsPay(address(router)), payable(carol), false);
        vm.prank(alice);
        router.pay{value: 1 ether}(payable(address(rec)), REF);
        assertTrue(rec.reentryAttempted());
        assertFalse(rec.reentrySucceeded());
        assertEq(rec.reentryRevertData(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
        assertEq(carol.balance, 0);
        assertEq(address(rec).balance, 1 ether);
        assertEq(address(router).balance, 0);
    }

    function test_FailedPaymentEmitsNoEvent() public {
        RevertingRecipient rec = new RevertingRecipient();
        vm.recordLogs();
        vm.prank(alice);
        try router.pay{value: 1 ether}(payable(address(rec)), REF) {
            fail();
        } catch {}
        assertEq(vm.getRecordedLogs().length, 0);
    }

    // ---------- receive / fallback ----------

    function test_Receive_RejectsPlainTransfer() public {
        vm.prank(alice);
        (bool ok, bytes memory data) = address(router).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(bytes4(data), PilotLabs.UnsupportedCall.selector);
        assertEq(address(router).balance, 0);
    }

    function test_Receive_RejectsZeroValuePlainCall() public {
        vm.prank(alice);
        (bool ok, bytes memory data) = address(router).call("");
        assertFalse(ok);
        assertEq(bytes4(data), PilotLabs.UnsupportedCall.selector);
    }

    function test_Fallback_RejectsUnknownCallWithoutValue() public {
        vm.prank(alice);
        (bool ok, bytes memory data) = address(router).call(abi.encodeWithSignature("doesNotExist()"));
        assertFalse(ok);
        assertEq(bytes4(data), PilotLabs.UnsupportedCall.selector);
    }

    function test_Fallback_RejectsUnknownCallWithValue() public {
        vm.prank(alice);
        (bool ok, bytes memory data) = address(router).call{value: 1 ether}(abi.encodeWithSignature("foo(uint256)", 1));
        assertFalse(ok);
        assertEq(bytes4(data), PilotLabs.UnsupportedCall.selector);
        assertEq(address(router).balance, 0);
    }

    // ---------- fuzz ----------

    function testFuzz_Pay_RouterEmptyAndRecipientGainsExactly(address to, uint96 rawAmount, bytes32 ref) public {
        assumeNotPrecompile(to);
        assumeNotForgeAddress(to);
        vm.assume(to != address(0) && to != address(router) && to != alice);
        vm.assume(to.code.length == 0);
        uint256 amount = bound(uint256(rawAmount), 1, 1_000 ether);

        uint256 toBefore = to.balance;
        uint256 payerBefore = alice.balance;

        vm.expectEmit(true, true, true, true, address(router));
        emit Payment(alice, to, ref, amount);
        vm.prank(alice);
        router.pay{value: amount}(payable(to), ref);

        assertEq(address(router).balance, 0);
        assertEq(to.balance, toBefore + amount);
        assertEq(alice.balance, payerBefore - amount);
    }
}
