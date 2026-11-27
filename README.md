# PilotLabs

A simple payment app on Arc Mainnet: send USDC, receive it with a QR code, and review your transaction history. Wallets stay in your control; the app never asks for a private key or seed phrase.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

React, TypeScript, Vite, Tailwind CSS, wagmi, viem, ConnectKit.

## Development

Prerequisites: [Bun](https://bun.sh).

```bash
bun install
bun run dev      # start the app on http://localhost:5173
bun run check    # lint and typecheck
```

### Environment variables

- `VITE_ARC_HISTORY_RPC_URL` (optional): an additional Arc Mainnet node endpoint used to speed up loading of the most recent transaction history. Without it, history loads from the primary Arc Mainnet endpoint only.

## Notes

- Network: Arc Mainnet (chain ID 5042). Balances, fees, and transfers are all in USDC.
- Transaction history is read from Arc Mainnet logs. The newest activity loads first; use Load More to search further back.
