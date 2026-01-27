# @bench/conviction-markets

TypeScript SDK for Solana Conviction Markets with encrypted votes using Arcium MPC.

## Overview

Conviction Markets allow users to influence decision-making by staking capital on their preferred option. Vote choices and stake amounts are encrypted on-chain and only revealed when the market creator announces the winning option. Winners can claim yield from the reward pool.

## Installation

```bash
npm install @bench/conviction-markets @solana/web3.js @coral-xyz/anchor @arcium-hq/client
```

or with Bun:

```bash
bun add @bench/conviction-markets @solana/web3.js @coral-xyz/anchor @arcium-hq/client
```

## Features

- **Encrypted Voting**: User votes and stake amounts remain private using Arcium MPC
- **Ergonomic API**: Auto-generates computation offsets, nonces, and handles encryption
- **Type-Safe**: Full TypeScript support with IDL-generated types
- **Comprehensive**: All program instructions with helper utilities

## Quick Start

```typescript
import {
  createMarket,
  addMarketOption,
  openMarket,
  initVoteTokenAccount,
  mintVoteTokens,
  buyMarketShares,
  generateSolanaKeypair,
  generateX25519Keypair,
  PROGRAM_ID,
} from "@bench/conviction-markets";
import { Connection } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";

// Setup connection and provider
const connection = new Connection("https://api.devnet.solana.com");
const creator = generateSolanaKeypair(); // Or load from file
const wallet = new Wallet(creator);
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

// Create a market
const { signature, marketPda, computationOffset } = await createMarket(
  provider,
  {
    creator,
    marketIndex: Date.now(), // Use unique index
    maxOptions: 3,
    maxShares: 1000,
    rewardLamports: 1_000_000, // 0.001 SOL
    timeToStake: 3600, // 1 hour
    timeToReveal: 600, // 10 minutes
  }
);

// Wait for MPC computation to finalize
await awaitComputationFinalization(provider, computationOffset);
console.log("Market created:", marketPda.toBase58());

// Add options
await addMarketOption(provider, {
  creator,
  market: marketPda,
  optionIndex: 1,
  name: "Option A",
});

// Open market for trading
const now = Math.floor(Date.now() / 1000);
await openMarket(provider, {
  creator,
  market: marketPda,
  openTimestamp: now + 60, // Opens in 60 seconds
});
```

## User Participation

```typescript
import {
  initVoteTokenAccount,
  mintVoteTokens,
  initShareAccount,
  buyMarketShares,
  awaitComputationFinalization,
  generateSolanaKeypair,
  generateX25519Keypair,
} from "@bench/conviction-markets";

// Create user keypairs
const user = generateSolanaKeypair();
const userX25519 = generateX25519Keypair();

// Initialize vote token account
const { computationOffset: initOffset } = await initVoteTokenAccount(provider, {
  signer: user,
  userX25519Keypair: userX25519,
});
await awaitComputationFinalization(provider, initOffset);

// Buy vote tokens with SOL
const { computationOffset: mintOffset } = await mintVoteTokens(provider, {
  signer: user,
  userX25519Keypair: userX25519,
  amount: 100, // Buy 100 vote tokens
});
await awaitComputationFinalization(provider, mintOffset);

// Initialize share account
await initShareAccount(provider, {
  signer: user,
  market: marketPda,
});

// Buy market shares (amount and option encrypted automatically!)
const { computationOffset: buyOffset } = await buyMarketShares(provider, {
  signer: user,
  userX25519Keypair: userX25519,
  market: marketPda,
  amount: 50, // Spend 50 vote tokens
  selectedOption: 1, // Vote for option 1
});
await awaitComputationFinalization(provider, buyOffset);
```

## Market Resolution & Claims

```typescript
import {
  selectOption,
  revealShares,
  incrementOptionTally,
  closeShareAccount,
  awaitComputationFinalization,
} from "@bench/conviction-markets";

// Market creator selects winning option
await selectOption(provider, {
  authority: creator,
  market: marketPda,
  optionIndex: 1,
});

// Anyone can reveal shares (permissionless)
const { computationOffset: revealOffset } = await revealShares(provider, {
  signer: anyKeypair, // Can be anyone
  owner: user.publicKey,
  market: marketPda,
  ownerX25519Keypair: userX25519,
});
await awaitComputationFinalization(provider, revealOffset);

// Increment option tally (permissionless)
await incrementOptionTally(provider, {
  market: marketPda,
  owner: user.publicKey,
  optionIndex: 1,
});

// User claims yield and closes share account
await closeShareAccount(provider, {
  owner: user,
  market: marketPda,
  optionIndex: 1, // Option they voted for
});
```

## API Reference

### Market Lifecycle

- **`createMarket()`** - Creates a new market with encrypted state
- **`addMarketOption()`** - Adds a named voting option
- **`openMarket()`** - Opens market for trading at specified timestamp
- **`selectOption()`** - Selects the winning option (creator or authority)

### Vote Tokens

- **`initVoteTokenAccount()`** - Initializes encrypted balance account
- **`mintVoteTokens()`** - Buys vote tokens with SOL (0.001 SOL per token)
- **`claimVoteTokens()`** - Sells unused vote tokens back for SOL

### Market Shares

- **`initShareAccount()`** - Initializes share account for a market
- **`buyMarketShares()`** - Purchases shares with encrypted input
- **`revealShares()`** - Reveals encrypted shares (after staking ends)
- **`incrementOptionTally()`** - Increments option tally after reveal
- **`closeShareAccount()`** - Closes account and claims yield (if winner)

### Utilities

- **`generateSolanaKeypair()`** - Generates Solana keypair for signing
- **`generateX25519Keypair()`** - Generates X25519 keypair for encryption
- **`deriveMarketPda()`** - Derives market PDA
- **`deriveVoteTokenAccountPda()`** - Derives vote token account PDA
- **`deriveShareAccountPda()`** - Derives share account PDA
- **`deriveOptionPda()`** - Derives option PDA

## Key Concepts

### Two Types of Keypairs

1. **Solana Keypair**: Used for transaction signing and account ownership
   ```typescript
   const solanaKeypair = generateSolanaKeypair();
   ```

2. **X25519 Keypair**: Used for MPC encryption with Arcium
   ```typescript
   const x25519Keypair = generateX25519Keypair();
   ```

### MPC Instructions

Instructions that use encrypted computations return a `computationOffset`. Use the `awaitComputationFinalization` helper to wait for the computation to complete:

```typescript
import { mintVoteTokens, awaitComputationFinalization } from "@bench/conviction-markets";

const { signature, computationOffset } = await mintVoteTokens(provider, {
  signer: user,
  userX25519Keypair,
  amount: 100,
});

// Wait for MPC computation to complete
await awaitComputationFinalization(provider, computationOffset);

// With options
await awaitComputationFinalization(provider, computationOffset, {
  commitment: "finalized",
  programId: customProgramId,
});
```

### Automatic Encryption

The SDK handles encryption automatically for `buyMarketShares()`:

```typescript
// Just pass plain values - SDK encrypts them!
await buyMarketShares(provider, {
  signer: user,
  userX25519Keypair,
  market: marketPda,
  amount: 50, // Plain value
  selectedOption: 1, // Plain value
});
```

## Program Information

- **Devnet Program ID**: `bnchXx34qGANGyEL6MxTYdG8iXmUmSPyQFAGhxj1VKn`
- **Vote Token Price**: 0.001 SOL per token
- **Arcium Version**: v0.6.3

## Market Flow

1. **Create** market with parameters
2. **Add** named options (1-indexed)
3. **Fund** market with SOL for rewards
4. **Open** market at specified timestamp
5. **Users mint** vote tokens and buy shares
6. **Creator selects** winning option
7. **Shares revealed** and tallied
8. **Winners claim** proportional yield

## Examples

See the `/scripts` and `/tests` directories in the main repository for complete examples:

- `scripts/test-open-market.ts` - Full market creation flow
- `tests/conviction.ts` - Comprehensive integration tests

## License

MIT

## Contributing

Contributions are welcome! Please see the main repository for guidelines.

## Links

- [GitHub Repository](https://github.com/arcium/solana-conviction-markets)
- [Arcium](https://arcium.com/)
