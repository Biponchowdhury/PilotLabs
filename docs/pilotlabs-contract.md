# PilotLabs.sol: optional payment router

Source: `contracts/PilotLabs.sol`. ABI: `contracts/deployment/PilotLabs.abi.json`. Deployment bytecode: `contracts/deployment/PilotLabs.bytecode.txt` (creation code, 2,039 bytes, needs one constructor argument).

Status: **compiled and tested locally, NOT deployed.** No deployment transaction has been sent, and the web app does not call this contract.

## Does PilotLabs need it?

No. Send is a plain native USDC transfer signed in the user's wallet, Receive is just the wallet address, and History is read from Arc Mainnet transfer logs. None of that needs custom contract code. This contract is an optional extra for apps that want to tag payments with an invoice or order id and get a dedicated `Payment` event.

## What it does

- `pay(address to, bytes32 paymentReference)` (payable): forwards the whole `msg.value` (native USDC, 18 decimals) to `to` in the same transaction and emits `Payment(from, to, paymentReference, amount)`. It never holds funds.
- Checks: amount > 0, recipient not zero, not the payer, not the router. A recipient that rejects the transfer reverts the whole payment.
- Owner (two-step transfer) can only `pause()` / `unpause()`. The owner cannot move funds. `renounceOwnership()` is disabled so a paused router can never be locked forever.
- Plain transfers and unknown calls revert. Funds forced in by other means (for example selfdestruct) cannot be recovered.

## Compiler settings (must match when verifying)

solc 0.8.28, EVM `cancun`, optimizer on, 200 runs, OpenZeppelin Contracts 5.6.1 (see `foundry.toml`).

## Deploying to Arc Mainnet (you do this, from your own wallet)

Arc Studio does not deploy to or sign for mainnet. Review the code and get an independent audit first.

- Chain ID `5042`, RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`. Gas is paid in USDC, so the deployer wallet needs a small USDC balance.
- Constructor argument: `initialOwner`, the address that may pause and unpause. Use a wallet or multisig you control, not a placeholder.
- Arc rejects transactions with `maxFeePerGas` under 20 gwei. If a deploy never appears, retry with an explicit gas price of at least 20 gwei.

1. Import your deployer key into an encrypted Foundry keystore once (never paste a key into a command or file):

   ```bash
   cast wallet import pilotlabs-deployer --interactive
   ```

2. Build and deploy:

   ```bash
   export ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
   export OWNER=0xYourOwnerAddress

   forge build
   forge create contracts/PilotLabs.sol:PilotLabs \
     --rpc-url $ARC_MAINNET_RPC_URL \
     --account pilotlabs-deployer \
     --constructor-args $OWNER \
     --gas-price 25gwei \
     --broadcast
   ```

   The command prints `Deployed to:` and the transaction hash. Arc's own Foundry fork (`arc-forge`) handles Arc-specific behavior if you prefer it.

3. Confirm on the explorer that code exists at the printed address, then read `owner()` and `paused()` with `cast call` to check them.

4. Verify the source on the explorer using the compiler settings above (flattened source or standard JSON input from `forge build`).

5. Call `pay` from a wallet with a small amount first and confirm the recipient balance and the `Payment` log.

Only after you have deployed and tested it yourself should you add the address to the app, for example as a `VITE_` environment variable.
