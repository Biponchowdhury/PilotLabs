// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PilotLabsTestBase} from "./PilotLabs.Base.t.sol";
import {PilotLabs} from "../PilotLabs.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract PilotLabsAdminTest is PilotLabsTestBase {
    // ---------- deployment ----------

    function test_Deploy_SetsOwnerAndStartsUnpaused() public view {
        assertEq(router.owner(), owner);
        assertEq(router.pendingOwner(), address(0));
        assertFalse(router.paused());
        assertEq(address(router).balance, 0);
    }

    function test_RevertWhen_DeployWithZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new PilotLabs(address(0));
    }

    // ---------- pause / unpause ----------

    function test_Pause_ByOwner() public {
        vm.prank(owner);
        router.pause();
        assertTrue(router.paused());
    }

    function test_Pause_EmitsPaused() public {
        vm.expectEmit(false, false, false, true, address(router));
        emit Pausable.Paused(owner);
        vm.prank(owner);
        router.pause();
    }

    function test_Unpause_ByOwner() public {
        vm.startPrank(owner);
        router.pause();
        router.unpause();
        vm.stopPrank();
        assertFalse(router.paused());
    }

    function test_Unpause_EmitsUnpaused() public {
        vm.prank(owner);
        router.pause();
        vm.expectEmit(false, false, false, true, address(router));
        emit Pausable.Unpaused(owner);
        vm.prank(owner);
        router.unpause();
    }

    function test_RevertWhen_NonOwnerPauses() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.pause();
        assertFalse(router.paused());
    }

    function test_RevertWhen_NonOwnerUnpauses() public {
        vm.prank(owner);
        router.pause();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.unpause();
        assertTrue(router.paused());
    }

    function test_RevertWhen_PauseWhilePaused() public {
        vm.startPrank(owner);
        router.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.pause();
        vm.stopPrank();
    }

    function test_RevertWhen_UnpauseWhileNotPaused() public {
        vm.prank(owner);
        vm.expectRevert(Pausable.ExpectedPause.selector);
        router.unpause();
    }

    // ---------- two-step ownership ----------

    function test_TransferOwnership_SetsPendingOnly() public {
        vm.prank(owner);
        router.transferOwnership(bob);
        assertEq(router.owner(), owner);
        assertEq(router.pendingOwner(), bob);
    }

    function test_TransferOwnership_EmitsStarted() public {
        vm.expectEmit(true, true, false, false, address(router));
        emit Ownable2Step.OwnershipTransferStarted(owner, bob);
        vm.prank(owner);
        router.transferOwnership(bob);
    }

    function test_AcceptOwnership_CompletesTransfer() public {
        vm.prank(owner);
        router.transferOwnership(bob);

        vm.expectEmit(true, true, false, false, address(router));
        emit Ownable.OwnershipTransferred(owner, bob);
        vm.prank(bob);
        router.acceptOwnership();

        assertEq(router.owner(), bob);
        assertEq(router.pendingOwner(), address(0));
    }

    function test_NewOwnerCanPause_OldOwnerCannot() public {
        vm.prank(owner);
        router.transferOwnership(bob);
        vm.prank(bob);
        router.acceptOwnership();

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        router.pause();

        vm.prank(bob);
        router.pause();
        assertTrue(router.paused());
    }

    function test_PendingOwnerCannotPauseBeforeAccepting() public {
        vm.prank(owner);
        router.transferOwnership(bob);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        router.pause();
    }

    function test_RevertWhen_NonOwnerTransfersOwnership() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.transferOwnership(alice);
    }

    function test_RevertWhen_NonPendingAcceptsOwnership() public {
        vm.prank(owner);
        router.transferOwnership(bob);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.acceptOwnership();
        assertEq(router.owner(), owner);
    }

    function test_RevertWhen_AcceptWithNoPending() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.acceptOwnership();
    }

    function test_TransferOwnership_CanBeOverwrittenByOwner() public {
        vm.startPrank(owner);
        router.transferOwnership(bob);
        router.transferOwnership(carol);
        vm.stopPrank();
        assertEq(router.pendingOwner(), carol);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        router.acceptOwnership();
    }

    // ---------- renounce disabled ----------

    function test_RevertWhen_OwnerRenounces() public {
        vm.prank(owner);
        vm.expectRevert(PilotLabs.RenounceDisabled.selector);
        router.renounceOwnership();
        assertEq(router.owner(), owner);
    }

    function test_RevertWhen_OwnerRenouncesWhilePaused() public {
        vm.startPrank(owner);
        router.pause();
        vm.expectRevert(PilotLabs.RenounceDisabled.selector);
        router.renounceOwnership();
        router.unpause();
        vm.stopPrank();
        assertFalse(router.paused());
    }

    function test_RevertWhen_NonOwnerRenounces() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.renounceOwnership();
    }
}
