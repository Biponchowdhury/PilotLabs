// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PilotLabs} from "../PilotLabs.sol";

abstract contract PilotLabsTestBase is Test {
    PilotLabs internal router;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    bytes32 internal constant REF = keccak256("invoice-1");

    event Payment(address indexed from, address indexed to, bytes32 indexed paymentReference, uint256 amount);

    function setUp() public virtual {
        router = new PilotLabs(owner);
        vm.deal(alice, 1_000 ether);
    }
}
